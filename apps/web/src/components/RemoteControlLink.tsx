"use client";

import { useEffect, useRef, useState } from "react";
import { findLeadsunGroupForProduct, isLampOn } from "@/lib/leadsun";
import type { LeadsunLampStatus, LeadsunProduct, LeadsunProject } from "@/lib/types";

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

interface AffectedPole {
  gatewayName: string;
  poleNumber: string;
  providedProductId: string;
  /** Leadsun's own ProductName (e.g. "DRH-Orl") — what setPoleLights' poleNumber(s) fields actually expect, despite the field being named "poleNumber(s)". Distinct from our own PoleNumber field above, which is only for display. */
  leadsunProductName: string;
}

/** Exactly one of these identifies what a control action applies to — matches setPoleLights' own contract. */
type ControlScope = { projectId: string } | { gatewayCode: string } | { poleNumber: string };

/**
 * Small up/down chevrons on the right edge of a scrollable list, shown
 * only when there's actually more content in that direction — a plain
 * "this list scrolls" affordance, not decoration.
 */
function ScrollHint({ direction }: { direction: "up" | "down" }) {
  return (
    <div
      className={`pointer-events-none absolute right-1.5 ${
        direction === "up" ? "top-1" : "bottom-1"
      } text-[10px] leading-none text-[var(--ink-faint)]`}
      aria-hidden="true"
    >
      {direction === "up" ? "▲" : "▼"}
    </div>
  );
}

/** Result of polling for a confirmed status change after a submitted action. */
type ActionState = "idle" | "polling" | "error";

const MAX_POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 1000;
const AUTO_CLOSE_MS = 2000;
// Shorter than POLL_INTERVAL_MS would allow overlapping polls; long enough
// for a normal round trip through our own server to Leadsun's mTLS API.
const POLL_FETCH_TIMEOUT_MS = 8000;
// A guess, not a confirmed number from Leadsun — 502s with "Leadsun EDGE
// API request failed" after a handful of rapid submissions strongly
// suggest a rate limit enforced on their own side. This just spaces
// requests out to reduce how often that gets hit in practice — moved
// 10s -> 20s -> 30s -> back to 10s while testing; tune further once the
// real limit is confirmed.
const COOLDOWN_SECONDS = 10;

/**
 * A small stub-turned-real link+modal for a specific control action
 * (project, gateway, or pole level) — opens on top of the Remote Control
 * modal it's nested in. Each affected pole has a "Selected" toggle
 * (default: all on); for Project/Gateway Control, deselecting any pole
 * switches the request from the whole project/gateway scope to just the
 * selected poles' own ProductNames via poleNumbers; for Light Control
 * (a single pole), deselecting it grays out the submit button entirely.
 * Submits Brightness/Time to POST /api/setpolelights; on success, the
 * modal auto-closes after 2s, and — independently of that — the trigger
 * link itself is replaced by a spinner while polling GET
 * /api/leadsunlampstatus every 1s (up to 15 tries) until every actually-
 * submitted pole's ON/OFF state matches what was requested (ON for any
 * brightness > 0, OFF for 0); if it never confirms within 15 tries, the
 * spinner becomes a retryable error instead. Each instance manages its
 * own open/closed state, form values, pole selection, and action/poll
 * state independently.
 */
function ControlActionLink({
  triggerLabel,
  modalTitle,
  scope,
  leadsunProjectId,
  affectedPoles,
  onActionSubmitted,
  className,
}: {
  triggerLabel: string;
  modalTitle: string;
  scope: ControlScope;
  /** Leadsun's own numeric ProjectId — needed to scope the post-action status poll, separate from setPoleLights' own scope. */
  leadsunProjectId: string;
  affectedPoles: AffectedPole[];
  onActionSubmitted: () => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [brightness, setBrightness] = useState(50);
  const [time, setTime] = useState(30);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(affectedPoles.map((pole) => pole.poleNumber)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const titleId = `control-action-title-${triggerLabel.replace(/\s+/g, "-").toLowerCase()}`;

  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Guards against setting state from a poll that's still in flight after
  // this component has unmounted (e.g. the whole Remote Control modal was
  // closed while a poll was pending).
  //
  // Resetting to false at the start of the effect body (not just via the
  // initial useRef(false)) matters: React Strict Mode — on by default in
  // Next.js dev — double-invokes effects (mount, cleanup, mount again) to
  // surface exactly this kind of bug. Without the reset here, that
  // throwaway first cleanup would set this to true, and since useRef's
  // initializer only runs once, it would stay true for the component's
  // entire real lifetime — silently no-oping every single poll check
  // from the very first attempt, with no fetches ever made, regardless of
  // whether the modal had actually closed.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  function updateScrollHints() {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 1);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }

  useEffect(() => {
    if (!isOpen) return;
    updateScrollHints();
  }, [isOpen, affectedPoles.length]);

  function toggleSelected(poleNumber: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(poleNumber)) {
        next.delete(poleNumber);
      } else {
        next.add(poleNumber);
      }
      return next;
    });
  }

  function close() {
    setIsOpen(false);
  }

  /** True only once every affected pole's live status matches expectedOn — never on a failed/partial fetch. */
  async function checkPolesMatch(
    expectedOn: boolean,
    polesToCheck: AffectedPole[],
  ): Promise<boolean> {
    // The whole body lives inside try/catch — even query construction —
    // since any uncaught throw here would silently kill the entire
    // recursive poll chain (the outer setTimeout callback just rejects
    // with nothing listening), leaving the spinner stuck forever with no
    // further polling and no error shown.
    try {
      const query = new URLSearchParams({ projectId: leadsunProjectId });
      if (polesToCheck.length === 1) {
        query.set("productId", polesToCheck[0].providedProductId);
      }
      // A hung/unresponsive Leadsun server could otherwise leave this
      // fetch pending forever, freezing the poll loop on this one attempt
      // permanently (defense in depth alongside the server's own timeout
      // in leadsunClient.ts).
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), POLL_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/leadsunlampstatus?${query.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return false;
        const lamps: LeadsunLampStatus[] = await res.json();
        const byId = Object.fromEntries(lamps.map((lamp) => [lamp.productId, lamp]));
        return polesToCheck.every((pole) => {
          const lamp = byId[pole.providedProductId];
          return lamp !== undefined && isLampOn(lamp) === expectedOn;
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }

  /**
   * Checks only polesToCheck (the poles actually included in the
   * submitted request) — not the full affectedPoles list. A deselected
   * pole was never targeted by setPoleLights, so it would never change
   * state; waiting on it too would mean the selected poles' own
   * successful change could never be confirmed, eventually hitting the
   * 15-attempt error state even though the request that was actually
   * sent fully succeeded.
   */
  function startPolling(expectedOn: boolean, polesToCheck: AffectedPole[]) {
    let attempts = 0;

    function scheduleNext() {
      setTimeout(async () => {
        if (unmountedRef.current) return;
        attempts += 1;
        const matched = await checkPolesMatch(expectedOn, polesToCheck);
        if (unmountedRef.current) return;
        if (matched) {
          setActionState("idle");
          onActionSubmitted();
          return;
        }
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setActionState("error");
          return;
        }
        scheduleNext();
      }, POLL_INTERVAL_MS);
    }

    scheduleNext();
  }

  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current !== null) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldownRemaining(COOLDOWN_SECONDS);
    if (cooldownIntervalRef.current !== null) clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      if (unmountedRef.current) return;
      setCooldownRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0 && cooldownIntervalRef.current !== null) {
          clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
        }
        return Math.max(next, 0);
      });
    }, 1000);
  }

  /**
   * Light Control (single pole): always just that one pole — the submit
   * button is disabled whenever it's deselected (see disabled prop
   * below), so this path is only ever reached while it's selected.
   * Project/Gateway Control: the normal scope (projectId/gatewayCode)
   * when every pole is selected, matching the existing behavior exactly;
   * once any pole is deselected, submits only the selected ones via
   * poleNumbers instead, by Leadsun's own ProductName (what that field
   * actually expects, despite the name, matching poleNumber above).
   */
  function buildRequestBody(selectedPoles: AffectedPole[]): Record<string, unknown> {
    if ("poleNumber" in scope) {
      return { ...scope, brightness, time };
    }
    const allSelected = selectedPoles.length === affectedPoles.length;
    if (allSelected) {
      return { ...scope, brightness, time };
    }
    return {
      poleNumbers: selectedPoles.map((pole) => pole.leadsunProductName),
      brightness,
      time,
    };
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitResult(null);
    const selectedPoles = affectedPoles.filter((pole) => selected.has(pole.poleNumber));
    try {
      const res = await fetch("/api/setpolelights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(selectedPoles)),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || body?.message || `request failed (${res.status})`);
      }
      setSubmitResult({ ok: true, message: body.message || "Request successful" });
      // The modal auto-closes after a fixed delay regardless of how long
      // confirmation takes — polling below continues independently even
      // after that, since confirming can take longer than 5s.
      setTimeout(close, AUTO_CLOSE_MS);
      setActionState("polling");
      startPolling(brightness > 0, selectedPoles);
    } catch (err) {
      setSubmitResult({
        ok: false,
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setIsSubmitting(false);
      // Applies whether this attempt succeeded or failed — a failed
      // attempt still counts as one more request against Leadsun's own
      // rate limit, so retrying immediately after a failure is exactly
      // the case most likely to fail again.
      startCooldown();
    }
  }

  // Covers both "Light Control" with its one pole deselected, and
  // "Project/Gateway Control" with every pole deselected — nothing left
  // to actually submit either way.
  const nothingSelected = affectedPoles.every((pole) => !selected.has(pole.poleNumber));

  const buttonLabel = isSubmitting
    ? "Submitting…"
    : cooldownRemaining > 0
      ? `Wait ${cooldownRemaining}s`
      : brightness === 0
        ? "TURN OFF"
        : "GO!";

  return (
    <>
      {actionState === "idle" && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ??
            "cursor-pointer text-[11px] font-medium text-[var(--accent)] hover:underline"
          }
        >
          {triggerLabel}
        </button>
      )}
      {actionState === "polling" && (
        <span
          role="status"
          aria-label={`Waiting for ${triggerLabel.toLowerCase()} to take effect`}
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--ink-faint)] border-t-transparent"
        />
      )}
      {actionState === "error" && (
        <button
          type="button"
          onClick={() => setActionState("idle")}
          className="cursor-pointer text-[11px] font-medium text-[var(--status-flagged)] hover:underline"
        >
          Didn&rsquo;t confirm — retry
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            // Stopped so this doesn't also bubble up and close the Remote
            // Control modal this is nested inside.
            e.stopPropagation();
            close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-[420px] max-h-[85vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="text-[16px] font-semibold text-[var(--ink)]">
              {modalTitle}
            </h2>
            <div className="mt-4 flex gap-4">
              <label className="flex-1">
                <span className="block text-[12px] font-medium text-[var(--ink-muted)]">
                  Brightness ({brightness})
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="mt-1.5 w-full"
                />
              </label>
              <label className="flex-1">
                <span className="block text-[12px] font-medium text-[var(--ink-muted)]">
                  Time (seconds)
                </span>
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={time}
                  onChange={(e) => setTime(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[13px] text-[var(--ink)]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || cooldownRemaining > 0 || nothingSelected}
              className="mt-4 w-full cursor-pointer rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buttonLabel}
            </button>
            {submitResult && (
              <p
                className={`mt-2 text-[11.5px] ${
                  submitResult.ok ? "text-[var(--status-active)]" : "text-[var(--status-flagged)]"
                }`}
              >
                {submitResult.message}
              </p>
            )}

            <p className="mt-5 text-[12px] font-medium text-[var(--ink-muted)]">
              {pluralize(affectedPoles.length, "pole", "poles")} affected
            </p>
            <div className="relative mt-2">
              <div
                ref={listRef}
                onScroll={updateScrollHints}
                className="max-h-[240px] overflow-y-auto rounded-md border border-[var(--border)]"
              >
                <table className="w-full border-collapse text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)] text-[10.5px] uppercase tracking-wide text-[var(--ink-muted)]">
                      <th className="py-1.5 pl-3 pr-3 font-medium">Gateway</th>
                      <th className="py-1.5 pr-3 font-medium">Pole Number</th>
                      <th className="py-1.5 pr-3 font-medium">Selected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affectedPoles.map((pole, i) => {
                      const isSelected = selected.has(pole.poleNumber);
                      return (
                        <tr
                          key={`${pole.gatewayName}-${pole.poleNumber}-${i}`}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="py-1.5 pl-3 pr-3 text-[var(--ink)]">
                            {pole.gatewayName}
                          </td>
                          <td className="py-1.5 pr-3 font-mono-data text-[var(--ink)]">
                            {pole.poleNumber}
                          </td>
                          <td className="py-1.5 pr-3">
                            <label className="relative inline-flex h-4 w-7 cursor-pointer items-center">
                              <input
                                type="checkbox"
                                role="switch"
                                aria-checked={isSelected}
                                aria-label={`Include ${pole.poleNumber} in this action`}
                                checked={isSelected}
                                onChange={() => toggleSelected(pole.poleNumber)}
                                className="peer sr-only"
                              />
                              <span className="h-4 w-7 rounded-full bg-[var(--surface-sunken)] transition-colors peer-checked:bg-[var(--accent)]" />
                              <span className="pointer-events-none absolute left-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canScrollUp && <ScrollHint direction="up" />}
              {canScrollDown && <ScrollHint direction="down" />}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="cursor-pointer rounded-md border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The "cool indicator" — a small glowing bulb next to a pole's name. Amber
 * with a soft glow when on (echoing an actual lit streetlight), a plain
 * gray dot when off, and a pulsing neutral dot while status is still
 * loading. Color is never the only signal — the ON/OFF/… text label is
 * always there too.
 */
function LampIndicator({ status }: { status: "loading" | "on" | "off" | "unknown" }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--ink-faint)]">
        <span
          className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--ink-faint)]"
          aria-hidden="true"
        />
        …
      </span>
    );
  }
  if (status === "unknown") {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--ink-faint)]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--ink-faint)]" aria-hidden="true" />
        —
      </span>
    );
  }
  const isOn = status === "on";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
        isOn ? "bg-[#fef3c7] text-[#92400e]" : "bg-[var(--surface-sunken)] text-[var(--ink-faint)]"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          isOn
            ? "bg-[#f59e0b] shadow-[0_0_8px_2px_rgba(245,158,11,0.65)]"
            : "bg-[var(--ink-faint)]"
        }`}
        aria-hidden="true"
      />
      {isOn ? "ON" : "OFF"}
    </span>
  );
}

/** Loading/on/off/unknown status for one product, given the fetched status map (keyed by ProvidedProductId). */
function lampStatusFor(
  lampStatusById: Record<string, LeadsunLampStatus> | null,
  hasError: boolean,
  productId: string,
): "loading" | "on" | "off" | "unknown" {
  if (hasError) return "unknown";
  if (lampStatusById === null) return "loading";
  const lamp = lampStatusById[productId];
  if (!lamp) return "unknown";
  return isLampOn(lamp) ? "on" : "off";
}

/** Shown when opened from a project (or a pole row within a project's pole list) with no single pole in context — the full gateway/pole breakdown. */
function ProjectRemoteControlContent({
  leadsunProject,
  projectId,
  lampStatusById,
  errorDetail,
  onActionSubmitted,
}: {
  leadsunProject: LeadsunProject;
  projectId: string;
  lampStatusById: Record<string, LeadsunLampStatus> | null;
  errorDetail: string | null;
  onActionSubmitted: () => void;
}) {
  return (
    <>
      <h2 id="remote-control-title" className="text-[16px] font-semibold text-[var(--ink)]">
        {leadsunProject.ProjectName}
      </h2>
      <div className="mt-1 flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
        {pluralize(leadsunProject.totalGateways, "Gateway", "Gateways")} ·{" "}
        {pluralize(leadsunProject.totalPoles, "Light", "Lights")}
        <ControlActionLink
          triggerLabel="Project Control"
          modalTitle="Project Remote Control"
          scope={{ projectId }}
          leadsunProjectId={leadsunProject.ProjectId}
          affectedPoles={leadsunProject.groups.flatMap((group) =>
            group.products.map((product) => ({
              gatewayName: group.GroupName,
              poleNumber: product.PoleNumber,
              providedProductId: product.ProvidedProductId,
              leadsunProductName: product.ProductName,
            })),
          )}
          onActionSubmitted={onActionSubmitted}
          className="cursor-pointer text-[12px] font-medium text-[var(--accent)] hover:underline"
        />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {leadsunProject.groups.map((group) => (
          <div
            key={group.GroupId}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-3"
          >
            <p className="text-[13px] font-semibold text-[var(--ink)]">{group.GroupName}</p>
            <p className="mt-0.5 font-mono-data text-[11px] text-[var(--ink-faint)]">
              {group.GatewayCode}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11.5px] text-[var(--ink-muted)]">
              {pluralize(group.totalPoles, "Light", "Lights")}
              <ControlActionLink
                triggerLabel="Gateway Control"
                modalTitle="Gateway Remote Control"
                scope={{ gatewayCode: group.GatewayCode }}
                leadsunProjectId={leadsunProject.ProjectId}
                affectedPoles={group.products.map((product) => ({
                  gatewayName: group.GroupName,
                  poleNumber: product.PoleNumber,
                  providedProductId: product.ProvidedProductId,
                  leadsunProductName: product.ProductName,
                }))}
                onActionSubmitted={onActionSubmitted}
              />
            </div>
            <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-2">
              {group.products.map((product) => (
                <div key={product.ProductId} className="text-[11.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--ink)]">{product.ProductName}</p>
                    <div className="flex items-center gap-2">
                      <LampIndicator
                        status={lampStatusFor(
                          lampStatusById,
                          errorDetail !== null,
                          product.ProvidedProductId,
                        )}
                      />
                      <ControlActionLink
                        triggerLabel="Control"
                        modalTitle="Light Remote Control"
                        scope={{ poleNumber: product.ProductName }}
                        leadsunProjectId={leadsunProject.ProjectId}
                        affectedPoles={[
                          {
                            gatewayName: group.GroupName,
                            poleNumber: product.PoleNumber,
                            providedProductId: product.ProvidedProductId,
                            leadsunProductName: product.ProductName,
                          },
                        ]}
                        onActionSubmitted={onActionSubmitted}
                      />
                    </div>
                  </div>
                  <p className="font-mono-data text-[var(--ink-faint)]">
                    {product.ProvidedProductId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {errorDetail !== null && (
        <p className="mt-3 text-[11.5px] text-[var(--status-flagged)]">
          Couldn&rsquo;t load live ON/OFF status. ({errorDetail})
        </p>
      )}
    </>
  );
}

/** Shown when opened from a single pole (project's pole list row, or the pole detail page) — just that pole's own product. */
function PoleRemoteControlContent({
  product,
  gatewayName,
  leadsunProjectId,
  lampStatusById,
  errorDetail,
  onActionSubmitted,
}: {
  product: LeadsunProduct;
  gatewayName: string;
  leadsunProjectId: string;
  lampStatusById: Record<string, LeadsunLampStatus> | null;
  errorDetail: string | null;
  onActionSubmitted: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 id="remote-control-title" className="text-[16px] font-semibold text-[var(--ink)]">
          {product.ProductName}
        </h2>
        <div className="flex items-center gap-2">
          <LampIndicator
            status={lampStatusFor(lampStatusById, errorDetail !== null, product.ProvidedProductId)}
          />
          <ControlActionLink
            triggerLabel="Control"
            modalTitle="Light Remote Control"
            scope={{ poleNumber: product.ProductName }}
            leadsunProjectId={leadsunProjectId}
            affectedPoles={[
              {
                gatewayName,
                poleNumber: product.PoleNumber,
                providedProductId: product.ProvidedProductId,
                leadsunProductName: product.ProductName,
              },
            ]}
            onActionSubmitted={onActionSubmitted}
          />
        </div>
      </div>
      <p className="mt-1 font-mono-data text-[13px] text-[var(--ink-muted)]">
        {product.ProvidedProductId}
      </p>
      {errorDetail !== null && (
        <p className="mt-3 text-[11.5px] text-[var(--status-flagged)]">
          Couldn&rsquo;t load live ON/OFF status. ({errorDetail})
        </p>
      )}
    </>
  );
}

type RemoteControlLinkProps = {
  className?: string;
  /** Our own internal Project.id ("rec..."), used for the project-level control action — separate from leadsunProject's own numeric ProjectId. */
  projectId: string;
  leadsunProject: LeadsunProject;
} & ({ product?: undefined } | { product: LeadsunProduct });

/**
 * A "Remote Control" link that opens a modal showing the relevant Leadsun
 * gateway/pole info, plus each pole's live ON/OFF status — from a project,
 * the full gateway/pole breakdown; from a single pole, just that pole's
 * own product. Live status is fetched fresh each time the modal opens
 * (not cached), from GET /api/leadsunlampstatus, which proxies to
 * Leadsun's own status API server-side (it requires a client TLS
 * certificate the browser can't present itself). The modal also has
 * "Project Control"/"Gateway Control"/"Control" links at each level, each
 * opening its own Remote Control modal with a Brightness/Time form that
 * posts to /api/setpolelights — on success, live status here is
 * refreshed once ControlActionLink's own polling confirms the change.
 */
export function RemoteControlLink({
  className,
  projectId,
  leadsunProject,
  product,
}: RemoteControlLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lampStatusById, setLampStatusById] = useState<Record<string, LeadsunLampStatus> | null>(
    null,
  );
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  // Bumped after a successful control action (once the 5s delay elapses)
  // to re-run the status-fetch effect below and pick up the new state.
  const [refreshCount, setRefreshCount] = useState(0);
  // Leadsun's status API keys "productId" by ProvidedProductId (e.g.
  // "AEXSAM2324122936"), not the small numeric ProductId — confirmed by
  // the sample response's own productId field, which is in that format.
  const providedProductId = product?.ProvidedProductId;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    // Resetting to "loading" at the start of a fetch effect is React's own
    // documented pattern (react.dev/learn/synchronizing-with-effects —
    // "Fetching data"), so the modal doesn't briefly show the previous
    // pole/project's stale status before this fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLampStatusById(null);
    setErrorDetail(null);

    const query = new URLSearchParams({ projectId: leadsunProject.ProjectId });
    if (providedProductId !== undefined) query.set("productId", providedProductId);

    fetch(`/api/leadsunlampstatus?${query.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || body?.error || `request failed (${res.status})`);
        }
        return res.json();
      })
      .then((lamps: LeadsunLampStatus[]) => {
        if (cancelled) return;
        setLampStatusById(Object.fromEntries(lamps.map((lamp) => [lamp.productId, lamp])));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorDetail(err instanceof Error ? err.message : "unknown error");
        setLampStatusById({});
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, leadsunProject.ProjectId, providedProductId, refreshCount]);

  function close() {
    setIsOpen(false);
  }

  function handleActionSubmitted() {
    setRefreshCount((count) => count + 1);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ??
          "cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--accent)] hover:bg-[var(--surface-sunken)]"
        }
      >
        Remote Control
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remote-control-title"
            className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg ${
              product ? "max-w-[420px]" : "max-w-4xl max-h-[85vh] overflow-y-auto"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {product ? (
              <PoleRemoteControlContent
                product={product}
                gatewayName={findLeadsunGroupForProduct(leadsunProject, product)?.GroupName ?? ""}
                leadsunProjectId={leadsunProject.ProjectId}
                lampStatusById={lampStatusById}
                errorDetail={errorDetail}
                onActionSubmitted={handleActionSubmitted}
              />
            ) : (
              <ProjectRemoteControlContent
                leadsunProject={leadsunProject}
                projectId={projectId}
                lampStatusById={lampStatusById}
                errorDetail={errorDetail}
                onActionSubmitted={handleActionSubmitted}
              />
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="cursor-pointer rounded-md border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

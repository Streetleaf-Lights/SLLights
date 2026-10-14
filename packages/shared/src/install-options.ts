import type { InstallOptionsResponse } from "./api-contract";

export type InstallProjectOption = InstallOptionsResponse["projects"][number];

/** A submitted sticker's identity: its project and sticker number. */
export const stickerKey = (projectId: string, sticker: string) => `${projectId}::${sticker.trim().toUpperCase()}`;

/**
 * What the Install form still offers: each project's stickers minus those
 * already submitted from this phone (waiting to send or sent), and projects
 * with none left dropped — so the same pole can't be submitted twice.
 */
export function remainingInstallOptions(
  projects: readonly InstallProjectOption[],
  submitted: ReadonlySet<string>,
): InstallProjectOption[] {
  return projects
    .map((p) => ({ ...p, stickerNumbers: p.stickerNumbers.filter((s) => !submitted.has(stickerKey(p.id, s))) }))
    .filter((p) => p.stickerNumbers.length > 0);
}

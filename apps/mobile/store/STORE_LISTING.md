# Streetleaf Lights — store listing & privacy answers (draft)

Draft content for App Store Connect and Google Play Console, based on what the
app actually does. Items marked **TODO** need a decision or a URL from Streetleaf.

---

## Listing text

| Field | Limit | Draft |
| --- | --- | --- |
| App name | 30 (Apple) / 30 (Google) | `Streetleaf Lights` |
| Subtitle (Apple) | 30 | `Light Dashboard` |
| Short description (Google) | 80 | `Monitor and manage your Streetleaf lighting projects.` |
| Keywords (Apple) | 100 | `streetlight,solar,lighting,poles,monitoring,outdoor lighting` |
| Category | — | Primary: **Business** · Secondary (Apple): **Utilities** |
| Age rating | — | Apple **4+** · Google **Everyone** (no objectionable content, no user-to-user content) |
| Price | — | Free, no in-app purchases |

### Description (Apple & Google, up to 4,000 characters)

> Streetleaf Lights is the companion app to the Streetleaf dashboard, for Streetleaf
> customers.
>
> **For field crews**
> - Record a pole installation in seconds: pick the project and pole sticker, scan the
>   solar panel and light head barcodes, and the location is captured automatically.
> - Works without signal. Installs are saved on the phone and sent automatically when
>   you're back online.
> - Each project's remaining poles are listed, so the same pole isn't recorded twice.
>
> **For customers and Streetleaf staff**
> - See your projects and every light's status: connection, battery, panel and light output.
> - Review 48-hour vitals history, open issues and each pole's location on a map.
> - Report an issue on a pole straight from the field.
>
> An account is required. Accounts are created by invitation from Streetleaf or your
> organisation's administrator.

**TODO** — Support URL, marketing URL (optional), and support email.

---

## Required URLs

- **Privacy policy URL — TODO (required by both stores).** It should cover: account email
  and name; precise location recorded with each installation; installation details
  (serial numbers, pole number, notes); camera use for barcode scanning only (no images
  stored or sent); who processes the data (Streetleaf's systems, Airtable, Microsoft Azure);
  retention; and how to request account deletion.
- **Account deletion — TODO.** Both stores expect a way to request deletion of an account.
  Accounts are created by invitation, and admins can delete users in the app, but a
  user can't delete their own account. Provide at least a web page or email address for
  deletion requests (Google asks for the URL in the Data safety form). An in-app
  "Request account deletion" link can be added if reviewers ask for it.

---

## Apple — App Privacy ("Data collected from this app")

Tracking: **No** (no data is used for tracking or shared with data brokers; no advertising).

| Data type | Collected | Linked to user | Used for tracking | Purposes |
| --- | --- | --- | --- | --- |
| Contact Info → **Email Address** | Yes — sign-in; admins enter invitees' emails | Yes | No | App Functionality |
| Contact Info → **Name** | Yes — admins enter invitees' names | Yes | No | App Functionality |
| Identifiers → **User ID** | Yes — the signed-in account | Yes | No | App Functionality |
| Location → **Precise Location** | Yes — recorded with each installation | Yes (Installed By) | No | App Functionality |
| User Content → **Other User Content** | Yes — serial numbers, pole number, notes, issue reports | Yes | No | App Functionality |

Not collected: photos/videos (the camera reads barcodes; no images are kept or sent),
contacts, browsing/search history, diagnostics, usage data, financial or health data.

---

## Google Play — Data safety

- Does the app collect or share user data? **Yes, collects.** Shared with third parties:
  **No** (Airtable and Azure act as service providers, which Google doesn't count as sharing).
- Is data encrypted in transit? **Yes** (HTTPS only).
- Can users request deletion? **Yes** — via the account deletion URL above (**TODO**).

| Category → type | Collected | Optional? | Purposes |
| --- | --- | --- | --- |
| Personal info → **Name** | Yes | Required for invited users | App functionality, Account management |
| Personal info → **Email address** | Yes | Required | App functionality, Account management |
| Personal info → **User IDs** | Yes | Required | App functionality, Account management |
| Location → **Precise location** | Yes | Required for installs | App functionality |
| App activity → **Other user-generated content** | Yes | Required for installs (notes optional) | App functionality |

Data is processed to provide the service and is not processed ephemerally (installs are
stored in Streetleaf's records).

---

## Permissions — what the user sees and why

| Permission | Prompt text (from app.json) | When it's asked |
| --- | --- | --- |
| Camera | "Streetleaf Lights uses the camera to scan pole tags." | The first time Scan is tapped on the Install screen |
| Location (while using) | "Streetleaf Lights records where a pole was installed when you confirm an install." | When the Install screen opens |

The app does not request background location, contacts, photos, notifications or tracking.

---

## Export compliance

The app uses only standard HTTPS. `ios.config.usesNonExemptEncryption: false` is set in
`app.json`, so App Store Connect won't ask about encryption on each upload.

---

## Notes for app review (paste into App Store Connect / Play Console)

> Streetleaf Lights is for Streetleaf's field crews and customers; accounts are created by
> invitation, so please use the test account below.
>
> **Test account (Streetleaf Crew):** email **appreviewer@streetleaf.com**, password **Pass.123**
>
> To try the main feature: open the **Install** tab (shown on sign-in), choose the project
> **Streetleaf Dev - SL1 Test (test project name)**, pick any sticker, tap Scan (any barcode works) or "Won't scan?
> Type it instead" for both serial numbers, wait for the location, and tap Submit.
> Installs from this account go to a test project and are cleaned up after review.

**TODO before submitting:**
1. Create the reviewer account (Streetleaf Crew role).
2. Create an **active test project with test sticker numbers** for it, so review installs
   don't touch real projects; clean up its Airtable records after review.
3. Check the account can sign in from outside your network (the release app talks to the
   production server).

---

## Screenshots

- **iPhone:** 6.9" display (e.g. 1320 × 2868) — at least 3. Suggested: Install form, the
  project/sticker list, a pole page (status cards), the vitals chart, the project map.
- **Android phone:** at least 2, 16:9 or 9:16 (e.g. 1080 × 1920 or larger).
- No iPad screenshots are needed: `supportsTablet` is `false` (the app still runs on iPads
  in iPhone mode).
- Use the reviewer/test account so no customer data appears in screenshots.

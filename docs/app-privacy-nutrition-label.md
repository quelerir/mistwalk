# App Store — App Privacy ("nutrition label") answers

Draft answers for the App Privacy questionnaire in App Store Connect. Based on
what the app actually collects (see `supabase/migrations/`, `AppMenu.tsx`,
`backgroundLocationTask.ts`) — no third-party analytics, ads, or crash-reporting
SDKs are integrated (checked `package.json`, no Sentry/Firebase/Amplitude/etc).

## Data types collected

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| **Precise Location** | Yes | Yes | No | App Functionality (core fog-reveal mechanic) |
| **Contact Info — Email Address** | Yes | Yes | No | App Functionality (account), Other (support replies) |
| **Contact Info — Name** | Yes (first/last name at sign-up) | Yes | No | App Functionality (account) |
| **User Content — Photos** | Yes (optional avatar) | Yes | No | App Functionality |
| **User Content — Other User Content** | Yes (username/display name, feedback messages) | Yes | No | App Functionality, Customer Support |
| **Identifiers — User ID** | Yes (Supabase auth UUID) | Yes | No | App Functionality |
| **Usage Data** | No | — | — | — |
| **Diagnostics** | No | — | — | — |
| **Purchases** | No | — | — | — |
| **Financial Info** | No | — | — | — |
| **Contacts** | No | — | — | — |
| **Search History** | No | — | — | — |
| **Browsing History** | No | — | — | — |
| **Identifiers — Device ID / Advertising ID** | No | — | — | — |

## "Data Used to Track You"

Answer **No** — the app does not track users across other companies' apps/websites
for advertising, and does not use IDFA or any third-party ad/analytics SDK.

## Data linked to the user's identity

All of the above (location, email, name, avatar, username, feedback) is linked
to the account, since it's stored keyed by the Supabase user ID and tied to a
public or private profile. None of it is anonymized/aggregated before storage.

## Notes for filling the actual form

- Precise Location: also collected "while app is in background" — App Store
  Connect will ask this as a follow-up; answer Yes, and reference the App
  Review notes (`docs/app-review-notes-location.md`) for the justification text.
- Data retention: tied to account lifetime; deleted immediately and completely
  when the user deletes their account in-app (see the `delete-account` Edge
  Function) — worth stating this explicitly if the form has a free-text field
  for retention/deletion policy.
- No data is sold or shared with third parties (no data broker, ad network, or
  analytics vendor receives any of this) — Supabase is a processor (hosting),
  not a third party the data is "shared" with in Apple's sense.

# Google Play — Data Safety form answers

Draft answers for the Data Safety section in Google Play Console. Mirrors the
App Store App Privacy answers (`docs/app-privacy-nutrition-label.md`) — same
underlying data collection, different form shape.

## Does your app collect or share any of the required user data types?

**Yes.**

## Data types

| Category | Type | Collected | Shared with third parties | Ephemeral (not stored) | Purpose(s) |
|---|---|---|---|---|---|
| Location | Approximate location | No | No | No | — |
| Location | Precise location | Yes | No | No | App functionality (core fog-reveal mechanic; also used in background) |
| Personal info | Name | Yes | No | No | App functionality, Account management |
| Personal info | Email address | Yes | No | No | App functionality, Account management |
| Personal info | User IDs | Yes | No | No | App functionality |
| Photos and videos | Photos | Yes (optional avatar) | No | No | App functionality |
| App activity | Other user-generated content | Yes (username/display name, feedback text) | No | No | App functionality, Customer support |
| App activity | App interactions | No | — | — | — |
| Financial info | (all) | No | — | — | — |
| Health and fitness | (all) | No | — | — | — |
| Messages | (all) | No | — | — | — |
| Web browsing | (all) | No | — | — | — |
| Identifiers | Device or other IDs | No | — | — | — |

## Is all of the user data collected by your app encrypted in transit?

**Yes** — all traffic goes over HTTPS/TLS to Supabase.

## Do you provide a way for users to request that their data is deleted?

**Yes** — in-app self-service: Menu → Account → "Удалить аккаунт" (Delete
account), which deletes the auth user and cascades deletion across all
related tables (visited points, discovered places, follows, feedback) plus
the avatar file, immediately, no waiting period. Also mention the support
email (quelerir@gmail.com) as a fallback contact for data requests.

## Data collection is required or optional

- Precise location: **required** (core mechanic won't function without it —
  though the app can run in a reduced/foreground-only mode with just "While
  Using" permission instead of "Always").
  Email/name/username: **required** at account creation.
  Avatar photo: **optional**.

## Notes for filling the actual form

- Google's form asks separately about "shared" vs "collected" — nothing here
  is shared with third parties; Supabase is the hosting/processing backend,
  not a third party in Google's data-sharing sense (no ad network, no data
  broker, no analytics vendor).
- No ads SDK, no analytics SDK, no crash reporting SDK is integrated
  (verified via `package.json` — no Firebase/Amplitude/Segment/Sentry/etc).
- Background location collection needs its own separate declaration in Play
  Console (Play Console → App content → Background location) — see
  `docs/google-play-background-location.md`.

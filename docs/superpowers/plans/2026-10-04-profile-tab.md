# Profile Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last tab opens on the person's profile (header with photo, name, followers and following, then the collection); the old menu moves behind a burger button on a page inside the tab.

**Architecture:** A new `ProfileScreen` shows the header and the body (`CollectionContent`, extracted from `CollectionScreen`). It keeps a view state; the burger swaps the profile for the menu page, which it gets from `MainScreen` as a render prop (`AppMenu` with a "Back" row). `AppMenu` loses its Account page and the Collection item. The old Collection modal in `MainScreen` stays only for the nested screens.

**Tech Stack:** Expo SDK 55, React Native 0.83, Jest + `@testing-library/react-native`. Read `AGENTS.md` (Expo docs) before touching Expo APIs; this plan uses none.

**Spec:** `docs/superpowers/specs/2026-10-04-profile-tab-design.md`

## Global Constraints

- Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts` (the dictionary test enforces parity); colours and fonts from the theme (`useStyles`, `FONT`), as the neighbouring screens do.
- The burger opens a page inside the tab, never a sheet or a `Modal`. The tab bar stays visible.
- No new server calls; no new dependencies.
- Full test command (jest also scans the sibling checkout): `npx jest --testPathIgnorePatterns .worktrees`. Type check: `npx tsc --noEmit`.
- In Jest, mock what Jest cannot load, exactly as `src/components/AppMenu.test.tsx` does: `jest.mock('./icons/SvgIcon', () => () => null)`, `jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }))` and the safe-area mock.
- Work on branch `profile-tab`. `node_modules` is not installed: run `npm ci --ignore-scripts` first, and `npx patch-package` is not needed for the tests.
- One commit per task, ending with the `Co-Authored-By` line from the session's attribution reminder.

## Review Focus

- "Back" from every nested screen (followers, rating, countries, a country, another player) lands on the profile, not on the map (Task 4, checked by hand).
- Changing the photo while the profile is shown, with no photo yet, and with a photo; the failure message path (Task 2 test).
- Leaving the tab while the burger page is open, then coming back: the profile is shown, not the menu (Task 2 and Task 4).
- A name that is very long, and an empty name while the profile loads (Task 2 test: shows the fallback text, cut to one line).
- The rating switch while its value is unknown (`null`): shows `…` and does nothing when pressed (Task 3 test).

---

### Task 1: Extract `CollectionContent`

**Files:**
- Create: `src/screens/CollectionContent.tsx`, `src/screens/CollectionContent.test.tsx`
- Modify: `src/screens/CollectionScreen.tsx` (renders `CollectionContent` for its tiles, week block and the two cards)

**Interfaces:**
- Produces: `default function CollectionContent(props: { stats: Stats; week: WeekSummary; daily: number[]; countries: CountryStat[]; onOpenCountries: () => void; onOpenLeaderboard: () => void }): JSX.Element` — a plain `View` (no `ScrollView`, no title, no back button, no follower counters, no safe-area padding) with the tiles (distance, places found), the week card with the 7 bars, the Countries card and the Rating card. Texts and styles are the ones `CollectionScreen` uses now (`collection.*` keys).

- [ ] **Step 1: Write the failing test** `CollectionContent.test.tsx` with a small `stats`, `week` (`{ km: 3.2, places: 2, days: 4, prev: { km: 1, places: 1, days: 2 } }`), `daily` of 7 numbers and two countries (one with `percent: 0`). Tests: `shows the distance and the places found` (`'12.5'` for `distanceKm: 12.5`, and the count); `shows the week numbers`; `pressing the Countries card calls onOpenCountries`; `pressing the Rating card calls onOpenLeaderboard`; `counts only countries with a percent above zero in the Countries card` (text contains `1` of `2`, in either language).
- [ ] **Step 2: Run** `npx jest src/screens/CollectionContent.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `CollectionContent` by moving the code of tiles, week and the two cards out of `CollectionScreen.tsx` (with their styles, `delta`, `WEEKDAY_KEYS`, `BAR_MAX_HEIGHT`). `CollectionScreen` keeps its header, follower row and `ScrollView` and renders `<CollectionContent ... />` for the rest.
- [ ] **Step 4: Run** `npx jest --testPathIgnorePatterns .worktrees` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** `refactor: extract CollectionContent from CollectionScreen`.

### Task 2: `ProfileScreen`

**Files:**
- Create: `src/screens/ProfileScreen.tsx`, `src/screens/ProfileScreen.test.tsx`
- Modify: `src/i18n/ru.ts`, `src/i18n/en.ts`

**Interfaces:**
- Consumes: `CollectionContent` (Task 1), `Avatar` (`src/components/Avatar.tsx`, props `{ uri, name, size }`), `SvgIcon` name `'menu'`.
- Produces: `default function ProfileScreen(props: ProfileScreenProps)` with
  `ProfileScreenProps = { displayName: string; avatarUri: string | null; stats: Stats; week: WeekSummary; daily: number[]; countries: CountryStat[]; followCounts: { followers: number; following: number } | null; onOpenCountries: () => void; onOpenLeaderboard: () => void; onOpenFollows: (tab: 'followers' | 'following') => void; onChangeAvatar: () => Promise<string | null>; onRemoveAvatar: () => Promise<void>; renderMenu: (close: () => void) => React.ReactNode }`.
  testIDs: `profile-burger`, `profile-avatar`, `profile-followers`, `profile-following`. i18n keys (ru and en): `tab.profile` ("Профиль" / "Profile"), `profile.menu` (burger label, "Меню" / "Menu"), `profile.photoTitle`, `profile.choosePhoto`, `profile.removePhoto`.

- [ ] **Step 1: Write the failing tests** (mock `Alert.alert` to capture its buttons; `renderMenu` returns `<Text>menu page</Text>` and a pressable calling `close`): `shows the name and both counters` (`followCounts` 3 and 5; shows `–` when `null`); `pressing a counter calls onOpenFollows with its tab`; `the burger shows the menu page and close returns to the profile`; `pressing the avatar offers "Choose photo" and "Cancel" when there is no photo, and also "Remove photo" when there is one`; `choosing "Choose photo" calls onChangeAvatar and shows the message it returns`; `choosing "Remove photo" calls onRemoveAvatar, and a rejection shows the removal-failed message` (reuse `menu.removePhotoFailed`); `an empty displayName renders without crashing`.
- [ ] **Step 2: Run** `npx jest src/screens/ProfileScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `ProfileScreen`: a `ScrollView` with the top bar (burger `Pressable`, `SvgIcon name="menu"`, right aligned, `paddingTop` = safe-area top + 12), the header (`Avatar` size 92 inside a `Pressable`, name `numberOfLines={1}`, two counter `Pressable`s with the `collection.followers`/`collection.following` labels and `collection.followersLabel`/`collection.followingLabel` accessibility labels), a note line for the last photo message, and `<CollectionContent />`. State: `menuOpen: boolean`. When `menuOpen`, render `props.renderMenu(() => setMenuOpen(false))` instead. Add the new i18n keys.
- [ ] **Step 4: Run** the full suite and `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add ProfileScreen`.

### Task 3: Flatten `AppMenu`

**Files:**
- Modify: `src/components/AppMenu.tsx`, `src/components/AppMenu.test.tsx`, `src/i18n/ru.ts`, `src/i18n/en.ts`

**Interfaces:**
- Consumes: `MenuScreen` (unchanged).
- Produces: `AppMenuProps` without `onOpenCollection`, `avatarUri`, `displayName`, `onChangeAvatar`, `onRemoveAvatar`; with a new optional `onBack?: () => void`. The main page items, in order: `back` (only when `onBack` is given; label `common.back`, icon `back`), `email` (icon `user`, label the email or `menu.noEmail`, no action), `settings`, `feedback`, `rating` (label `menu.inRating`, a switch via `on: leaderboardVisible === true`, or `value: '…'` and no action while `leaderboardVisible` is `null`), `blocked`, `privacyPolicy`, `termsOfUse`, `signout` (destructive), `deleteAccount` (destructive, existing confirmation). The `account` page and its header (avatar, note) are removed.

- [ ] **Step 1: Rewrite the tests** in `AppMenu.test.tsx` (the props helper loses the removed props and gains none): `lists the items in this order` (labels matched in both languages: email, Settings, Feedback, rating, Blocked, Privacy Policy, Terms of Use, Sign out, Delete account); `there is no Account and no Collection item`; `opens the privacy policy and the terms of use in the browser` (keep); `the rating row is a switch and pressing it calls onLeaderboardVisibleChange with the opposite value`; `while the rating is unknown it shows … and pressing does nothing`; `a Back row appears only when onBack is given and calls it`; `Blocked calls onOpenBlocked`.
- [ ] **Step 2: Run** `npx jest src/components/AppMenu.test.tsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the flattening in `AppMenu.tsx` (keep settings, language and feedback pages and their state; delete `accountItems`, the account header, `note` state if nothing else uses it, the `Avatar` import, the `closeThen`/`leaveThen` use that only the removed items needed). Remove the i18n keys `menu.account`, `menu.collection`, `menu.changePhoto`, `menu.addPhoto` when nothing uses them (keep `menu.removePhoto` and `menu.removePhotoFailed`: Task 2 uses them).
- [ ] **Step 4: Keep `MainScreen.tsx` compiling:** delete the removed props (`onOpenCollection`, `avatarUri`, `displayName`, `onChangeAvatar`, `onRemoveAvatar`) from the `<AppMenu>` call only; nothing else in `MainScreen` changes here. For this one commit the old menu tab has no Collection item and no photo action; Task 4 restores both through the profile. Run the full suite and `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor: flatten the app menu (no Account page, no Collection item)`.

### Task 4: Wire it into `MainScreen`, delete `CollectionScreen`

**Files:**
- Modify: `src/screens/MainScreen.tsx`, `src/i18n/ru.ts`, `src/i18n/en.ts`
- Delete: `src/screens/CollectionScreen.tsx`

**Interfaces:**
- Consumes: `ProfileScreen` (Task 2), `AppMenu` with `onBack` (Task 3).
- Produces: tab key `'profile'` (was `'menu'`), label key `tab.profile`, icon `'user'` (the photo still replaces it when there is one).

- [ ] **Step 1: Edit `MainScreen.tsx`:** `TabKey` and `TABS` use `profile`; the `tabs` memo puts `photoUri` on `profile`; the offline-map-size effect reads `tab !== 'profile'`; the `tab === 'menu'` block becomes `<ProfileScreen ... renderMenu={(close) => <AppMenu ... onBack={close} />} />` with the props from the spec's Data section (`displayName={profileSync.profile?.displayName ?? email}`, `onChangeAvatar={handleChangeAvatar}`, `onRemoveAvatar={profileSync.clearAvatar}`, the stats and the three callbacks; `onOpenFollows` sets `followsTab` and `showFollows`); remove the `showCollection` state, `onOpenCollection`, and make the modal `visible={showFollows || showLeaderboard || showCountries}` with its last branch (the `CollectionScreen`) removed; `handleCloseCollection` becomes `closeProfileOverlays` (same resets without `showCollection`) and keeps serving `onSelectHidden`. Remove the `CollectionScreen` import and file; remove i18n `tab.menu` and `collection.title` if unused.
- [ ] **Step 2: Run** `npx tsc --noEmit` (expected: no errors) and the full suite (expected: PASS, including the i18n parity test).
- [ ] **Step 3: Commit** `feat: the last tab is the profile, the menu is behind a burger`.

### Task 5: Check in the simulator, then finish

**Files:** none (verification). Install dependencies and run Metro with a `.claude/launch.json` and the `.env` copied from `.worktrees/mistwalk`, as in earlier sessions (all git-ignored or excluded); remove them afterwards.

- [ ] **Step 1: Run** the app on the iPhone 17 Pro simulator; open the Profile tab: header, counters, tiles, week, Countries, Rating all show; the tab shows the photo or the user icon.
- [ ] **Step 2: Check by hand:** burger opens the menu page and "Back" returns; Settings, language, Feedback and back; the rating switch; Blocked and back; Privacy and Terms open the browser; both counters open their lists and back lands on the profile; Countries, a country, Rating, another player, and back each land on the profile; "select a hidden place" from a country goes to the map; avatar press shows the choices; sign-out confirmation can be cancelled; dark theme, English, and a small screen.
- [ ] **Step 3: Tell the user** what was checked and what was not (screenshots lag by one frame; wait for the second one). Push and merge only when the user says so; then delete the branch.

---

## Self-review notes

- Spec coverage: structure (Tasks 2 and 4), burger page and the dissolved Account page (Task 3), photo via avatar (Task 2), data without new calls (Task 4), i18n (Tasks 2 to 4), testing and manual check (all tasks, Task 5).
- Interface consistency: `renderMenu(close)` in Task 2 matches the `onBack` prop of `AppMenu` in Tasks 3 and 4; the tab key `profile` is used the same way everywhere.

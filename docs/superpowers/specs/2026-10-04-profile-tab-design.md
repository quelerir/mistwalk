# Profile tab instead of the menu list

## Goal

The last tab opens on the person's **profile** (like a profile in Instagram): a header with the photo, the name and the
follower counters, and under it the collection (km, places, countries, the week, the rating). The old menu moves behind
a **burger button in the top right corner**. Later the profile gets a second tab with the person's photos and videos;
this task only prepares the place for it.

## Decisions (agreed with the user, 2026-10-04)

- **Approach A:** a new `ProfileScreen` built from existing pieces. No new server calls.
- **No photo grid yet.** Publishing photos and videos is a later task. Until then the profile shows only the "countries
  and the rest" content, with no tab bar (option 3 of the discussion). The two-tab layout comes with the first
  published photo.
- **The burger opens a full page inside the tab**, not a sheet and not a modal (the user dislikes pop-ups for the menu).
  The tab bar stays visible; the page has a "Back" row.
- **The "Account" page is dissolved.** Its items are spread: photo (tap on the avatar), the rating switch, blocked
  players, sign out and delete account (into the burger list).
- **The "Collection" menu item and the stand-alone Collection screen go away:** the profile is the collection.

## Screens

### Profile (the tab)

`ProfileScreen`, shown by the last tab (key `profile`, label "Профиль" / "Profile"; the tab icon still shows the
person's photo).

- **Top bar:** the burger button on the right (accessibility label "Menu").
- **Header:** avatar (92 px like the player screen), the name (display name; the email while the profile is loading,
  as the menu does today), two counters, followers and following, tappable (they open the same lists as now).
- **Body:** `CollectionContent`, the content of today's Collection screen: the tiles (distance, places found), the week
  block with the 7-day bars, the "Countries" card and the "Players' rating" card.
- Tapping the avatar opens a choice: "Choose photo" and, when there is a photo, "Remove photo", and "Cancel". It uses
  the existing `handleChangeAvatar` and `profileSync.clearAvatar`, with the same messages ("Photo updated", "No access
  to photos", "Could not remove the photo").

### Burger page (inside the tab)

`ProfileScreen` keeps a view state, `'profile'` or `'menu'`. The `'menu'` view renders `AppMenu`'s list as a page with a
"Back" row at the top:

1. The email, grey, not pressable (or "No email").
2. Settings (opens the existing settings page: language, theme, fog, notifications, map and position, ...).
3. Feedback (the existing feedback page).
4. "Visible in the rating" with a switch (today's `leaderboardVisible` setting; shows `…` while unknown or saving).
5. Blocked players (opens the existing blocked screen).
6. Privacy Policy and Terms of Use (open in the browser, as now).
7. Sign out (red) and Delete account (red, with the existing confirmation).

The settings, language and feedback pages stay as sub-pages with their own "Back" rows; "Back" from the first level
returns to the profile.

## Code

- `src/screens/ProfileScreen.tsx` (new): header, top bar, `CollectionContent`, the view state and the burger button.
- `src/screens/CollectionContent.tsx` (new): the body of `CollectionScreen` (tiles, week, countries card, rating
  card), without its own title, "Back" button, follower counters or safe-area padding. `CollectionScreen.tsx` is
  deleted.
- `src/components/AppMenu.tsx`: remove the `account` page and the "Collection" item; the main page becomes the list above
  (rating switch, sign out and delete account are on it). The props `onOpenCollection`, `onChangeAvatar`,
  `onRemoveAvatar` and `avatarUri` leave `AppMenu` (the photo is handled by the profile).
- `src/components/MenuScreen.tsx`: unchanged.
- `src/screens/MainScreen.tsx`: tab key `menu` becomes `profile`; the `tab === 'menu'` block renders `ProfileScreen`;
  the Collection modal stays only for the nested screens (followers and following list, rating, countries, a country,
  another player) and is visible when one of them is open; `showCollection` and `handleCloseCollection` go away.
  Leaving the tab closes the burger view (the component is unmounted when the tab is left, as the menu is today).
- i18n (`ru.ts` and `en.ts`): add `tab.profile`, the burger label, the avatar choices, the profile header texts; remove
  `tab.menu`, `collection.title`, `menu.collection`, `menu.account` when nothing uses them.

## Data

No new queries. `ProfileScreen` receives from `MainScreen` what `CollectionScreen` and `AppMenu` get today: `stats`,
`week`, `daily`, `countries`, `followCounts`, the display name, the avatar uri, the email, `leaderboardVisible` and its
setter, and the callbacks (open countries, rating, followers or following, blocked, sign out, delete account, avatar,
settings props).

## Behaviour and edge cases

- Leaving the tab resets the profile to its main view (the burger page closes).
- Opening the rating, the countries, the followers or another player from the profile shows the existing screens in the
  modal; "Back" returns to the profile.
- Changing the photo: the system picker needs no special handling now that nothing is a modal sheet.
- A person with no photo sees the initial letter avatar (`Avatar` already does this).
- Long names are cut to one line in the header.
- Small screens: the profile scrolls; the burger button stays in the top bar.

## Out of scope

- Publishing, storing, moderating and showing photos and videos, and the photo tab.
- Editing the name or a bio; showing the private first and last name.
- Any change to the settings page, the fog, the map or the other tabs.

## Testing

Tests first, watched failing, then the code.

- `CollectionContent.test.tsx`: the tiles show the distance and the places found; the week block shows the three
  numbers; "Countries" and "Rating" call their callbacks.
- `ProfileScreen.test.tsx`: shows the name and both counters; pressing a counter calls `onOpenFollows` with the right
  tab; the burger switches to the menu page and "Back" returns; pressing the avatar shows the photo choices, with
  "Remove photo" only when there is a photo.
- `AppMenu.test.tsx`: the main page lists Settings, Feedback, rating, Blocked, Privacy, Terms, Sign out, Delete account
  in that order; the policy and terms open the right addresses; there is no "Account" and no "Collection" item; the
  rating switch calls `onLeaderboardVisibleChange` with the opposite value.
- The i18n parity test keeps ru and en in step.
- By hand in the iOS simulator: profile, burger and back, both counters and their lists, Countries and Rating and back,
  change and remove the photo, the rating switch, sign out cancel, both themes, both languages, a small screen.

## Risks

- The Collection modal logic in `MainScreen` is tangled (flags for each nested screen); the change must keep "Back"
  from every nested screen landing on the profile, not on the map. Covered by the manual check.

# Google Play — Background Location justification

Draft text for Play Console → App content → "Background location" declaration
form (required because the app requests `ACCESS_BACKGROUND_LOCATION`).

## What is the core functionality that requires background location access?

```
Mistwalk is a "fog of war" exploration map: the map starts covered in fog,
and areas are permanently revealed as the user physically travels through
them in real life. This is the app's entire core purpose, not an add-on
feature.

Background location access lets the app keep revealing the map while it is
not in the foreground — e.g. while the user is walking with their phone in
a pocket, or driving with the screen off. Without background access, any
part of a walk taken without the app open on-screen would be permanently
lost and never appear on the user's map, defeating the app's purpose.

Background location is also used to:
- Send a local notification when the user passes near a point of interest
  they have not yet discovered, so they can go find it without keeping the
  app open.
- Build a weekly summary of distance travelled and new area revealed.

The user must explicitly grant Android's background location permission
(a separate, more restrictive OS-level flow than foreground location) before
any background tracking starts. Declining it does not block the app — the
user can still use the full foreground map experience with only the
foreground "while using the app" permission; they simply stop revealing fog
once they leave the app.

While background tracking is active, the app shows a persistent foreground-
service notification, so the user always knows location is being recorded
in the background. Location data is not sold, not shared with advertising
or analytics networks, and is deleted immediately if the user deletes their
account from within the app.
```

## Screen recording / screenshot requirement

Play Console asks for a video or annotated screenshots showing where in the
app the background location permission is requested and how the feature
depends on it. Suggested flow to capture:

1. First app launch → location permission prompt (foreground, then the
   separate Android "Allow all the time" background prompt).
2. The map screen with fog actively clearing as the (simulated) location
   moves.
3. Backgrounding the app (home button) with the persistent location
   notification visible in the notification shade.
4. Reopening the app and showing the newly revealed fog merged onto the map
   from movement that happened while backgrounded.

(Not recorded yet — do this once an Android build/device is available; see
[[android-build]] memory for the Android build/testing constraints on this
machine.)

## Notes

- This complements the Data Safety form (`docs/google-play-data-safety.md`)
  and the App Store App Review notes (`docs/app-review-notes-location.md`) —
  all three should tell the same story since Apple/Google reviewers do cross-
  reference them.

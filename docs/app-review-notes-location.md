# App Review notes — background location use

For the "App Review information" / notes field in App Store Connect when submitting Mistwalk.

---

Mistwalk is a "fog of war" exploration map: the map starts covered in fog, and areas are revealed permanently as the user physically walks through them in real life — similar to the fog-of-war mechanic in strategy games, but tied to real-world movement.

Background location ("Always") access is core to this mechanic, not incidental:

- The map keeps revealing fog while the app is backgrounded or the phone is locked, so a user's walk, run, or commute is captured even if they don't keep the app open the whole time. Without Always access, any part of a walk taken with the phone in a pocket would be permanently lost from the map.
- While tracking in the background, the app shows a persistent foreground-service notification, so the user always knows location is being recorded.
- The app also uses background location to send a local notification when the user passes near a point of interest they haven't discovered yet, and to build a weekly summary of distance covered / area revealed.
- Background tracking only starts after the user explicitly grants the "Always" location permission (there is no attempt to request or upgrade to Always in the background); a user who grants only "While Using" still gets the full foreground experience, just without off-screen tracking.
- Users can revoke this at any time in iOS Settings, and there is no separate in-app toggle beyond that.

To test:
1. Launch the app and grant location access when prompted (choose "Always Allow" to see background tracking; "While Using" also works for the core foreground map).
2. Walk or simulate movement (Simulator: Features > Location > Freeway Drive, or a custom GPX route) with the app in the foreground — the fog clears along the path in real time.
3. Background the app (press the Home button) and continue simulating movement — the persistent location notification appears, and fog continues to clear; reopening the app shows the newly revealed area merged into the map.

No other use is made of location data. Location history is stored per-account in the app's backend (Supabase) to persist revealed areas and the weekly summary, and is deleted along with the rest of the account via the in-app "Delete account" flow.

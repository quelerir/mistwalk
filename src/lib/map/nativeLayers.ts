import { Platform } from 'react-native';

// Fog (and later markers and route) drawn as layers of the map itself, so they move with it in the same frame.
// iOS only for now: the Android 9 phone crashed on native map components before, so it stays on the old overlays until
// the layers are seen working there.
export const NATIVE_FOG = Platform.OS === 'ios';

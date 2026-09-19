import { Platform } from 'react-native';

// Diagnostic build: on Android these three features are off while we look for the crash that happens
// right after location is allowed (background service, offline map download, rain layer).
export const ANDROID_SAFE_MODE = Platform.OS === 'android';

import { I18nManager } from 'react-native';

// The languages of the phone, the most wanted first: the native locale, then the one of the JavaScript engine. On iOS
// both are cut down to the languages the app declares in Info.plist (CFBundleLocalizations), so a Russian phone reads as
// Russian only because the app declares Russian there.
export function deviceLocales(): string[] {
  const found: string[] = [];
  try {
    const native = I18nManager.getConstants?.().localeIdentifier;
    if (typeof native === 'string' && native) found.push(native);
  } catch {
    // Falls through to Intl below.
  }
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intl) found.push(intl);
  } catch {
    // No Intl: the fallback language is used.
  }
  return found;
}

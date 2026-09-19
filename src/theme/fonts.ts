import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';

// Bricolage Grotesque is for titles and big numbers; body text stays on the system font.
export const FONT = {
  display: 'BricolageGrotesque_800ExtraBold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
} as const;

export const FONT_ASSETS = {
  BricolageGrotesque_800ExtraBold,
  BricolageGrotesque_600SemiBold,
};

// Soft shadow for cards on the warm background; invisible in the dark theme.
export const CARD_SHADOW = {
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 14,
  elevation: 2,
} as const;

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CountryStat } from '../lib/geo/countryStats';
import type { Stats } from '../hooks/useStats';
import type { WeekSummary } from '../lib/stats/weekly';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';
import CollectionContent from './CollectionContent';

export interface CollectionScreenProps {
  stats: Stats;
  week: WeekSummary;
  // Kilometres for each of the last 7 days, oldest first.
  daily: number[];
  countries: CountryStat[];
  onOpenCountries: () => void;
  onOpenLeaderboard: () => void;
  onOpenFollows: (tab: 'followers' | 'following') => void;
  followCounts: { followers: number; following: number } | null;
  onBack: () => void;
}

export default function CollectionScreen({
  stats,
  week,
  daily,
  countries,
  onOpenCountries,
  onOpenLeaderboard,
  onOpenFollows,
  followCounts,
  onBack,
}: CollectionScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('collection.title')}</Text>
      </View>

      <View style={styles.followRow}>
        <Pressable onPress={() => onOpenFollows('followers')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('collection.followersLabel')}>
          <Text style={styles.followValue}>{followCounts ? followCounts.followers : '–'}</Text>
          <Text style={styles.followLabel}>{t('collection.followers')}</Text>
        </Pressable>
        <Pressable onPress={() => onOpenFollows('following')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('collection.followingLabel')}>
          <Text style={styles.followValue}>{followCounts ? followCounts.following : '–'}</Text>
          <Text style={styles.followLabel}>{t('collection.following')}</Text>
        </Pressable>
      </View>

      <CollectionContent
        stats={stats}
        week={week}
        daily={daily}
        countries={countries}
        onOpenCountries={onOpenCountries}
        onOpenLeaderboard={onOpenLeaderboard}
      />
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
  title: { fontSize: 34, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
  followRow: { flexDirection: 'row', gap: 28, marginBottom: 14 },
  followValue: { fontSize: 22, fontFamily: FONT.display, letterSpacing: -0.4, color: c.text },
  followLabel: { fontSize: 13, color: c.textMuted, marginTop: 1 },
});

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../components/Avatar';
import SvgIcon from '../components/icons/SvgIcon';
import CollectionContent from './CollectionContent';
import type { CountryStat } from '../lib/geo/countryStats';
import type { Stats } from '../hooks/useStats';
import type { WeekSummary } from '../lib/stats/weekly';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';

export interface ProfileScreenProps {
  displayName: string;
  avatarUri: string | null;
  stats: Stats;
  week: WeekSummary;
  // Kilometres for each of the last 7 days, oldest first.
  daily: number[];
  countries: CountryStat[];
  followCounts: { followers: number; following: number } | null;
  onOpenCountries: () => void;
  onOpenLeaderboard: () => void;
  onOpenFollows: (tab: 'followers' | 'following') => void;
  // The bell in the top bar: how many notifications are unread, and the page that lists them.
  unreadNotifications: number;
  onOpenNotifications: () => void;
  // Picks a new photo; resolves to a message to show, or null when there is nothing to say.
  onChangeAvatar: () => Promise<string | null>;
  onRemoveAvatar: () => Promise<void>;
  // The menu page, shown in place of the profile after the burger is pressed; `close` returns to the profile.
  renderMenu: (close: () => void) => React.ReactNode;
}

// The person's own page: the photo, the name and the follower counters, with the collection below. The menu lives behind
// the burger button and replaces this view, so the tab bar stays visible.
export default function ProfileScreen({
  displayName,
  avatarUri,
  stats,
  week,
  daily,
  countries,
  followCounts,
  onOpenCountries,
  onOpenLeaderboard,
  onOpenFollows,
  unreadNotifications,
  onOpenNotifications,
  onChangeAvatar,
  onRemoveAvatar,
  renderMenu,
}: ProfileScreenProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const [menuOpen, setMenuOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (menuOpen) return <>{renderMenu(() => setMenuOpen(false))}</>;

  function choosePhoto() {
    setNote(null);
    void onChangeAvatar().then((message) => setNote(message));
  }

  function removePhoto() {
    setNote(null);
    void onRemoveAvatar().catch(() => setNote(t('menu.removePhotoFailed')));
  }

  function openPhotoChoices() {
    Alert.alert(t('profile.photoTitle'), undefined, [
      { text: t('profile.choosePhoto'), onPress: choosePhoto },
      ...(avatarUri ? [{ text: t('profile.removePhoto'), style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          testID="profile-bell"
          onPress={onOpenNotifications}
          hitSlop={12}
          style={styles.bell}
          accessibilityRole="button"
          accessibilityLabel={t('profile.notifications')}
        >
          <SvgIcon name="bell" size={26} />
          {unreadNotifications > 0 && (
            <View testID="profile-bell-badge" style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          testID="profile-burger"
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('profile.menu')}
        >
          <SvgIcon name="menu" size={28} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <Pressable testID="profile-avatar" onPress={openPhotoChoices} accessibilityRole="button" accessibilityLabel={t('profile.photoTitle')}>
          <Avatar uri={avatarUri} name={displayName} size={92} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.followRow}>
            <Pressable
              testID="profile-followers"
              onPress={() => onOpenFollows('followers')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('collection.followersLabel')}
            >
              <Text style={styles.followValue}>{followCounts ? followCounts.followers : '–'}</Text>
              <Text style={styles.followLabel}>{t('collection.followers')}</Text>
            </Pressable>
            <Pressable
              testID="profile-following"
              onPress={() => onOpenFollows('following')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('collection.followingLabel')}
            >
              <Text style={styles.followValue}>{followCounts ? followCounts.following : '–'}</Text>
              <Text style={styles.followLabel}>{t('collection.following')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}

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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, paddingTop: 12, paddingBottom: 4 },
  bell: { padding: 1 },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 10, fontWeight: '700', color: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 8 },
  headerText: { flex: 1 },
  name: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.6, color: c.text },
  followRow: { flexDirection: 'row', gap: 28, marginTop: 8 },
  followValue: { fontSize: 22, fontFamily: FONT.display, letterSpacing: -0.4, color: c.text },
  followLabel: { fontSize: 13, color: c.textMuted, marginTop: 1 },
  note: { color: c.textMuted, marginBottom: 12 },
});

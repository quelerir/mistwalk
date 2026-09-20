import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface AvatarProps {
  uri: string | null;
  name: string;
  size?: number;
}

export default function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const { colors: c } = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[box, { backgroundColor: c.surfaceAlt }]} />;
  const letter = (name.replace(/^(Игрок|Player)\s*/, '').trim()[0] ?? name[0] ?? '?').toUpperCase();
  return (
    <View style={[box, styles.center, { backgroundColor: c.cityBadgeBg }]}>
      <Text style={{ color: c.link, fontWeight: '800', fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });

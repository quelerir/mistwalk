import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CityBadgeProps {
  name: string;
  crestUrl?: string | null;
  size?: number;
}

// The city's coat of arms, or its first letter while there is none (or it fails to load).
export default function CityBadge({ name, crestUrl, size = 40 }: CityBadgeProps) {
  const { colors: c } = useTheme();
  const [failed, setFailed] = useState(false);
  if (crestUrl && !failed) {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Image
          source={{ uri: crestUrl }}
          style={{ width: size - 4, height: size - 4 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.cityBadgeBg }]}>
      <Text style={{ color: c.link, fontWeight: '800', fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center' } });

import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { haversineDistanceMeters, type Coordinate } from '../lib/geo/distance';
import { edgeIndicator } from '../lib/geo/offscreen';
import { projectToScreen, type MapView, type Size } from '../lib/geo/projection';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface TargetArrowProps {
  target: Coordinate | null;
  origin: Coordinate | null;
  view: MapView | null;
}

const INSET = 40;
// Bottom cards sit over the lowest part of the map, so the arrow keeps clear of them.
const BOTTOM_RESERVE = 165;
const ARROW = 44;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

// Shows where a selected place lies when it is outside the visible map.
export default function TargetArrow({ target, origin, view }: TargetArrowProps) {
  const styles = useStyles(makeStyles);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  let arrow: ReturnType<typeof edgeIndicator> = null;
  if (target && view && size.width > 0) {
    const point = projectToScreen(target.lng, target.lat, view, size);
    arrow = edgeIndicator(point, { width: size.width, height: size.height - BOTTOM_RESERVE }, INSET);
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {arrow && (
        <View style={[styles.wrap, { left: arrow.x - ARROW / 2, top: arrow.y - ARROW / 2 }]}>
          <View style={styles.bubble}>
            <View style={[styles.triangle, { transform: [{ rotate: `${arrow.angle}deg` }] }]} />
          </View>
          {origin && target && (
            <Text style={styles.distance}>{formatDistance(haversineDistanceMeters(origin, target))}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', width: ARROW, alignItems: 'center' },
    bubble: {
      width: ARROW,
      height: ARROW,
      borderRadius: ARROW / 2,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
    },
    // A CSS-style triangle pointing up; rotating the View turns it toward the target.
    triangle: {
      width: 0,
      height: 0,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderBottomWidth: 26,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: '#ffffff',
    },
    distance: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '700',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
  });

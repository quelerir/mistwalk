import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox, { Camera, MapView, UserLocation } from '@rnmapbox/maps';
import FogOverlay from '../components/FogOverlay';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

export interface MapScreenProps {
  points: VisitedPoint[];
}

export default function MapScreen({ points }: MapScreenProps) {
  const mapRef = useRef<MapView>(null) as React.RefObject<MapView>;
  const cameraRef = useRef<Camera>(null);
  const [regionVersion, setRegionVersion] = useState(0);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onCameraChanged={() => setRegionVersion((v) => v + 1)}
      >
        <Camera ref={cameraRef} followUserLocation followZoomLevel={16} />
        <UserLocation visible showsUserHeadingIndicator />
      </MapView>
      <FogOverlay points={points} mapRef={mapRef} regionVersion={regionVersion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

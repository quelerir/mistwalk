import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import type { ColorScheme } from '../theme/palettes';
import type { MapStyleJson } from '../lib/map/darkStyle';
import { MAP_STYLES } from '../lib/map/styles';
import { loadDarkStyle } from '../lib/map/styleLoader';

// The style for the map: the address of the light one, or the lighter dark one made from the dark style. Null only
// while the dark one is being looked up the first time (from the copy on the device, so it takes a moment), and the map
// waits for it instead of appearing in the plain dark style and then changing. Later, when the theme switches to dark,
// the plain dark style shows until the lighter one is ready.
export function useMapStyle(scheme: ColorScheme): string | StyleSpecification | null {
  const [dark, setDark] = useState<MapStyleJson | 'unavailable' | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (scheme !== 'dark' || dark !== null) return;
    let cancelled = false;
    void loadDarkStyle({ storage: AsyncStorage }).then((style) => {
      if (!cancelled) setDark(style ?? 'unavailable');
    });
    return () => {
      cancelled = true;
    };
  }, [scheme, dark]);

  let style: string | StyleSpecification | null;
  if (scheme === 'light') style = MAP_STYLES.light;
  else if (dark === null) style = shown.current ? MAP_STYLES.dark : null;
  // The style came from the map's own style file with a few colours changed, so it is a valid style for the map.
  else style = dark === 'unavailable' ? MAP_STYLES.dark : (dark as unknown as StyleSpecification);
  if (style !== null) shown.current = true;
  return style;
}

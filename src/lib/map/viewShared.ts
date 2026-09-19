import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { MapView, ViewNumbers } from '../geo/projection';

// The current map view as shared values: the map writes them on every frame, the overlays read them on the UI
// thread. No React state is involved, so panning does not re-render any screen.
export interface ViewShared {
  lng: SharedValue<number>;
  lat: SharedValue<number>;
  zoom: SharedValue<number>;
  bearing: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
}

export function useViewShared(): ViewShared {
  return {
    lng: useSharedValue(0),
    lat: useSharedValue(0),
    zoom: useSharedValue(16),
    bearing: useSharedValue(0),
    width: useSharedValue(0),
    height: useSharedValue(0),
  };
}

export function writeView(shared: ViewShared, view: MapView): void {
  shared.lng.value = view.center[0];
  shared.lat.value = view.center[1];
  shared.zoom.value = view.zoom;
  shared.bearing.value = view.bearing;
}

export function readView(shared: ViewShared): ViewNumbers {
  'worklet';
  return {
    lng: shared.lng.value,
    lat: shared.lat.value,
    zoom: shared.zoom.value,
    bearing: shared.bearing.value,
    width: shared.width.value,
    height: shared.height.value,
  };
}

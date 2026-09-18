import { renderHook, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useLocationPermissions } from './useLocationPermissions';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

describe('useLocationPermissions', () => {
  it('starts in the unrequested stage', () => {
    const { result } = renderHook(() => useLocationPermissions());
    expect(result.current.stage).toBe('unrequested');
  });

  it('moves to foreground-granted when foreground permission is granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestForeground();
    });

    expect(result.current.stage).toBe('foreground-granted');
  });

  it('moves to denied when foreground permission is refused', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestForeground();
    });

    expect(result.current.stage).toBe('denied');
  });

  it('moves to background-granted when background permission is granted', async () => {
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestBackground();
    });

    expect(result.current.stage).toBe('background-granted');
  });
});

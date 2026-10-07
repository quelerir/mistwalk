import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useLocationPermissions } from './useLocationPermissions';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // By default the permission has not been asked yet.
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
});

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

  it('leaves stage unchanged and returns false when background permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestForeground();
    });
    expect(result.current.stage).toBe('foreground-granted');

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.requestBackground();
    });

    expect(returnValue).toBe(false);
    expect(result.current.stage).toBe('foreground-granted'); // unchanged, not reset to 'denied'
  });
  describe('the permission that is already set when the app opens', () => {
    it('is foreground-granted at once when the permission was granted before, without asking again', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      const { result } = renderHook(() => useLocationPermissions());
      await waitFor(() => expect(result.current.stage).toBe('foreground-granted'));
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('is denied at once when the permission was refused before', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      const { result } = renderHook(() => useLocationPermissions());
      await waitFor(() => expect(result.current.stage).toBe('denied'));
    });

    it('stays unrequested when the permission has not been asked yet', async () => {
      const { result } = renderHook(() => useLocationPermissions());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.stage).toBe('unrequested');
    });

    it('stays unrequested when the check itself fails', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useLocationPermissions());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.stage).toBe('unrequested');
    });

    it('a late check does not undo a stage the app already reached', async () => {
      let answer!: (v: unknown) => void;
      (Location.getForegroundPermissionsAsync as jest.Mock).mockReturnValue(new Promise((r) => (answer = r)));
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      const { result } = renderHook(() => useLocationPermissions());
      await act(async () => {
        await result.current.requestBackground();
      });
      expect(result.current.stage).toBe('background-granted');
      await act(async () => answer({ status: 'granted' }));
      expect(result.current.stage).toBe('background-granted');
    });
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  },
}));

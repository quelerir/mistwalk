import type { ImageSourcePropType } from 'react-native';
import { flagUrl } from './countries';

// The republics have no code in the flag service, so their flags are bundled (assets/flags/README.md).
const REPUBLIC_FLAGS: Readonly<Record<string, ImageSourcePropType>> = {
  XA: require('../../../assets/flags/xa.png'),
  XS: require('../../../assets/flags/xs.png'),
  XT: require('../../../assets/flags/xt.png'),
  XN: require('../../../assets/flags/xn.png'),
  XL: require('../../../assets/flags/xl.png'),
};

export function flagSource(code: string): ImageSourcePropType {
  return REPUBLIC_FLAGS[code] ?? { uri: flagUrl(code), cache: 'force-cache' };
}

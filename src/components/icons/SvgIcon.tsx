import React, { useMemo } from 'react';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { ICONS, type IconName } from './svgIcons';

export interface SvgIconProps {
  name: IconName;
  active?: boolean;
  size?: number;
  color?: string;
  background?: string;
}

const VIEWBOX = 24;
const STROKE_WIDTH = 2;

export default function SvgIcon({
  name,
  active = false,
  size = 26,
  color = '#262626',
  background = '#ffffff',
}: SvgIconProps) {
  const layers = useMemo(
    () =>
      ICONS[name][active ? 'active' : 'outline'].map((layer) => ({
        mode: layer.mode,
        path: Skia.Path.MakeFromSVGString(layer.d),
      })),
    [name, active]
  );

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / VIEWBOX }]}>
        {layers.map(({ path, mode }, i) =>
          path ? (
            <Path
              key={i}
              path={path}
              style={mode === 'stroke' ? 'stroke' : 'fill'}
              strokeWidth={STROKE_WIDTH}
              strokeCap="round"
              strokeJoin="round"
              color={mode === 'cutout' ? background : color}
            />
          ) : null
        )}
      </Group>
    </Canvas>
  );
}

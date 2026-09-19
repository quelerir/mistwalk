import React from 'react';
import SvgIcon from './icons/SvgIcon';
import type { IconName } from './icons/svgIcons';
import type { PoiKind } from '../lib/poi/types';

const KIND_SVG: Record<PoiKind, IconName> = {
  viewpoint: 'poi-viewpoint',
  monument: 'poi-monument',
  castle: 'poi-castle',
  ruins: 'poi-ruins',
  attraction: 'poi-attraction',
  artwork: 'poi-artwork',
};

export interface KindIconProps {
  kind: PoiKind;
  size?: number;
  color?: string;
}

export default function KindIcon({ kind, size = 20, color = '#262626' }: KindIconProps) {
  return <SvgIcon name={KIND_SVG[kind]} size={size} color={color} />;
}

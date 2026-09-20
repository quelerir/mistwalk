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
  museum: 'poi-museum',
  park: 'poi-park',
  beach: 'poi-beach',
  worship: 'poi-worship',
  nature: 'poi-nature',
};

export interface KindIconProps {
  kind: PoiKind;
  size?: number;
  color?: string;
}

export default function KindIcon({ kind, size = 20, color }: KindIconProps) {
  return <SvgIcon name={KIND_SVG[kind]} size={size} color={color} />;
}

import { KIND_COLOR, kindTint } from './kindColors';
import type { PoiKind } from './types';

describe('kindColors', () => {
  it('has a distinct colour for every kind', () => {
    const kinds: PoiKind[] = ['viewpoint', 'monument', 'castle', 'ruins', 'attraction', 'artwork'];
    const colours = kinds.map((k) => KIND_COLOR[k]);
    expect(new Set(colours).size).toBe(kinds.length);
    colours.forEach((c) => expect(c).toMatch(/^#[0-9A-F]{6}$/));
  });

  it('tints a colour with 15% alpha', () => {
    expect(kindTint('monument')).toBe('#E9765B26');
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import WorldMapView from './WorldMapView';
import { levelColors } from '../lib/geo/worldMapColors';
import type { CountryStat } from '../lib/geo/countryStats';

// The native map cannot load in Jest: stand-ins that keep the props the view hands to them.
const mockSources: Array<{ id?: string; data: any; onPress?: (e: any) => void }> = [];
const mockLayers: Array<{ id?: string; type: string; paint?: any }> = [];
let mockMapMounts = 0;
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Map: ({ children }: any) => {
      React.useEffect(() => {
        mockMapMounts += 1;
      }, []);
      return <View testID="map">{children}</View>;
    },
    Camera: () => null,
    GeoJSONSource: (props: any) => {
      mockSources.push(props);
      return <View>{props.children}</View>;
    },
    Layer: (props: any) => {
      mockLayers.push(props);
      return null;
    },
  };
});
jest.mock('../theme/fonts', () => ({ FONT: { display: 'display' }, CARD_SHADOW: {} }));

const stat = (code: string, percent: number): CountryStat => ({ code, name: code, exploredKm2: 0, totalKm2: 1, percent });
const countries = [stat('AT', 12), stat('FR', 0.5), stat('MT', 0), stat('RU', 0)];

const polygons = () => mockSources[mockSources.length - 2];
const smallPoints = () => mockSources[mockSources.length - 1];
const press = (src: { onPress?: (e: any) => void }, features: any[]) => src.onPress?.({ nativeEvent: { features } });

describe('WorldMapView', () => {
  beforeEach(() => {
    mockSources.length = 0;
    mockLayers.length = 0;
    mockMapMounts = 0;
  });

  it('shows the four legend items', () => {
    const { getByText } = render(<WorldMapView countries={countries} pending={false} onOpenCountry={jest.fn()} />);
    expect(getByText(/Не был|Not visited/)).toBeTruthy();
    expect(getByText('< 1 %')).toBeTruthy();
    expect(getByText('1–10 %')).toBeTruthy();
    expect(getByText('> 10 %')).toBeTruthy();
  });

  it('opens the country that was pressed', () => {
    const onOpenCountry = jest.fn();
    render(<WorldMapView countries={countries} pending={false} onOpenCountry={onOpenCountry} />);
    press(polygons(), [{ properties: { code: 'AT' } }]);
    expect(onOpenCountry).toHaveBeenCalledWith(countries[0]);
    press(smallPoints(), [{ properties: { code: 'MT' } }]);
    expect(onOpenCountry).toHaveBeenLastCalledWith(countries[2]);
  });

  it('ignores a code with no stat, a missing code and an empty press', () => {
    const onOpenCountry = jest.fn();
    render(<WorldMapView countries={countries} pending={false} onOpenCountry={onOpenCountry} />);
    press(polygons(), [{ properties: { code: 'ZZ' } }]);
    press(polygons(), [{ properties: {} }]);
    press(polygons(), [{}]);
    press(polygons(), []);
    expect(onOpenCountry).not.toHaveBeenCalled();
  });

  it('puts dots only on small countries', () => {
    render(<WorldMapView countries={countries} pending={false} onOpenCountry={jest.fn()} />);
    const dotCodes = smallPoints().data.features.map((f: any) => f.properties.code);
    expect(dotCodes).toContain('MT');
    expect(dotCodes).not.toContain('RU');
  });

  it('recolours without remounting the map when stats arrive', () => {
    const { rerender } = render(<WorldMapView countries={[stat('AT', 0)]} pending onOpenCountry={jest.fn()} />);
    const fill = () => mockLayers.filter((l) => l.type === 'fill').pop()!.paint['fill-color'];
    expect(fill()).toBe(levelColors('light')[0]);
    rerender(<WorldMapView countries={[stat('AT', 12)]} pending={false} onOpenCountry={jest.fn()} />);
    expect(fill()).toEqual(['match', ['get', 'code'], ['AT'], levelColors('light')[3], levelColors('light')[0]]);
    expect(mockMapMounts).toBe(1);
  });

  // Last on purpose: the doMock stays in force for the rest of the file.
  it('shows the failure message when the border file cannot be loaded', () => {
    jest.doMock('../assets/world.json', () => {
      throw new Error('broken asset');
    });
    const { getByText, queryByTestId } = render(<WorldMapView countries={countries} pending={false} onOpenCountry={jest.fn()} />);
    expect(getByText(/Не удалось загрузить карту|Could not load the map/)).toBeTruthy();
    expect(queryByTestId('map')).toBeNull();
  });
});

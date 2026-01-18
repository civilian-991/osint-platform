declare module '@mapbox/mapbox-gl-draw' {
  import type { Map, IControl } from 'mapbox-gl';

  interface DrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    defaultMode?: string;
    styles?: object[];
    modes?: object;
    userProperties?: boolean;
    keybindings?: boolean;
    touchEnabled?: boolean;
    boxSelect?: boolean;
    clickBuffer?: number;
    touchBuffer?: number;
  }

  interface DrawFeature {
    id: string;
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: unknown;
    };
  }

  interface DrawFeatureCollection {
    type: 'FeatureCollection';
    features: DrawFeature[];
  }

  class MapboxDraw implements IControl {
    constructor(options?: DrawOptions);

    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;

    add(geojson: object): string[];
    get(featureId: string): DrawFeature | undefined;
    getFeatureIdsAt(point: { x: number; y: number }): string[];
    getSelectedIds(): string[];
    getSelected(): DrawFeatureCollection;
    getSelectedPoints(): DrawFeatureCollection;
    getAll(): DrawFeatureCollection;
    delete(ids: string | string[]): this;
    deleteAll(): this;
    set(featureCollection: object): string[];
    trash(): this;
    combineFeatures(): this;
    uncombineFeatures(): this;
    getMode(): string;
    changeMode(mode: string, options?: object): this;
    setFeatureProperty(featureId: string, property: string, value: unknown): this;
  }

  export default MapboxDraw;
}

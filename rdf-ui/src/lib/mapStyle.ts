import type { Map as MapLibreMap } from "maplibre-gl";

const HIDDEN_REFERENCE_LAYERS = ["geolines", "geolines-label"] as const;

export function hideReferenceLatitudeLayers(map: MapLibreMap): void {
  for (const layerId of HIDDEN_REFERENCE_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", "none");
  }
}

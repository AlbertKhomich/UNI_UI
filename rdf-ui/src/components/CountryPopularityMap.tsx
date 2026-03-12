"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LngLatLike, Map as MapLibreMap, MapLayerMouseEvent, Popup as MapLibrePopup } from "maplibre-gl";
import type { Theme } from "@/hooks/useTheme";
import {
  canonicalizeCountryCode,
  countryCodeToAlpha3,
  countryCodeToName,
} from "@/lib/country";
import { hideReferenceLatitudeLayers } from "@/lib/mapStyle";
import type { Row } from "@/lib/types";

type CountryPopularityMapProps = {
  onCountryClick?: (countryCode: string, label: string) => void;
  rows: Row[];
  theme: Theme;
};

type StyledCountryRow = {
  alpha2: string;
  alpha3: string;
  fillColor: string;
  label: string;
  mapKeys: string[];
  value: number;
};

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json";
const COASTLINE_LAYER = "coastline";
const COUNTRY_FILL_LAYER = "countries-fill";
const COUNTRY_BOUNDARY_LAYER = "countries-boundary";
const COUNTRY_CUSTOM_BOUNDARY_LAYER = "countries-boundary-custom";
const COUNTRY_BOUNDARY_BEFORE_LAYER = "geolines";
const COUNTRY_CODE_PROPERTIES = ["ISO_A2", "ISO_A2_EH", "WB_A2", "postal"] as const;
const EARTH_OVERVIEW_CENTER: [number, number] = [0, 20];
const EARTH_OVERVIEW_ZOOM = 0.7;

function defaultFillColor(theme: Theme): string {
  return theme === "dark" ? "rgba(15,23,42,0.22)" : "rgba(226,232,240,0.88)";
}

function boundaryColor(theme: Theme): string {
  return theme === "dark" ? "rgba(15,23,42,0.34)" : "rgba(148,163,184,0.5)";
}

function boundaryWidth(): unknown[] {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    0.16,
    2,
    0.2,
    4,
    0.28,
    6,
    0.38,
  ];
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${value}`;
}

function toCountryFillColor(value: number, maxValue: number, theme: Theme): string {
  const ratio = maxValue > 0 ? Math.log1p(value) / Math.log1p(maxValue) : 0;
  const alpha = 0.24 + ratio * 0.62;
  if (theme === "dark") return `rgba(8,145,178,${alpha.toFixed(3)})`;
  return `rgba(29,78,216,${alpha.toFixed(3)})`;
}

function normalizeAlpha3(input: string): string {
  const value = (input ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : "";
}

function getStringProperty(properties: Record<string, unknown>, key: string): string {
  const value = properties[key];
  return typeof value === "string" ? value.trim() : "";
}

function resolveFeatureCountryKeys(properties: Record<string, unknown>): string[] {
  const keys = COUNTRY_CODE_PROPERTIES
    .map((property) => canonicalizeCountryCode(getStringProperty(properties, property)))
    .filter((code) => /^[A-Z]{2}$/.test(code));
  const alpha3 = normalizeAlpha3(getStringProperty(properties, "ADM0_A3"));
  if (alpha3) keys.push(alpha3);
  return Array.from(new Set(keys));
}

function createFillColorExpression(rows: StyledCountryRow[], theme: Theme): unknown[] {
  const expression: unknown[] = [
    "match",
    [
      "coalesce",
      ...COUNTRY_CODE_PROPERTIES.map((property) => ["get", property]),
      ["get", "ADM0_A3"],
      "",
    ],
  ];

  for (const row of rows) {
    for (const key of row.mapKeys) {
      expression.push(key, row.fillColor);
    }
  }

  expression.push(defaultFillColor(theme));
  return expression;
}

function ensureCountryBoundaryLayer(map: MapLibreMap): void {
  hideReferenceLatitudeLayers(map);

  if (map.getLayer(COASTLINE_LAYER)) {
    map.setLayoutProperty(COASTLINE_LAYER, "visibility", "none");
  }

  if (map.getLayer(COUNTRY_BOUNDARY_LAYER)) {
    map.setLayoutProperty(COUNTRY_BOUNDARY_LAYER, "visibility", "none");
  }

  if (map.getLayer(COUNTRY_CUSTOM_BOUNDARY_LAYER)) return;

  map.addLayer(
    {
      id: COUNTRY_CUSTOM_BOUNDARY_LAYER,
      type: "line",
      source: "maplibre",
      "source-layer": "countries",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-gap-width": 0,
        "line-offset": 0,
      },
    },
    map.getLayer(COUNTRY_BOUNDARY_BEFORE_LAYER) ? COUNTRY_BOUNDARY_BEFORE_LAYER : undefined,
  );
}

function applyCountryStyles(map: MapLibreMap, fillColorExpression: unknown[], theme: Theme): void {
  if (map.getLayer(COUNTRY_FILL_LAYER)) {
    map.setPaintProperty(COUNTRY_FILL_LAYER, "fill-color", fillColorExpression);
    map.setPaintProperty(COUNTRY_FILL_LAYER, "fill-outline-color", "rgba(0,0,0,0)");
  }
  ensureCountryBoundaryLayer(map);
  if (map.getLayer(COUNTRY_CUSTOM_BOUNDARY_LAYER)) {
    map.setPaintProperty(COUNTRY_CUSTOM_BOUNDARY_LAYER, "line-color", boundaryColor(theme));
    map.setPaintProperty(COUNTRY_CUSTOM_BOUNDARY_LAYER, "line-width", boundaryWidth());
  }
}

function findCountryRow(
  properties: Record<string, unknown>,
  rowsByCountryKey: Map<string, StyledCountryRow>,
): StyledCountryRow | null {
  return (
    resolveFeatureCountryKeys(properties)
      .map((key) => rowsByCountryKey.get(key))
      .find((row): row is StyledCountryRow => Boolean(row)) ?? null
  );
}

function createPopupContent(row: StyledCountryRow, theme: Theme): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "country-popularity-popup-body";
  root.style.minWidth = "140px";
  root.style.padding = "2px 4px";
  root.style.color = theme === "dark" ? "#e5eef7" : "#0f172a";

  const title = document.createElement("div");
  title.textContent = row.label;
  title.style.fontSize = "13px";
  title.style.fontWeight = "700";
  title.style.lineHeight = "1.25";

  const meta = document.createElement("div");
  meta.textContent = `${formatCompact(row.value)} paper${row.value === 1 ? "" : "s"}`;
  meta.style.marginTop = "4px";
  meta.style.fontSize = "12px";
  meta.style.opacity = "0.8";

  root.append(title, meta);
  return root;
}

function applyPopupThemeClass(popup: MapLibrePopup, theme: Theme): void {
  const element = popup.getElement();
  element.classList.remove("country-popularity-popup--dark", "country-popularity-popup--light");
  element.classList.add(theme === "dark" ? "country-popularity-popup--dark" : "country-popularity-popup--light");
}

function renderCountryPopup(
  popup: MapLibrePopup,
  coordinates: LngLatLike,
  row: StyledCountryRow,
  theme: Theme,
  map: MapLibreMap,
): void {
  popup.setLngLat(coordinates).setDOMContent(createPopupContent(row, theme)).addTo(map);
  applyPopupThemeClass(popup, theme);
}

export default function CountryPopularityMap(props: CountryPopularityMapProps) {
  const { onCountryClick, rows, theme } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const hoveredRowRef = useRef<StyledCountryRow | null>(null);
  const hoveredLngLatRef = useRef<LngLatLike | null>(null);
  const rowsByCountryKeyRef = useRef<Map<string, StyledCountryRow>>(new Map());
  const onCountryClickRef = useRef(onCountryClick);
  const fillColorExpressionRef = useRef<unknown[]>([]);
  const themeRef = useRef(theme);
  const [mapError, setMapError] = useState<string | null>(null);
  const isDark = theme === "dark";

  const styledRows = useMemo(() => {
    const maxValue = rows.reduce((max, row) => Math.max(max, Number(row.value) || 0), 0);

    return rows.reduce<StyledCountryRow[]>((acc, row) => {
      const alpha2 = canonicalizeCountryCode(row.code ?? "");
      if (!/^[A-Z]{2}$/.test(alpha2)) return acc;

      const alpha3 = countryCodeToAlpha3(alpha2);
      const label = countryCodeToName(alpha2, "en") || row.name;
      const value = Number(row.value) || 0;
      const mapKeys = Array.from(new Set([alpha2, alpha3].filter(Boolean)));

      acc.push({
        alpha2,
        alpha3,
        fillColor: toCountryFillColor(value, maxValue, theme),
        label,
        mapKeys,
        value,
      });
      return acc;
    }, []);
  }, [rows, theme]);

  const rowsByCountryKey = useMemo(() => {
    const out = new Map<string, StyledCountryRow>();
    for (const row of styledRows) {
      for (const key of row.mapKeys) out.set(key, row);
    }
    return out;
  }, [styledRows]);

  const fillColorExpression = useMemo(
    () => createFillColorExpression(styledRows, theme),
    [styledRows, theme],
  );

  useEffect(() => {
    rowsByCountryKeyRef.current = rowsByCountryKey;
    onCountryClickRef.current = onCountryClick;
    fillColorExpressionRef.current = fillColorExpression;
    themeRef.current = theme;
  }, [fillColorExpression, onCountryClick, rowsByCountryKey, theme]);

  useEffect(() => {
    if (!containerRef.current || process.env.NODE_ENV === "test") return;

    let cancelled = false;
    let cleanup = () => {};
    setMapError(null);

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          center: EARTH_OVERVIEW_CENTER,
          container: containerRef.current,
          style: DEFAULT_STYLE,
          zoom: EARTH_OVERVIEW_ZOOM,
        });
        const popup = new maplibregl.Popup({
          anchor: "bottom",
          className: "country-popularity-popup",
          closeButton: false,
          closeOnClick: false,
          closeOnMove: false,
          maxWidth: "240px",
          offset: 14,
        });

        mapRef.current = map;
        popupRef.current = popup;
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.on("error", () => {
          if (!cancelled) setMapError("Map tiles failed to load.");
        });

        const handleClick = (event: MapLayerMouseEvent) => {
          const properties = (event.features?.[0]?.properties ?? {}) as Record<string, unknown>;
          const match = findCountryRow(properties, rowsByCountryKeyRef.current);
          if (!match || !onCountryClickRef.current) return;
          onCountryClickRef.current(match.alpha2, match.label);
        };

        const handleMove = (event: MapLayerMouseEvent) => {
          const properties = (event.features?.[0]?.properties ?? {}) as Record<string, unknown>;
          const match = findCountryRow(properties, rowsByCountryKeyRef.current);
          if (match && event.lngLat) {
            hoveredRowRef.current = match;
            hoveredLngLatRef.current = event.lngLat;
            renderCountryPopup(popup, event.lngLat, match, themeRef.current, map);
          } else {
            hoveredRowRef.current = null;
            hoveredLngLatRef.current = null;
            popup.remove();
          }
          map.getCanvas().style.cursor =
            match && Boolean(onCountryClickRef.current) ? "pointer" : "";
        };

        const handleLeave = () => {
          map.getCanvas().style.cursor = "";
          hoveredRowRef.current = null;
          hoveredLngLatRef.current = null;
          popup.remove();
        };

        map.once("load", () => {
          if (cancelled) return;
          applyCountryStyles(map, fillColorExpressionRef.current, themeRef.current);
          map.setCenter(EARTH_OVERVIEW_CENTER);
          map.setZoom(EARTH_OVERVIEW_ZOOM);
          map.resize();
          map.on("click", COUNTRY_FILL_LAYER, handleClick);
          map.on("mousemove", COUNTRY_FILL_LAYER, handleMove);
          map.on("mouseleave", COUNTRY_FILL_LAYER, handleLeave);
        });

        const resizeObserver = new ResizeObserver(() => {
          map.resize();
        });
        resizeObserver.observe(containerRef.current);

        cleanup = () => {
          resizeObserver.disconnect();
          map.off("click", COUNTRY_FILL_LAYER, handleClick);
          map.off("mousemove", COUNTRY_FILL_LAYER, handleMove);
          map.off("mouseleave", COUNTRY_FILL_LAYER, handleLeave);
          hoveredRowRef.current = null;
          hoveredLngLatRef.current = null;
          popup.remove();
          popupRef.current = null;
          map.remove();
          mapRef.current = null;
        };
      })
      .catch(() => {
        if (!cancelled) setMapError("Map failed to initialize.");
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyCountryStyles(map, fillColorExpression, theme);
    map.resize();
    if (!popupRef.current || !hoveredRowRef.current || !hoveredLngLatRef.current) return;
    renderCountryPopup(popupRef.current, hoveredLngLatRef.current, hoveredRowRef.current, theme, map);
  }, [fillColorExpression, rowsByCountryKey, theme]);

  return (
    <div className="space-y-2">
      <div
        className={`h-80 w-full overflow-hidden rounded-lg border ${
          isDark ? "border-gray-700 bg-gray-900" : "border-gray-300 bg-white"
        }`}
      >
        <div
          ref={containerRef}
          aria-label="Country popularity map"
          data-country-map-container=""
          style={{ height: "100%", width: "100%" }}
        />
      </div>
      <div className={isDark ? "text-xs text-white/55" : "text-xs text-slate-500"}>
        Colored countries indicate where papers are concentrated.
        {onCountryClick ? " Click a colored country to filter the paper list." : ""}
      </div>
      {mapError ? (
        <div className={isDark ? "text-xs text-amber-300" : "text-xs text-amber-700"}>{mapError}</div>
      ) : null}
    </div>
  );
}

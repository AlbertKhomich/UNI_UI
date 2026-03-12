"use client";

import { useEffect, useRef, useState } from "react";
import type { DescribeLocationPoint } from "@/lib/describeLocations";
import { hideReferenceLatitudeLayers } from "@/lib/mapStyle";

type DescribeLocationMapProps = {
  isDark: boolean;
  points: DescribeLocationPoint[];
};

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json";
const EARTH_OVERVIEW_CENTER: [number, number] = [0, 20];
const EARTH_OVERVIEW_ZOOM = 0.7;

export default function DescribeLocationMap(props: DescribeLocationMapProps) {
  const { isDark, points } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0 || process.env.NODE_ENV === "test") return;

    let cancelled = false;
    let cleanup = () => {};
    setMapError(null);

    void import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: DEFAULT_STYLE,
          center: EARTH_OVERVIEW_CENTER,
          zoom: EARTH_OVERVIEW_ZOOM,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        map.on("error", () => {
          if (!cancelled) setMapError("Map tiles failed to load.");
        });

        const markers = points.map((point) => {
          const marker = new maplibregl.Marker({ color: isDark ? "#67e8f9" : "#0f766e" })
            .setLngLat([point.longitude, point.latitude])
            .setPopup(
              new maplibregl.Popup({ offset: 20 }).setHTML(
                `<strong>${point.label}</strong><br/>${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`,
              ),
            )
            .addTo(map);

          return marker;
        });

        map.once("load", () => {
          if (cancelled) return;
          hideReferenceLatitudeLayers(map);
          map.setCenter(EARTH_OVERVIEW_CENTER);
          map.setZoom(EARTH_OVERVIEW_ZOOM);
        });

        cleanup = () => {
          markers.forEach((marker) => marker.remove());
          map.remove();
        };
      })
      .catch(() => {
        if (!cancelled) setMapError("Map failed to initialize.");
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isDark, points]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`h-72 w-full overflow-hidden rounded-lg border ${
          isDark ? "border-gray-700 bg-gray-900" : "border-gray-300 bg-white"
        }`}
        aria-label={`Map showing ${points.length} location${points.length === 1 ? "" : "s"}`}
      />
      {mapError ? (
        <div className={isDark ? "text-xs text-amber-300" : "text-xs text-amber-700"}>{mapError}</div>
      ) : null}
    </div>
  );
}

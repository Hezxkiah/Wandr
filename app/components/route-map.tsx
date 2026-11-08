"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { WandrRoute } from "../lib/routes";

const ROUTE_COLORS = ["#527A7A", "#d95d39", "#536d45"];
const EARTHY_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }],
};

export type MapStyle = "simple" | "satellite";

type RouteMapProps = {
  routes: WandrRoute[];
  selectedId: string;
  onSelect?: (routeId: string) => void;
  interactive?: boolean;
  mapStyle?: MapStyle;
};

function layerIds(routeId: string) {
  return {
    source: `route-source-${routeId}`,
    outline: `route-outline-${routeId}`,
    fill: `route-fill-${routeId}`,
  };
}

export default function RouteMap({
  routes,
  selectedId,
  onSelect,
  interactive = true,
  mapStyle = "simple",
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!containerRef.current || routes.length === 0) return;

    let disposed = false;

    async function mountMap() {
      const maplibregl = await import("maplibre-gl");
      if (disposed || !containerRef.current) return;

      maplibregl.setWorkerUrl(
        new URL(
          "maplibre-gl/dist/maplibre-gl-worker.mjs",
          import.meta.url,
        ).toString(),
      );

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle === "simple" ? EARTHY_STYLE : SATELLITE_STYLE,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );

      map.on("load", () => {
        if (disposed) return;

        const bounds = new maplibregl.LngLatBounds();
        routes.forEach((route) => {
          route.geometry.coordinates.forEach((coordinate) => {
            bounds.extend(coordinate);
          });
        });

        const routesInPaintOrder = [...routes].sort((first, second) => {
          if (first.id === selectedIdRef.current) return 1;
          if (second.id === selectedIdRef.current) return -1;
          return 0;
        });

        routesInPaintOrder.forEach((route) => {
          const routeIndex = routes.findIndex((candidate) => candidate.id === route.id);
          const color = ROUTE_COLORS[routeIndex] ?? ROUTE_COLORS[0];
          const active = route.id === selectedIdRef.current;
          const ids = layerIds(route.id);

          map.addSource(ids.source, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: route.geometry,
            },
          });
          map.addLayer({
            id: ids.outline,
            type: "line",
            source: ids.source,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": color,
              "line-width": active ? 2 : 2,
              "line-gap-width": active ? 6 : 4,
              "line-opacity": 1,
            },
          });
          map.addLayer({
            id: ids.fill,
            type: "line",
            source: ids.source,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": color,
              "line-width": active ? 6 : 4,
              "line-opacity": active ? 1 : 0.35,
            },
          });

          if (interactive) {
            const selectRoute = () => onSelectRef.current?.(route.id);
            map.on("click", ids.outline, selectRoute);
            map.on("click", ids.fill, selectRoute);
            map.on("mouseenter", ids.outline, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", ids.outline, () => {
              map.getCanvas().style.cursor = "";
            });
          }
        });

        const firstRoute = routes[0];
        const start = firstRoute.geometry.coordinates[0];
        const end = firstRoute.geometry.coordinates.at(-1);
        if (start && end) {
          const isRoundTrip = firstRoute.properties.mode === "round_trip";
          map.addSource("route-endpoints", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: { kind: "start" },
                  geometry: { type: "Point", coordinates: start },
                },
                ...(!isRoundTrip ? [{
                  type: "Feature",
                  properties: { kind: "end" },
                  geometry: { type: "Point", coordinates: end },
                } as const] : []),
              ],
            },
          });
          map.addLayer({
            id: "route-endpoints",
            type: "circle",
            source: "route-endpoints",
            paint: {
              "circle-radius": 8,
              "circle-color": [
                "match",
                ["get", "kind"],
                "start",
                "#f6f0df",
                "#d95d39",
              ],
              "circle-stroke-color": "#111111",
              "circle-stroke-width": 3,
            },
          });
        }

        map.fitBounds(bounds, { padding: 44, duration: 0 });
      });
    }

    mountMap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [interactive, mapStyle, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.loaded()) return;

    routes.forEach((route) => {
      const active = route.id === selectedId;
      const ids = layerIds(route.id);
      if (!map.getLayer(ids.outline) || !map.getLayer(ids.fill)) return;

      map.setPaintProperty(ids.outline, "line-width", active ? 2 : 2);
      map.setPaintProperty(ids.outline, "line-gap-width", active ? 6 : 4);
      map.setPaintProperty(ids.fill, "line-width", active ? 6 : 4);
      map.setPaintProperty(ids.fill, "line-opacity", active ? 1 : 0.35);
      if (active) {
        map.moveLayer(ids.outline);
        map.moveLayer(ids.fill);
        if (map.getLayer("route-endpoints")) map.moveLayer("route-endpoints");
      }
    });
  }, [routes, selectedId]);

  return <div ref={containerRef} className="h-full w-full bg-[#c9d5c3]" />;
}

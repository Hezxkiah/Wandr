"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RouteMap, { type MapStyle } from "../components/route-map";
import SiteHeader from "../components/site-header";
import {
  formatDistance,
  formatDuration,
  walkScore,
  ROUTES_STORAGE_KEY,
  SELECTED_ROUTE_STORAGE_KEY,
  type RouteCollection,
} from "../lib/routes";

const ROUTE_COLORS = ["#527A7A", "#d95d39", "#536d45"];
const MAP_STYLES: MapStyle[] = ["simple", "satellite"];

export default function MapPage() {
  const router = useRouter();
  const [collection, setCollection] = useState<RouteCollection | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [mapStyle, setMapStyle] = useState<MapStyle>("simple");

  useEffect(() => {
    const saved = sessionStorage.getItem(ROUTES_STORAGE_KEY);
    if (!saved) return;
    queueMicrotask(() => {
      try {
        const parsed = JSON.parse(saved) as RouteCollection;
        parsed.features.sort(
          (first, second) =>
            (walkScore(second) ?? -1) - (walkScore(first) ?? -1),
        );
        setCollection(parsed);
        setSelectedId(parsed.features[0]?.id ?? "");
      } catch {
        sessionStorage.removeItem(ROUTES_STORAGE_KEY);
      }
    });
  }, []);

  const selectedRoute = useMemo(
    () => collection?.features.find((route) => route.id === selectedId),
    [collection, selectedId],
  );

  function chooseRoute() {
    if (!selectedRoute) return;
    sessionStorage.setItem(
      SELECTED_ROUTE_STORAGE_KEY,
      JSON.stringify(selectedRoute),
    );
    router.push("/walk");
  }

  if (!collection || collection.features.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col bg-[#d6d7b9]">
        <SiteHeader />
        <section className="grid flex-1 place-items-center px-4 text-center">
          <div>
            <p className="mb-5 text-2xl">no routes here yet.</p>
            <Link
              href="/"
              className="rounded-4xl bg-black px-8 py-4 text-white hover:bg-neutral-800"
            >
              go back
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#d6d7b9]">
      <SiteHeader />

      <div className="relative min-h-0 flex-1">
        <aside className="absolute left-3 top-3 z-[500] max-h-[calc(100%-24px)] w-[min(350px,calc(100%-24px))] overflow-y-auto rounded-4xl bg-white p-4">
          <div className="mb-4 flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to the landing page"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-2xl">suggested routes</h1>
          </div>

          <div className="space-y-3">
            {collection.features.map((route, index) => {
              const active = route.id === selectedId;
              const score = walkScore(route);
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedId(route.id)}
                  aria-pressed={active}
                  className={`w-full cursor-pointer rounded-4xl border-l-4 px-5 py-4 text-left lowercase transition-colors ${
                    active
                      ? "bg-[#d8d8d0]"
                      : "bg-[#f3f3ed] hover:bg-[#e8e8e1]"
                  }`}
                  style={{ borderLeftColor: ROUTE_COLORS[index] }}
                >
                  <span className="flex items-baseline justify-between gap-3 text-black">
                    <span className="text-lg">overall score</span>
                    <span className="text-3xl font-bold">
                      {score == null ? <span className="text-base font-normal">unavailable</span> : <>{Math.round(score / 10)}<span className="ml-1 text-lg font-normal text-black/60">/10</span></>}
                    </span>
                  </span>
                  <span className="mt-3 block text-base text-black/80">
                    {formatDuration(route.properties.duration_minutes)} ({formatDistance(route.properties.distance_meters)})
                  </span>
                  <span className="mt-4 block space-y-2 border-t border-black/10 pt-3 text-sm text-black/80">
                    <span className="flex items-center justify-between gap-3">
                      <span>mapped scenery</span>
                      <span>{route.properties.scenery ? `${Math.round(route.properties.scenery.score / 10)}/10` : "unavailable"}</span>
                    </span>
                    <span className="flex items-center justify-between gap-3">
                      <span>quieter roads</span>
                      <span>{route.properties.low_traffic_percent == null ? "unavailable" : `${Math.round(route.properties.low_traffic_percent / 10)}/10`}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-0 bg-white pt-4">
            <button
              type="button"
              onClick={chooseRoute}
              className="w-full cursor-pointer rounded-4xl bg-black px-8 py-4 text-white hover:bg-neutral-800"
            >
              start walking
            </button>
          </div>
        </aside>

        <section className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-3 left-3 z-[500] flex rounded-4xl bg-white p-1">
            {MAP_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setMapStyle(style)}
                aria-pressed={mapStyle === style}
                className={`cursor-pointer rounded-4xl px-3 py-2 text-xs lowercase sm:text-sm ${
                  mapStyle === style ? "bg-black text-white" : "hover:bg-neutral-100"
                }`}
              >
                {style === "simple" ? "map" : style}
              </button>
            ))}
          </div>

          <RouteMap
            routes={collection.features}
            selectedId={selectedId}
            onSelect={setSelectedId}
            mapStyle={mapStyle}
          />
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RouteMap from "../components/route-map";
import SiteHeader from "../components/site-header";
import { formatDistance, formatDuration, SELECTED_ROUTE_STORAGE_KEY, type WandrRoute } from "../lib/routes";

export default function WalkPage() {
  const [route, setRoute] = useState<WandrRoute | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SELECTED_ROUTE_STORAGE_KEY);
    if (!saved) return;
    queueMicrotask(() => {
      try { setRoute(JSON.parse(saved) as WandrRoute); } catch { sessionStorage.removeItem(SELECTED_ROUTE_STORAGE_KEY); }
    });
  }, []);

  if (!route) {
    return (
      <main className="flex min-h-dvh flex-col bg-[#d6d7b9]">
        <SiteHeader />
        <section className="grid flex-1 place-items-center text-center">
          <div><p className="mb-5 text-2xl">choose a path first.</p><Link href="/map" className="underline underline-offset-4">back to route options</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#d6d7b9]">
      <SiteHeader />
      <div className="relative min-h-0 flex-1">
        <RouteMap routes={[route]} selectedId={route.id} interactive={false} />
        <section className="absolute inset-x-3 bottom-3 z-[500] rounded-3xl border-2 border-black bg-[#f6f0df] p-4 shadow-[5px_5px_0_#111] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[380px] sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <p>{started ? "wandering now" : "ready when you are"}</p>
            <Link href="/map" className="text-xs underline underline-offset-4">change</Link>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3 border-y border-black/20 py-3 text-sm">
            <p>{formatDuration(route.properties.duration_minutes)}</p><p>{formatDistance(route.properties.distance_meters)}</p><p>{route.properties.instructions.length} turns</p>
          </div>
          {started && route.properties.instructions[0]?.text && (
            <div className="mb-4 rounded-2xl bg-white p-3"><p className="text-[10px] text-black/45">first direction</p><p>{route.properties.instructions[0].text}</p></div>
          )}
          <button type="button" onClick={() => setStarted((value) => !value)} className="w-full cursor-pointer rounded-full border-2 border-black bg-black px-5 py-3.5 text-white shadow-[4px_4px_0_#d95d39]">
            {started ? "pause walk" : "start walking →"}
          </button>
        </section>
      </div>
    </main>
  );
}

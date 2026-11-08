"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import RouteMap from "../components/route-map";
import SiteHeader from "../components/site-header";
import { formatDistance, formatDuration, SELECTED_ROUTE_STORAGE_KEY, type WandrRoute } from "../lib/routes";
import { instructionAt, lengths, positionAt, project, type Coord } from "../lib/progress";

export default function WalkPage() {
  const [route, setRoute] = useState<WandrRoute | null>(null);
  const [started, setStarted] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [position, setPosition] = useState<Coord | null>(null);
  const [message, setMessage] = useState("");
  const routes = useMemo(() => route ? [route] : [], [route]);
  const points = useMemo(() => route?.geometry.coordinates ?? [], [route]);
  const distances = useMemo(() => lengths(points), [points]);
  const total = distances.at(-1) ?? 0;

  useEffect(() => { progressRef.current = progress; }, [progress]);

  useEffect(() => {
    const saved = sessionStorage.getItem(SELECTED_ROUTE_STORAGE_KEY);
    if (!saved) return;
    queueMicrotask(() => {
      try { setRoute(JSON.parse(saved) as WandrRoute); } catch { sessionStorage.removeItem(SELECTED_ROUTE_STORAGE_KEY); }
    });
  }, []);

  useEffect(() => {
    if (!started || !simulate || !total) return;
    const timer = window.setInterval(() => setProgress((p) => Math.min(total, p + 1.39 * speed)), 1000);
    return () => window.clearInterval(timer);
  }, [started, simulate, speed, total]);

  useEffect(() => {
    if (!simulate || !points.length) return;
    queueMicrotask(() => setPosition(positionAt(points, distances, progress)));
  }, [simulate, points, distances, progress]);

  useEffect(() => {
    if (!started || simulate || !points.length) return;
    if (!navigator.geolocation) { queueMicrotask(() => setMessage("Location is not supported by this browser.")); return; }
    const watch = navigator.geolocation.watchPosition((location) => {
      const next: Coord = [location.coords.longitude, location.coords.latitude];
      setPosition(next);
      if (location.coords.accuracy > 80) { setMessage("GPS accuracy is low; waiting for a better fix."); return; }
      const match = project(points, distances, next, progressRef.current);
      if (match.distance > 50) { setMessage("You appear to be off the route. Progress is paused."); return; }
      setMessage("");
      setProgress((previous) => Math.max(previous, match.progress));
    }, (error) => setMessage(error.code === error.PERMISSION_DENIED ? "Location permission denied. Allow access and try again." : "Location unavailable. Check location services and try again."), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [started, simulate, points, distances]);

  if (!route) return <main className="flex min-h-dvh flex-col bg-[#d6d7b9]"><SiteHeader /><section className="grid flex-1 place-items-center text-center"><div><p className="mb-5 text-2xl">choose a path first.</p><Link href="/map" className="underline underline-offset-4">back to route options</Link></div></section></main>;

  const arrived = total > 0 && progress >= total - 5;
  const instruction = instructionAt(route.properties.instructions, distances, progress);
  const instructionEnd = instruction?.interval ? distances[instruction.interval[1]] : undefined;

  return <main className="flex h-dvh flex-col overflow-hidden bg-[#d6d7b9]">
    <SiteHeader />
    <div className="relative min-h-0 flex-1">
      <RouteMap routes={routes} selectedId={route.id} interactive={false} position={position} />
      <section className="absolute inset-x-3 bottom-3 z-[500] max-h-[75%] overflow-y-auto rounded-3xl border-2 border-black bg-[#f6f0df] p-4 shadow-[5px_5px_0_#111] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[380px] sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4"><p>{arrived ? "walk complete" : started ? "wandering now" : "ready when you are"}</p><Link href="/map" className="text-xs underline underline-offset-4">change</Link></div>
        <div className="mb-4 grid grid-cols-3 gap-3 border-y border-black/20 py-3 text-sm"><p>{formatDuration(route.properties.duration_minutes)}</p><p>{formatDistance(Math.max(0, total - progress))} left</p><p>{Math.round(total ? progress / total * 100 : 0)}% complete</p></div>
        {(started || arrived) && <div className="mb-4 rounded-2xl bg-white p-3" aria-live="polite"><p className="text-xs text-black/60">{simulate ? "simulated direction" : "current direction"}</p><p>{arrived ? "You have arrived." : instruction?.text ?? "Continue along the route."}</p>{!arrived && instructionEnd != null && <p className="text-xs">{formatDistance(Math.max(0, instructionEnd - progress))} until next instruction</p>}</div>}
        {message && <p role="status" className="mb-3 text-sm text-red-800">{message}</p>}
        {process.env.NODE_ENV === "development" && <fieldset className="mb-4 rounded-2xl border border-black/30 p-3 text-sm"><legend>Development simulator</legend><label className="flex gap-2"><input type="checkbox" checked={simulate} onChange={(e) => { setStarted(false); setSimulate(e.target.checked); setProgress(0); setPosition(null); setMessage(""); }} /> Simulate location (not GPS)</label>{simulate && <><label className="mt-2 block">Progress: {Math.round(total ? progress / total * 100 : 0)}%<input aria-label="Simulated route progress" className="w-full" type="range" min="0" max={total || 1} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></label><label>Speed <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={10}>10×</option><option value={30}>30×</option><option value={60}>60×</option></select></label></>}</fieldset>}
        <button type="button" onClick={() => { if (arrived) setProgress(0); setStarted((value) => arrived ? true : !value); }} className="w-full cursor-pointer rounded-full border-2 border-black bg-black px-5 py-3.5 text-white shadow-[4px_4px_0_#d95d39]">{arrived ? "restart walk" : started ? "pause walk" : "start walking →"}</button>
      </section>
    </div>
  </main>;
}

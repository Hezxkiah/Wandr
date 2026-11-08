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
  const [landmarkMessage, setLandmarkMessage] = useState("");
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

  const segmentIndex = Math.min(points.length - 2, Math.max(0, distances.findIndex((distance) => distance > progress) - 1));
  const routeHeadingDegrees = points.length > 1 && segmentIndex >= 0
    ? (Math.atan2((points[segmentIndex + 1][0] - points[segmentIndex][0]) * Math.cos(points[segmentIndex][1] * Math.PI / 180), points[segmentIndex + 1][1] - points[segmentIndex][1]) * 180 / Math.PI + 360) % 360
    : 0;

  const narrationPosition = useRef({ position, progress, total, routeHeadingDegrees });
  useEffect(() => {
    narrationPosition.current = { position, progress, total, routeHeadingDegrees };
  }, [position, progress, total, routeHeadingDegrees]);
  // Refresh after roughly a short block, rather than aborting on every GPS tick.
  const landscapeCell = position ? `${Math.floor(position[0] * 1250)}:${Math.floor(position[1] * 1250)}` : "";
  const progressBlock = Math.floor(progress / 150);

  useEffect(() => {
    if (!simulate || !landscapeCell) return;
    const controller = new AbortController();
    async function updateContext() {
      const current = narrationPosition.current;
      if (!current.position) return;
      let contextLoaded = false;
      const body = JSON.stringify({ coordinate: { lon: current.position[0], lat: current.position[1] }, progress_meters: current.progress, total_meters: current.total, route_heading_degrees: current.routeHeadingDegrees });
      try {
        const response = await fetch("http://localhost:8000/walk-context", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body,
        });
        if (!response.ok) throw new Error("Context unavailable");
        const data = await response.json();
        if (controller.signal.aborted) return;
        setLandmarkMessage(data.message);
        contextLoaded = true;
        if (data.llm_available) {
          const generated = await fetch("http://localhost:8000/narration", {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body,
          });
          if (!generated.ok) return;
          const narration = await generated.json();
          if (!controller.signal.aborted) setLandmarkMessage(narration.message);
        }
      } catch {
        if (!controller.signal.aborted && !contextLoaded) setLandmarkMessage("Local surroundings couldn’t be loaded. Keep taking in what’s around you.");
      }
    }
    void updateContext();
    return () => controller.abort();
  }, [simulate, landscapeCell, progressBlock]);

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
      <section className="absolute bottom-3 left-3 z-[500] max-h-[calc(100%-24px)] w-[min(350px,calc(100%-24px))] overflow-y-auto rounded-4xl bg-white p-4 sm:bottom-auto sm:left-5 sm:top-5">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/map" aria-label="Back to route options" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-black/5">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
        </div>
        {!started && !arrived && (
          <div className="mb-4 rounded-4xl bg-[#f3f3ed] px-4 py-4">
            <p className="mb-1 text-xs text-black/60">route overview</p>
            <p className="text-2xl">
              {formatDuration(route.properties.duration_minutes)} <span aria-hidden="true">&middot;</span>{" "}
              {formatDistance(route.properties.distance_meters)}
            </p>
          </div>
        )}
        {(started || arrived) && (
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-4xl bg-[#f3f3ed] px-4 py-4 text-sm">
          <p><span className="block text-base">{formatDuration(route.properties.duration_minutes)}</span><span className="text-xs text-black/60">total time</span></p>
          <p><span className="block text-base">{formatDistance(Math.max(0, total - progress))}</span><span className="text-xs text-black/60">distance left</span></p>
          <p><span className="block text-base">{Math.round(total ? progress / total * 100 : 0)}%</span><span className="text-xs text-black/60">complete</span></p>
        </div>
        )}
        {(started || arrived) && (
          <div className="mb-4 rounded-4xl bg-[#f3f3ed] px-4 py-4" aria-live="polite">
            <p className="mb-1 text-xs text-black/60">{arrived ? "walk status" : simulate ? "simulated direction" : "current direction"}</p>
            <p className="text-2xl">{arrived ? "Walk complete" : instruction?.text ?? "Continue along the route."}</p>
            {!arrived && instructionEnd != null && (
              <p className="mt-2 text-xs text-black/60">{formatDistance(Math.max(0, instructionEnd - progress))} until next instruction</p>
            )}
          </div>
        )}
        {message && <p role="status" className="mb-3 text-sm text-red-800">{message}</p>}
        {process.env.NODE_ENV === "development" && <fieldset className="mb-4 rounded-2xl border border-black/30 p-3 text-sm"><legend>Development simulator</legend><label className="flex gap-2"><input type="checkbox" checked={simulate} onChange={(e) => { setStarted(false); setSimulate(e.target.checked); setProgress(0); setPosition(null); setMessage(""); }} /> Simulate location (not GPS)</label>{simulate && <><label className="mt-2 block">Progress: {Math.round(total ? progress / total * 100 : 0)}%<input aria-label="Simulated route progress" className="w-full" type="range" min="0" max={total || 1} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></label><label>Speed <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={10}>10×</option><option value={30}>30×</option><option value={60}>60×</option></select></label></>}</fieldset>}
        <button type="button" onClick={() => { if (arrived) setProgress(0); setStarted((value) => arrived ? true : !value); }} className="w-full cursor-pointer rounded-4xl bg-black px-8 py-4 text-white hover:bg-neutral-800">{arrived ? "restart walk" : started ? "pause walk" : "start walking →"}</button>
      </section>
      {landmarkMessage && simulate && (
        <aside
          className="absolute right-3 top-3 z-[500] max-h-[40%] w-[min(520px,calc(100%-24px))] overflow-y-auto rounded-4xl bg-[#f3f3ed] sm:right-5 sm:top-5"
          aria-live="polite"
        >
          <p className="rounded-4xl bg-[#f3f3ed] px-6 py-5 text-lg leading-relaxed">{landmarkMessage}</p>
        </aside>
      )}
    </div>
  </main>;
}

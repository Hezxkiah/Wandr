"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import SiteHeader from "./components/site-header";
import { ROUTES_STORAGE_KEY } from "./lib/routes";

type WalkMode = "point_to_point" | "round_trip";
type Place = { name: string; label: string; lat: number; lon: number; distance_km?: number | null };

const PRESET_LOCATIONS: { label: string; lat: number; lon: number }[] = [
  { label: "Austin, TX", lat: 30.2672, lon: -97.7431 },
  { label: "Dallas, TX", lat: 32.7767, lon: -96.797 },
];

function getCurrentLocation() {
  return new Promise<{ lat: number; lon: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser does not support location access."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => reject(new Error("Location access is required to start a walk.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<WalkMode>("round_trip");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState<{ lat: number; lon: number } | null>(null);
  const [destination, setDestination] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);

  function chooseStart(location: typeof start) {
    setStart(location);
    setDestination("");
    setSelectedPlace(null);
    setSuggestions([]);
    setSearchStatus("");
    setActiveOption(-1);
  }

  function selectPlace(place: Place) {
    setDestination(place.name ? `${place.name}${place.label !== place.name ? ` — ${place.label}` : ""}` : place.label);
    setSelectedPlace(place);
    setSearchOpen(false);
    setActiveOption(-1);
  }

  useEffect(() => {
    if (mode !== "point_to_point" || selectedPlace || destination.trim().length < 2) return;
    const controller = new AbortController();
    let disposed = false;
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: destination.trim() });
      if (start) { params.set("lat", String(start.lat)); params.set("lon", String(start.lon)); }
      setSearchStatus("Searching places…");
      const timeout = window.setTimeout(() => controller.abort("timeout"), 10_000);
      try {
        const response = await fetch(`http://localhost:8000/places?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const places: Place[] = await response.json();
        if (disposed || controller.signal.aborted) return;
        setSuggestions(places);
        setSearchStatus(places.length ? "" : "No local matches. Try a place name or full address.");
      } catch {
        if (!disposed && (!controller.signal.aborted || controller.signal.reason === "timeout")) {
          setSuggestions([]);
          setSearchStatus(controller.signal.reason === "timeout" ? "Place search timed out. Please try again." : "Place search is unavailable. Check that the backend is running.");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }, 250);
    return () => { disposed = true; window.clearTimeout(timer); controller.abort(); };
  }, [destination, mode, selectedPlace, start]);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const minutes = Number(formData.get("duration"));

    const endName =
      mode === "point_to_point"
        ? String(formData.get("end_name") ?? "").trim()
        : undefined;

    try {
      const startCoord = start ?? (await getCurrentLocation());
      const response = await fetch("http://localhost:8000/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          start: startCoord,
          end_name: selectedPlace && mode === "point_to_point" ? undefined : endName,
          end: selectedPlace && mode === "point_to_point" ? { lat: selectedPlace.lat, lon: selectedPlace.lon } : undefined,
          vibe: "serenity",
          target_minutes: minutes,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail ?? "Route generation failed");
      }

      const routes = await response.json();
      sessionStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
      router.push("/map");
      setIsLoading(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while finding routes.",
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#d6d7b9]">
      <SiteHeader />
      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-col items-center justify-center gap-6 px-4 -translate-y-16"
      >
        <Image
          src="/walking.PNG"
          alt="Poyo walking along a garden path"
          width={455}
          height={322}
          preload
          className="h-auto w-[min(360px,75vw)]"
        />
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-y-2 rounded-4xl bg-white px-8 py-3 lowercase">
            <label htmlFor="duration">i want to wander for</label>
            <select
              id="duration"
              name="duration"
              defaultValue="15"
              className="mx-3 cursor-pointer rounded-lg border border-gray-300 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              {[5, 10, 15, 20, 30, 45].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
            <span>minutes and</span>
            <label htmlFor="walk-mode" className="sr-only">
              where the walk ends
            </label>
            <select
              id="walk-mode"
              name="mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as WalkMode)}
              className="mx-3 cursor-pointer rounded-lg border border-gray-300 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <option value="round_trip">come back here</option>
              <option value="point_to_point">end up at</option>
            </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-4xl bg-black px-8 py-4 text-white hover:bg-neutral-800 cursor-pointer disabled:cursor-wait disabled:opacity-70"
            >
              {isLoading ? "finding paths..." : "go!"}
            </button>
          </div>

          <fieldset className="flex flex-wrap items-center justify-center gap-2">
            <legend className="sr-only">Starting location</legend>
            <button
              type="button"
              onClick={() => chooseStart(null)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors ${
                start === null ? "bg-olive-600 text-white" : "bg-[#f3f3ed] hover:bg-[#e8e8e1]"
              }`}
            >
              Use my location
            </button>
            {PRESET_LOCATIONS.map((loc) => (
              <button
                key={loc.label}
                type="button"
                onClick={() => chooseStart(loc)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  start?.lat === loc.lat && start?.lon === loc.lon
                    ? "bg-neutral-700 text-white"
                    : "bg-[#f3f3ed] hover:bg-[#e8e8e1]"
                }`}
              >
                {loc.label}
              </button>
            ))}
          </fieldset>

        {mode === "point_to_point" && (
          <fieldset className="relative flex items-center gap-2 rounded-4xl bg-white px-5 py-3 lowercase">
            <legend className="sr-only">Destination</legend>
            <input
              type="text"
              name="end_name"
              maxLength={200}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={searchOpen && !selectedPlace && destination.trim().length >= 2}
              aria-controls="destination-results"
              aria-activedescendant={activeOption >= 0 ? `destination-result-${activeOption}` : undefined}
              autoComplete="off"
              value={destination}
              onChange={(event) => { setDestination(event.target.value); setSelectedPlace(null); setSuggestions([]); setSearchStatus(""); setSearchOpen(true); setActiveOption(-1); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") { setSearchOpen(false); setActiveOption(-1); }
                if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setSearchOpen(true); setActiveOption((i) => Math.min(i + 1, suggestions.length - 1)); }
                if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActiveOption((i) => Math.max(i - 1, 0)); }
                if (event.key === "Enter" && searchOpen && activeOption >= 0 && suggestions[activeOption]) { event.preventDefault(); selectPlace(suggestions[activeOption]); }
              }}
              aria-label="Destination name or address"
              required
              placeholder="a park, cafe, or address"
              className="w-56 rounded-lg border border-gray-300 px-3 py-2 normal-case placeholder:text-gray-400"
            />
            {searchOpen && !selectedPlace && destination.trim().length >= 2 && (
              <div className="absolute left-0 top-full z-[600] mt-2 max-h-80 w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-3xl border border-black/10 bg-white p-2 normal-case shadow-lg">
                <ul id="destination-results" role="listbox" aria-label="Destination results">
                  {suggestions.map((place, index) => (
                    <li key={`${place.lat}:${place.lon}:${place.name}`} role="option" id={`destination-result-${index}`} aria-selected={activeOption === index}>
                      <button type="button" tabIndex={-1} onPointerDown={(event) => event.preventDefault()} onClick={() => selectPlace(place)} className={`w-full cursor-pointer rounded-2xl px-4 py-3 text-left ${activeOption === index ? "bg-[#e8e8e1]" : "hover:bg-[#f3f3ed]"}`}>
                        <span className="block">{place.name || place.label}</span>
                        {place.name && place.label !== place.name && <span className="mt-1 block text-sm text-black/60">{place.label}</span>}
                        {place.distance_km != null && <span className="mt-1 block text-xs text-black/60">{place.distance_km} km from start</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {searchStatus && <p role="status" className="px-4 py-3 text-sm text-black/70">{searchStatus}</p>}
                <p className="px-4 py-2 text-xs text-black/50">Local map results · © OpenStreetMap contributors</p>
              </div>
            )}
            {selectedPlace && <span className="sr-only" role="status">Destination selected: {selectedPlace.name || selectedPlace.label}</span>}
          </fieldset>
        )}

        </div>

        {error && (
          <p role="alert" className="basis-full text-center text-sm text-[#9c321c]">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

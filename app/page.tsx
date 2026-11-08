"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SubmitEvent } from "react";
import SiteHeader from "./components/site-header";
import { ROUTES_STORAGE_KEY } from "./lib/routes";

type WalkMode = "point_to_point" | "round_trip";

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
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location permission was denied. Allow location access for this site and your browser, then try again."));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("Finding your location timed out. Check location services and Wi-Fi, then try again."));
        } else {
          reject(new Error("Your location is temporarily unavailable. Check location services and Wi-Fi, then try again."));
        }
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
    );
  });
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<WalkMode>("round_trip");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const minutes = Number(formData.get("duration"));

    try {
      const start = await getCurrentLocation();
      const endName =
        mode === "point_to_point"
          ? String(formData.get("end_name") ?? "").trim()
          : undefined;

      const response = await fetch("http://localhost:8000/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          start,
          end_name: endName,
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
    <div className="flex min-h-dvh w-full flex-col bg-[#d6d7b9] p-2">
      <SiteHeader />
      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-wrap items-center justify-center gap-4 px-4"
      >
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

        {mode === "point_to_point" && (
          <fieldset className="flex items-center gap-2 rounded-4xl bg-white px-5 py-3 lowercase">
            <legend className="sr-only">Destination</legend>
            <input
              type="text"
              name="end_name"
              aria-label="Destination name or address"
              required
              placeholder="a park, cafe, or address"
              className="w-56 rounded-lg border border-gray-300 px-3 py-2 normal-case placeholder:text-gray-400"
            />
          </fieldset>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-4xl bg-black px-8 py-4 text-white hover:bg-neutral-800 cursor-pointer disabled:cursor-wait disabled:opacity-70"
        >
          {isLoading ? "finding paths..." : "go!"}
        </button>

        {error && (
          <p role="alert" className="basis-full text-center text-sm text-[#9c321c]">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

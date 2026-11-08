"use client";
import type { SubmitEvent } from "react";

export default function Home() {
  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const minutes = Number(formData.get("duration"));

    console.log("Selected minutes:", minutes);
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#CEE1B6] p-4">
      <header>wandr</header>

      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-wrap items-center justify-center gap-4"
      >
        <label
          htmlFor="duration"
          className="rounded-4xl bg-white px-8 py-3 lowercase"
        >
          <span>I want to wander for</span>

          <select
            id="duration"
            name="duration"
            defaultValue="15"
            className="mx-2 cursor-pointer rounded-lg border border-gray-300 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            {[5, 10, 15, 20, 30, 45].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes}
              </option>
            ))}
          </select>

          <span>minutes</span>
        </label>

        <button
          type="submit"
          className="rounded-4xl bg-black px-8 py-4 text-white hover:bg-neutral-800 cursor-pointer"
        >
          go!
        </button>
      </form>
    </div>
  );
}
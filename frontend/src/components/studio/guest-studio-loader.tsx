"use client";

import dynamic from "next/dynamic";

/** Loads the guest studio in the browser only: its starting plan comes from localStorage. */
export const GuestStudio = dynamic(() => import("./guest-studio"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      Opening the demo…
    </div>
  ),
});

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CycleLine — plan with intent",
    short_name: "CycleLine",
    description: "A cycling route planner: real routing, elevation, surface mix and GPX export.",
    start_url: "/demo",
    display: "standalone",
    background_color: "#0b0c0c",
    theme_color: "#0b0c0c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

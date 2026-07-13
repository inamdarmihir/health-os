import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Health OS",
    short_name: "Health OS",
    description: "Personal AI health intelligence for face, posture, body composition, recovery and visual coaching.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070d",
    theme_color: "#05070d",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}

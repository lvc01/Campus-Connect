import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CU Campus Connect",
    short_name: "Campus Connect",
    description:
      "The verified, university-only social network for Chandigarh University students.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcfaf7",
    theme_color: "#dc2626",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/maskable-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["social", "education", "lifestyle"],
  };
}

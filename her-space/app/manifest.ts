import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Her Space",
    short_name: "Her Space",
    description: "Learn. Share. Know yourself.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7FD",
    theme_color: "#2A1B3D",
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

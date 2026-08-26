import { createFileRoute } from "@tanstack/react-router";

// Dynamic web app manifest so that "Add to Home Screen" from a personalized
// link (/?u=<slug>) installs the app with that user's URL as start_url
// instead of the generic "/" declared in the static manifest.
export const Route = createFileRoute("/api/public/manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawSlug = url.searchParams.get("u") ?? "";
        const slug = /^[a-z0-9-]{1,64}$/.test(rawSlug) ? rawSlug : null;

        const manifest = {
          name: "miDGT UI",
          short_name: "miDGT",
          description:
            "Recreación visual no oficial de una cartera de documentación del conductor, creada como proyecto de portfolio.",
          start_url: slug ? `/?u=${slug}` : "/",
          scope: "/",
          display: "standalone",
          background_color: "#0f4a82",
          theme_color: "#0f4a82",
          orientation: "portrait",
          icons: [
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});

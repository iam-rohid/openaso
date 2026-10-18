import type { APIRoute } from "astro";
import { renderOg } from "../lib/og";

export const GET: APIRoute = async () =>
  new Response(
    new Uint8Array(
      await renderOg({
        title: "The free, open-source ASO tool",
        subtitle:
          "Track App Store rankings, score keyword popularity and difficulty, and see what competitors rank for.",
      }),
    ),
    { headers: { "Content-Type": "image/png" } },
  );

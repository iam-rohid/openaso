import type { APIRoute, GetStaticPaths } from "astro";
import { ogPages, renderOg } from "../../lib/og";

export const getStaticPaths = (() =>
  Object.entries(ogPages).map(([slug, page]) => ({
    params: { slug },
    props: page,
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(props as (typeof ogPages)[keyof typeof ogPages])), {
    headers: { "Content-Type": "image/png" },
  });

import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { savedCountry } from "@/hooks/use-country";
import { routeTree } from "./routeTree.gen";

// Lets CSS adapt to the platform's window chrome (e.g. macOS traffic lights).
document.documentElement.dataset.platform = window.openaso.platform;

// Reopen on the storefront the app was last left on. After launch, links carry it along.
const country = savedCountry();
if (country && !window.location.hash.includes("country=")) {
  window.location.hash = `#/?country=${country}`;
}

const router = createRouter({ routeTree, history: createHashHistory(), defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

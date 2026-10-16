import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";

// Lets CSS adapt to the platform's window chrome (e.g. macOS traffic lights).
document.documentElement.dataset.platform = window.openaso.platform;

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

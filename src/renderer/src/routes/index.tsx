import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/components/home/home-view";

export const Route = createFileRoute("/")({
  component: HomeView,
});

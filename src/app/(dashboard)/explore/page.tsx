import type { Metadata } from "next";
import { KeywordExplorer } from "@/components/explore/keyword-explorer";

export const metadata: Metadata = { title: "Keyword Explorer" };

export default function ExplorePage() {
  return <KeywordExplorer />;
}

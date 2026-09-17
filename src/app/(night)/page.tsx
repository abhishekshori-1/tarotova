import { Suspense } from "react";
import { HomeExperience } from "@/components/HomeExperience";
import { JourneyEntry } from "@/components/JourneyEntry";

export default function Home() {
  return <HomeExperience journeys={<Suspense fallback={null}><JourneyEntry /></Suspense>} />;
}

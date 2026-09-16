"use client";
import { use } from "react";
import { JourneyExperience } from "@/components/JourneyExperience";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <JourneyExperience key={id} id={id} />;
}

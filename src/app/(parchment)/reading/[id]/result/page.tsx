"use client";
import { use } from "react";
import { ReadingExperience } from "@/components/ReadingExperience";
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReadingExperience key={id} id={id} />;
}

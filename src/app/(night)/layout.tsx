import { Shell } from "@/components/Shell";

export default function NightLayout({ children }: { children: React.ReactNode }) {
  return <Shell variant="night">{children}</Shell>;
}

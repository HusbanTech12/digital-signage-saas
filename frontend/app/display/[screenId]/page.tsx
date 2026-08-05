import { KioskPlayer } from "@/components/display/kiosk-player";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  return <KioskPlayer screenId={screenId} />;
}

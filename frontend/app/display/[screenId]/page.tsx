import { KioskPlayer } from "@/components/display/kiosk-player";

export default async function DisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{ device_token?: string }>;
}) {
  const { screenId } = await params;
  const query = await searchParams;
  return (
    <KioskPlayer
      screenId={screenId}
      initialDeviceToken={query.device_token}
    />
  );
}

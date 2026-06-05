import { OverlayStarsSurface } from "@/app/overlay/stars/overlay-stars-surface";
import { getLiveStarSupportData } from "@/lib/stars/star-send-service";

export const dynamic = "force-dynamic";

export default async function StarsOverlayPage() {
  const data = await getLiveStarSupportData();

  return (
    <>
      <style>{`
        html,
        body {
          background: transparent !important;
          margin: 0;
          overflow: hidden;
        }
      `}</style>
      <OverlayStarsSurface initialData={data} />
    </>
  );
}

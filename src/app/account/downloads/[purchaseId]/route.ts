import { redirect } from "next/navigation";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getOwnedTrackDownload } from "@/lib/music/music-service";

export async function GET(_request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  const user = await requireSignedInUser();
  const { purchaseId } = await params;
  const download = await getOwnedTrackDownload(user.id, purchaseId);

  if (!download) {
    redirect("/account/downloads?download=not-found");
  }

  if (!download.downloadUrl) {
    redirect("/account/downloads?download=missing");
  }

  redirect(download.downloadUrl);
}

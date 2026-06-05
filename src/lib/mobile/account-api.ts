import { getAccountNotificationsData, getAccountOverviewData, getAccountProfileData } from "@/lib/account/account-service";
import type { CurrentUser } from "@/lib/auth/rbac";
import { getCurrentUserFromRequest } from "@/lib/auth/session";
import { getAccountDownloadsData, getOwnedTrackDownload } from "@/lib/music/music-service";
import { getAccountRewardsData } from "@/lib/rewards/stars-service";
import { getAccountOrdersData } from "@/lib/shop/order-service";

export class MobileAuthError extends Error {
  constructor() {
    super("Authentication required.");
  }
}

export async function requireMobileUser(): Promise<CurrentUser> {
  const user = await getCurrentUserFromRequest();

  if (!user) {
    throw new MobileAuthError();
  }

  return user;
}

function userPayload(user: CurrentUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles
  };
}

export async function getMobileAccountPayload(user: CurrentUser) {
  const [overview, profile] = await Promise.all([getAccountOverviewData(user.id), getAccountProfileData(user.id)]);

  return {
    user: userPayload(user),
    overview,
    profile
  };
}

export async function getMobileNotificationsPayload(user: CurrentUser) {
  return getAccountNotificationsData(user.id);
}

export async function getMobileOrdersPayload(user: CurrentUser) {
  const data = await getAccountOrdersData(user.id);

  return {
    stats: data.stats,
    orders: data.orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalPence: order.totalPence,
      currency: order.currency,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      items: order.items
    }))
  };
}

export async function getMobileDownloadsPayload(user: CurrentUser) {
  const data = await getAccountDownloadsData(user.id);

  return {
    stats: data.stats,
    downloads: data.downloads.map((download) => ({
      id: download.id,
      trackId: download.trackId,
      trackTitle: download.trackTitle,
      producerName: download.producerName,
      genre: download.genre,
      bpm: download.bpm,
      musicalKey: download.musicalKey,
      pricePence: download.pricePence,
      licenseType: download.licenseType,
      licenseSummary: download.licenseSummary,
      downloadReady: Boolean(download.downloadUrl),
      downloadHref: `/api/mobile/v1/account/downloads/${download.id}`,
      downloadCount: download.downloadCount,
      lastDownloadedAt: download.lastDownloadedAt,
      completedAt: download.completedAt,
      createdAt: download.createdAt
    }))
  };
}

export async function getMobileDownloadDeliveryPayload(user: CurrentUser, purchaseId: string) {
  const result = await getOwnedTrackDownload(user.id, purchaseId);

  if (!result) {
    return null;
  }

  return {
    downloadUrl: result.downloadUrl,
    downloadReady: Boolean(result.downloadUrl),
    purchaseId: result.purchase.id,
    downloadCount: result.purchase.downloadCount,
    lastDownloadedAt: result.purchase.lastDownloadedAt?.toISOString() ?? null
  };
}

export async function getMobileRewardsAccountPayload(user: CurrentUser) {
  const data = await getAccountRewardsData(user.id);

  return {
    ...data,
    wallet: {
      balance: data.wallet.balance,
      updatedAt: data.wallet.updatedAt.toISOString()
    }
  };
}

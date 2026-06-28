import {
  getAccountNotificationsData,
  getAccountOverviewData,
  getAccountProfileData,
  updateAccountProfile,
  type AccountProfileInput
} from "@/lib/account/account-service";
import { notificationPreferenceCategories } from "@/lib/account/notification-preferences-core";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences
} from "@/lib/account/notification-preferences-service";
import type { CurrentUser } from "@/lib/auth/rbac";
import { getCurrentUserFromRequest } from "@/lib/auth/session";
import { getAccountDownloadsData, getOwnedTrackDownload } from "@/lib/music/music-service";
import { buildMobileRewardsAccountPayload } from "@/lib/mobile/account-rewards-payload-core";
import { getAccountRewardWheelsData, spinRewardWheel } from "@/lib/rewards/prize-service";
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
  const [overview, profile, notificationPreferences] = await Promise.all([
    getAccountOverviewData(user.id),
    getAccountProfileData(user.id),
    getUserNotificationPreferences(user.id)
  ]);

  return {
    user: userPayload(user),
    overview,
    profile,
    notificationPreferences
  };
}

export async function getMobileProfilePayload(user: CurrentUser) {
  return getAccountProfileData(user.id);
}

export async function updateMobileProfilePayload(user: CurrentUser, input: Partial<AccountProfileInput>) {
  const current = await getAccountProfileData(user.id);
  const profile = await updateAccountProfile(user.id, {
    avatarUrl: input.avatarUrl ?? current.profile.avatarUrl ?? "",
    bio: input.bio ?? current.profile.bio ?? "",
    displayName: input.displayName ?? current.displayName,
    isPublic: typeof input.isPublic === "boolean" ? input.isPublic : current.profile.isPublic,
    location: input.location ?? current.profile.location ?? "",
    slug: input.slug ?? current.profile.slug,
    websiteUrl: input.websiteUrl ?? current.profile.websiteUrl ?? ""
  });

  return {
    profile: await getAccountProfileData(user.id),
    profileUrl: profile.isPublic ? `/djs/${profile.slug}` : null
  };
}

export async function getMobileNotificationsPayload(user: CurrentUser) {
  return getAccountNotificationsData(user.id);
}

export async function getMobileNotificationPreferencesPayload(user: CurrentUser) {
  return {
    categories: notificationPreferenceCategories,
    preferences: await getUserNotificationPreferences(user.id)
  };
}

export async function updateMobileNotificationPreferencesPayload(user: CurrentUser, input: unknown) {
  const preferences = await updateUserNotificationPreferences(user.id, input);

  return {
    categories: notificationPreferenceCategories,
    preferences
  };
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
  const [starsData, wheelData] = await Promise.all([getAccountRewardsData(user.id), getAccountRewardWheelsData(user.id)]);

  return buildMobileRewardsAccountPayload(starsData, wheelData);
}

export async function spinMobileRewardWheelPayload(user: CurrentUser, input: unknown) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const wheelId = typeof body.wheelId === "string" ? body.wheelId.trim() : "";

  if (!wheelId) {
    throw new Error("Choose a reward wheel to spin.");
  }

  const result = await spinRewardWheel(user.id, wheelId);

  return {
    ok: true,
    result,
    rewards: await getMobileRewardsAccountPayload(user)
  };
}

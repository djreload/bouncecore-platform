import { getPublicChatData, type ChatMessageSummary, type ChatPresenceUserSummary, type ChatRoomSummary } from "@/lib/chat/chat-service";
import {
  getAvailableSheepThrowSprites,
  type SheepThrowSettings
} from "@/lib/chat/sheep-throw-settings";
import { getChatSheepThrowReadiness, getSheepThrowSettings } from "@/lib/chat/sheep-throw-service";
import { getPublicMusicTracks } from "@/lib/music/music-service";
import { buildMobileMusicPayload } from "@/lib/mobile/music-payload-core";
import { buildMobilePayPalCheckoutStatus } from "@/lib/mobile/paypal-checkout-status";
import { buildMobileShopPayload } from "@/lib/mobile/shop-payload-core";
import {
  getPayPalCheckoutReadiness,
  getPayPalIntegrationData,
  getPayPalMusicReadiness,
  getPayPalStarsReadiness
} from "@/lib/payments/paypal-service";
import { getSquareIntegrationData, getSquareShopReadiness, getSquareStarsReadiness } from "@/lib/payments/square-service";
import { starPackages } from "@/lib/rewards/stars-service";
import { getPublicShopProducts } from "@/lib/shop/shop-service";
import { getLiveStarSupportData } from "@/lib/stars/star-send-service";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";

export type MobileEndpoint = {
  href: string;
  key: string;
};

function publicRoom(room: ChatRoomSummary) {
  return {
    id: room.id,
    lockedAt: room.lockedAt,
    slug: room.slug,
    name: room.name,
    slowModeSeconds: room.slowModeSeconds,
    type: room.type,
    messages: room.messages
  };
}

function publicMessage(message: ChatMessageSummary) {
  const mediaOnlyMessage = ["gif", "sticker", "emoji"].includes(message.kind);

  return {
    id: message.id,
    roomId: message.roomId,
    replyTo: message.replyTo,
    body: mediaOnlyMessage ? "" : message.body,
    kind: message.kind,
    mediaUrl: message.mediaUrl,
    mediaPreviewUrl: message.mediaPreviewUrl,
    mediaAlt: message.mediaAlt,
    mediaWidth: message.mediaWidth,
    mediaHeight: message.mediaHeight,
    effectId: message.effectId,
    starAmount: message.starAmount,
    starNote: message.starNote,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    author: {
      avatarUrl: message.authorAvatarUrl,
      displayName: message.authorDisplayName,
      roles: message.authorRoles
    },
    reactions: message.reactions.map((reaction) => ({
      key: reaction.key,
      count: reaction.count
    }))
  };
}

function publicPresenceUser(user: ChatPresenceUserSummary) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    roles: user.roles,
    status: user.status,
    lastActiveAt: user.lastActiveAt,
    throwHitCount: user.throwHitCount
  };
}

function publicSheepThrow(settings: SheepThrowSettings, readiness: Awaited<ReturnType<typeof getChatSheepThrowReadiness>>) {
  return {
    enabled: settings.enabled,
    cooldownSeconds: settings.cooldownSeconds,
    costStars: settings.costStars,
    effectiveCostStars: readiness.effectiveCostStars,
    freeThrowAvailable: readiness.freeThrowAvailable,
    latestThrowAt: readiness.latestThrowAt,
    remainingCooldownSeconds: readiness.remainingCooldownSeconds,
    sprites: getAvailableSheepThrowSprites(settings)
  };
}

export function getMobileEndpoints(): MobileEndpoint[] {
  return [
    { key: "config", href: "/api/mobile/v1/config" },
    { key: "auth.register", href: "/api/mobile/v1/auth/register" },
    { key: "auth.login", href: "/api/mobile/v1/auth/login" },
    { key: "auth.session", href: "/api/mobile/v1/auth/session" },
    { key: "auth.logout", href: "/api/mobile/v1/auth/logout" },
    { key: "account", href: "/api/mobile/v1/account" },
    { key: "account.profile", href: "/api/mobile/v1/account/profile" },
    { key: "account.devices", href: "/api/mobile/v1/account/devices" },
    { key: "account.notifications", href: "/api/mobile/v1/account/notifications" },
    { key: "account.notificationPreferences", href: "/api/mobile/v1/account/notification-preferences" },
    { key: "account.orders", href: "/api/mobile/v1/account/orders" },
    { key: "account.downloads", href: "/api/mobile/v1/account/downloads" },
    { key: "account.rewards", href: "/api/mobile/v1/account/rewards" },
    { key: "account.rewards.spin", href: "/api/mobile/v1/account/rewards/spin" },
    { key: "live", href: "/api/mobile/v1/live" },
    { key: "chat", href: "/api/mobile/v1/chat" },
    { key: "chat.gifs", href: "/api/mobile/v1/chat/gifs?q=rave" },
    { key: "chat.reports", href: "/api/mobile/v1/chat/reports" },
    { key: "checkout.shop.start", href: "/api/mobile/v1/checkout/shop" },
    { key: "checkout.shop.capture", href: "/api/mobile/v1/checkout/shop/capture" },
    { key: "checkout.shop.cancel", href: "/api/mobile/v1/checkout/shop/cancel" },
    { key: "checkout.music.start", href: "/api/mobile/v1/checkout/music" },
    { key: "checkout.music.capture", href: "/api/mobile/v1/checkout/music/capture" },
    { key: "checkout.music.cancel", href: "/api/mobile/v1/checkout/music/cancel" },
    { key: "checkout.stars.start", href: "/api/mobile/v1/checkout/stars" },
    { key: "checkout.stars.capture", href: "/api/mobile/v1/checkout/stars/capture" },
    { key: "checkout.stars.cancel", href: "/api/mobile/v1/checkout/stars/cancel" },
    { key: "shop", href: "/api/mobile/v1/shop" },
    { key: "music", href: "/api/mobile/v1/music" },
    { key: "rewards", href: "/api/mobile/v1/rewards" }
  ];
}

export async function getMobileLivePayload() {
  const live = await getPublicLiveState();

  return {
    activeIngests: live.activeIngests,
    channel: live.channel,
    health: live.health,
    offlineImageUrl: live.offlineImageUrl,
    playbackUrl: live.playbackUrl,
    status: live.status,
    viewerCount: live.viewerCount
  };
}

export async function getMobileChatPayload(roomSlug?: string, currentUserId?: string | null) {
  const [data, sheepSettings] = await Promise.all([
    getPublicChatData(roomSlug, currentUserId),
    getSheepThrowSettings()
  ]);
  const sheepReadiness = await getChatSheepThrowReadiness(currentUserId, sheepSettings);

  return {
    rooms: data.rooms.map(publicRoom),
    selectedRoom: data.selectedRoom ? publicRoom(data.selectedRoom) : null,
    messages: data.messages.map(publicMessage),
    presenceUsers: data.presenceUsers.map(publicPresenceUser),
    sheepThrow: publicSheepThrow(sheepSettings, sheepReadiness),
    assets: data.assets.map((asset) => ({
      id: asset.id,
      packId: asset.packId,
      packName: asset.packName,
      name: asset.name,
      shortcode: asset.shortcode,
      imageUrl: asset.imageUrl,
      kind: asset.kind,
      isAnimated: asset.isAnimated
    }))
  };
}

export async function getMobileShopPayload() {
  const [products, paypal, square] = await Promise.all([getPublicShopProducts(), getPayPalIntegrationData(), getSquareIntegrationData()]);
  const checkoutReadiness = getPayPalCheckoutReadiness(paypal.settings, paypal.secretConfigured);
  const squareReadiness = getSquareShopReadiness(square.settings, square.accessTokenConfigured);

  return {
    ...buildMobileShopPayload(products),
    checkout: buildMobilePayPalCheckoutStatus({
      mode: paypal.settings.mode,
      ready: checkoutReadiness.ready,
      reason: checkoutReadiness.reason
    }),
    checkoutProviders: [
      {
        mode: paypal.settings.mode,
        provider: "paypal",
        ready: checkoutReadiness.ready,
        reason: checkoutReadiness.reason
      },
      {
        mode: square.settings.mode,
        provider: "square",
        ready: squareReadiness.ready,
        reason: squareReadiness.reason
      }
    ]
  };
}

export async function getMobileMusicPayload() {
  const [tracks, paypal] = await Promise.all([getPublicMusicTracks(), getPayPalIntegrationData()]);
  const checkoutReadiness = getPayPalMusicReadiness(paypal.settings, paypal.secretConfigured);

  return {
    ...buildMobileMusicPayload(tracks),
    checkout: buildMobilePayPalCheckoutStatus({
      mode: paypal.settings.mode,
      ready: checkoutReadiness.ready,
      reason: checkoutReadiness.reason
    })
  };
}

export async function getMobileRewardsPayload() {
  const [data, paypal, square] = await Promise.all([getLiveStarSupportData(), getPayPalIntegrationData(), getSquareIntegrationData()]);
  const checkoutReadiness = getPayPalStarsReadiness(paypal.settings, paypal.secretConfigured);
  const squareReadiness = getSquareStarsReadiness(square.settings, square.accessTokenConfigured);

  return {
    live: {
      leaderboard: data.leaderboard,
      recentSends: data.recentSends,
      sendCount: data.sendCount,
      sessionActive: data.sessionActive,
      totalStarsSent: data.totalStarsSent
    },
    packages: starPackages,
    latestSend: data.latestSend,
    checkout: buildMobilePayPalCheckoutStatus({
      mode: paypal.settings.mode,
      ready: checkoutReadiness.ready,
      reason: checkoutReadiness.reason
    }),
    checkoutProviders: [
      {
        mode: paypal.settings.mode,
        provider: "paypal",
        ready: checkoutReadiness.ready,
        reason: checkoutReadiness.reason
      },
      {
        mode: square.settings.mode,
        provider: "square",
        ready: squareReadiness.ready,
        reason: squareReadiness.reason
      }
    ]
  };
}

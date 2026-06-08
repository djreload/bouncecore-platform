import { getPublicChatData, type ChatMessageSummary, type ChatRoomSummary } from "@/lib/chat/chat-service";
import { getPublicMusicTracks, type PublicMusicTrack } from "@/lib/music/music-service";
import { starPackages } from "@/lib/rewards/stars-service";
import { getPublicShopProducts, type ProductRow } from "@/lib/shop/shop-service";
import { getLiveStarSupportData } from "@/lib/stars/star-send-service";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";

export type MobileEndpoint = {
  href: string;
  key: string;
};

function publicProduct(product: ProductRow) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    minPricePence: product.minPricePence,
    totalStock: product.totalStock,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      pricePence: variant.pricePence,
      stock: variant.stock
    }))
  };
}

function publicTrack(track: PublicMusicTrack) {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    genre: track.genre,
    bpm: track.bpm,
    musicalKey: track.musicalKey,
    artworkUrl: track.artworkUrl,
    previewUrl: track.previewUrl,
    licenseType: track.licenseType,
    licenseSummary: track.licenseSummary,
    pricePence: track.pricePence,
    producer: {
      name: track.producerName,
      slug: track.producerSlug,
      bio: track.producerBio
    }
  };
}

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
  return {
    id: message.id,
    roomId: message.roomId,
    body: message.kind === "gif" ? "" : message.body,
    kind: message.kind,
    mediaUrl: message.mediaUrl,
    mediaPreviewUrl: message.mediaPreviewUrl,
    mediaAlt: message.mediaAlt,
    mediaWidth: message.mediaWidth,
    mediaHeight: message.mediaHeight,
    starAmount: message.starAmount,
    starNote: message.starNote,
    createdAt: message.createdAt,
    author: {
      displayName: message.authorDisplayName,
      roles: message.authorRoles
    }
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
    { key: "account.orders", href: "/api/mobile/v1/account/orders" },
    { key: "account.downloads", href: "/api/mobile/v1/account/downloads" },
    { key: "account.rewards", href: "/api/mobile/v1/account/rewards" },
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
    channel: live.channel,
    health: live.health,
    playbackUrl: live.playbackUrl,
    status: live.status,
    viewerCount: live.viewerCount
  };
}

export async function getMobileChatPayload(roomSlug?: string) {
  const data = await getPublicChatData(roomSlug);

  return {
    rooms: data.rooms.map(publicRoom),
    selectedRoom: data.selectedRoom ? publicRoom(data.selectedRoom) : null,
    messages: data.messages.map(publicMessage)
  };
}

export async function getMobileShopPayload() {
  const products = await getPublicShopProducts();

  return {
    products: products.map(publicProduct),
    stats: {
      products: products.length,
      variants: products.reduce((total, product) => total + product.variantCount, 0),
      totalStock: products.reduce((total, product) => total + product.totalStock, 0)
    }
  };
}

export async function getMobileMusicPayload() {
  const tracks = await getPublicMusicTracks();
  const genres = new Set(tracks.flatMap((track) => (track.genre ? [track.genre] : [])));

  return {
    tracks: tracks.map(publicTrack),
    stats: {
      tracks: tracks.length,
      genres: genres.size,
      averagePricePence: tracks.length
        ? Math.round(tracks.reduce((total, track) => total + track.pricePence, 0) / tracks.length)
        : 0
    }
  };
}

export async function getMobileRewardsPayload() {
  const data = await getLiveStarSupportData();

  return {
    live: {
      leaderboard: data.leaderboard,
      recentSends: data.recentSends,
      sendCount: data.sendCount,
      sessionActive: data.sessionActive,
      totalStarsSent: data.totalStarsSent
    },
    packages: starPackages,
    latestSend: data.latestSend
  };
}

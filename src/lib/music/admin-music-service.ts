import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { normalizeDownloadUrl, normalizeOptionalImageUrl, normalizeOptionalPreviewUrl } from "@/lib/media/media-service";
import { cleanupReplacedManagedUploads } from "@/lib/media/upload-cleanup-service";
import { digitalTrackStatusOptions, type DigitalTrackStatus } from "@/lib/music/music-service";

export type AdminTrackInput = {
  trackId: string;
  title: string;
  slug: string;
  genre?: string;
  bpm?: string;
  musicalKey?: string;
  artworkUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  licenseType?: string;
  licenseSummary?: string;
  pricePounds: string;
  status: DigitalTrackStatus;
};

export type AdminMusicTrackRow = {
  id: string;
  title: string;
  slug: string;
  genre: string | null;
  bpm: number | null;
  musicalKey: string | null;
  artworkUrl: string | null;
  pricePence: number;
  previewUrl: string | null;
  downloadUrl: string | null;
  licenseType: string;
  licenseSummary: string | null;
  status: string;
  producerId: string;
  producerName: string;
  producerSlug: string;
  producerBio: string | null;
  producerUserId: string;
  producerEmail: string;
  producerDisplayName: string;
};

export type AdminMusicStats = {
  totalTracks: number;
  draftTracks: number;
  pendingTracks: number;
  approvedTracks: number;
  archivedTracks: number;
  catalogueValuePence: number;
  approvedValuePence: number;
};

export type AdminMusicData = {
  stats: AdminMusicStats;
  tracks: AdminMusicTrackRow[];
};

function normalizeSlug(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);

  if (normalized) {
    return normalized;
  }

  return (
    fallback
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 58) || "track"
  );
}

function normalizedText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedLicenseType(value: string | undefined) {
  const text = value?.trim().toLowerCase() ?? "";

  if (!text) {
    return "personal";
  }

  if (!/^[a-z0-9 -]{2,40}$/.test(text)) {
    throw new Error("License type must use letters, numbers, spaces, or hyphens.");
  }

  return text;
}

function assertTrackStatus(status: string): asserts status is DigitalTrackStatus {
  if (!digitalTrackStatusOptions.includes(status as DigitalTrackStatus)) {
    throw new Error("Invalid track status.");
  }
}

function parsePricePence(value: string) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0 || price > 9999) {
    throw new Error("Track price must be between 0 and 9999.");
  }

  return Math.round(price * 100);
}

function parseBpm(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const bpm = Number(trimmed);

  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 260) {
    throw new Error("BPM must be a whole number between 40 and 260.");
  }

  return bpm;
}

function assertApprovedTrackHasDelivery(status: DigitalTrackStatus, downloadUrl: string | null) {
  if (status === "approved" && !downloadUrl) {
    throw new Error("Approved tracks need a download MP3 or Google Drive delivery link before they can go live.");
  }
}

async function normalizeTrackInput(input: AdminTrackInput) {
  assertTrackStatus(input.status);

  const title = normalizedText(input.title, 120);

  if (!title || title.length < 2) {
    throw new Error("Track title must be at least 2 characters.");
  }

  const downloadUrl = await normalizeDownloadUrl(input.downloadUrl);

  assertApprovedTrackHasDelivery(input.status, downloadUrl);

  return {
    artworkUrl: normalizeOptionalImageUrl(input.artworkUrl, "Track artwork URL"),
    bpm: parseBpm(input.bpm),
    downloadUrl,
    genre: normalizedText(input.genre, 60),
    licenseSummary: normalizedText(input.licenseSummary, 1200),
    licenseType: normalizedLicenseType(input.licenseType),
    musicalKey: normalizedText(input.musicalKey, 20),
    previewUrl: normalizeOptionalPreviewUrl(input.previewUrl),
    pricePence: parsePricePence(input.pricePounds),
    slug: normalizeSlug(input.slug, title),
    status: input.status,
    title
  };
}

function toAdminTrackRow(track: {
  id: string;
  title: string;
  slug: string;
  genre: string | null;
  bpm: number | null;
  musicalKey: string | null;
  artworkUrl: string | null;
  pricePence: number;
  previewUrl: string | null;
  downloadUrl: string | null;
  licenseType: string;
  licenseSummary: string | null;
  status: string;
  producerId: string;
  producer: {
    name: string;
    slug: string;
    bio: string | null;
    userId: string;
    user: {
      email: string;
      displayName: string;
    };
  };
}): AdminMusicTrackRow {
  return {
    id: track.id,
    title: track.title,
    slug: track.slug,
    genre: track.genre,
    bpm: track.bpm,
    musicalKey: track.musicalKey,
    artworkUrl: track.artworkUrl,
    pricePence: track.pricePence,
    previewUrl: track.previewUrl,
    downloadUrl: track.downloadUrl,
    licenseType: track.licenseType,
    licenseSummary: track.licenseSummary,
    status: track.status,
    producerId: track.producerId,
    producerName: track.producer.name,
    producerSlug: track.producer.slug,
    producerBio: track.producer.bio,
    producerUserId: track.producer.userId,
    producerEmail: track.producer.user.email,
    producerDisplayName: track.producer.user.displayName
  };
}

function statsForTracks(tracks: AdminMusicTrackRow[]): AdminMusicStats {
  return {
    approvedTracks: tracks.filter((track) => track.status === "approved").length,
    approvedValuePence: tracks
      .filter((track) => track.status === "approved")
      .reduce((total, track) => total + track.pricePence, 0),
    archivedTracks: tracks.filter((track) => track.status === "archived").length,
    catalogueValuePence: tracks.reduce((total, track) => total + track.pricePence, 0),
    draftTracks: tracks.filter((track) => track.status === "draft").length,
    pendingTracks: tracks.filter((track) => track.status === "pending").length,
    totalTracks: tracks.length
  };
}

async function uniqueTrackSlug(slug: string, trackId: string) {
  const existing = await prisma.digitalTrack.findUnique({
    where: {
      slug
    },
    select: {
      id: true
    }
  });

  if (existing && existing.id !== trackId) {
    throw new Error("That track slug is already in use.");
  }
}

export async function getAdminMusicTracksData(): Promise<AdminMusicData> {
  const tracks = await prisma.digitalTrack.findMany({
    include: {
      producer: {
        include: {
          user: {
            select: {
              displayName: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    take: 200
  });
  const rows = tracks.map(toAdminTrackRow);

  return {
    stats: statsForTracks(rows),
    tracks: rows
  };
}

export async function getAdminProducerApprovalsData(): Promise<AdminMusicData> {
  const tracks = await prisma.digitalTrack.findMany({
    where: {
      status: "pending"
    },
    include: {
      producer: {
        include: {
          user: {
            select: {
              displayName: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: [{ title: "asc" }],
    take: 200
  });
  const rows = tracks.map(toAdminTrackRow);

  return {
    stats: statsForTracks(rows),
    tracks: rows
  };
}

export async function updateAdminTrack(actorId: string, input: AdminTrackInput) {
  if (!input.trackId) {
    throw new Error("Missing track.");
  }

  const existing = await prisma.digitalTrack.findUniqueOrThrow({
    where: {
      id: input.trackId
    }
  });
  const trackInput = await normalizeTrackInput(input);

  await uniqueTrackSlug(trackInput.slug, input.trackId);

  const track = await prisma.digitalTrack.update({
    where: {
      id: input.trackId
    },
    data: trackInput
  });

  await cleanupReplacedManagedUploads([
    {
      previous: existing.artworkUrl,
      next: track.artworkUrl
    },
    {
      previous: existing.previewUrl,
      next: track.previewUrl
    },
    {
      previous: existing.downloadUrl,
      next: track.downloadUrl
    }
  ]);

  await writeAuditLog({
    actorId,
    action: "music.track.admin_update",
    target: `digital-track:${track.id}`,
    severity: existing.status !== track.status ? "warning" : "info",
    metadata: {
      previousStatus: existing.status,
      slug: track.slug,
      status: track.status
    }
  });

  return track;
}

export async function setAdminTrackStatus(actorId: string, trackId: string, status: DigitalTrackStatus) {
  if (!trackId) {
    throw new Error("Missing track.");
  }

  assertTrackStatus(status);

  const existing = await prisma.digitalTrack.findUniqueOrThrow({
    where: {
      id: trackId
    }
  });

  assertApprovedTrackHasDelivery(status, existing.downloadUrl);

  const track = await prisma.digitalTrack.update({
    where: {
      id: trackId
    },
    data: {
      status
    }
  });

  await writeAuditLog({
    actorId,
    action: "music.track.status_update",
    target: `digital-track:${track.id}`,
    severity: "warning",
    metadata: {
      previousStatus: existing.status,
      slug: track.slug,
      status: track.status
    }
  });

  return track;
}

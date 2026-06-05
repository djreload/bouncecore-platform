import { writeAuditLog } from "@/lib/auth/audit";
import { makeProfileSlug } from "@/lib/auth/slugs";
import { prisma } from "@/lib/db/prisma";
import { normalizeDownloadUrl, normalizeOptionalImageUrl, normalizeOptionalPreviewUrl } from "@/lib/media/media-service";

export const digitalTrackStatusOptions = ["draft", "pending", "approved", "archived"] as const;

export type DigitalTrackStatus = (typeof digitalTrackStatusOptions)[number];

export type ProducerProfileInput = {
  name: string;
  slug: string;
  bio?: string;
  paypalPayoutEmail?: string;
};

export type DigitalTrackInput = {
  trackId?: string;
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

export type ProducerTrackRow = {
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
};

export type ProducerWorkspaceData = {
  profile: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    paypalPayoutEmail: string | null;
  } | null;
  stats: {
    totalTracks: number;
    draftTracks: number;
    pendingTracks: number;
    approvedTracks: number;
    archivedTracks: number;
    catalogueValuePence: number;
  };
  tracks: ProducerTrackRow[];
};

export type ProducerSaleRow = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  status: string;
  trackTitle: string;
  pricePence: number;
  downloadUrl: string | null;
  licenseType: string;
  licenseSummary: string | null;
  platformFeePence: number;
  producerEarningsPence: number;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
  payoutBatchId: string | null;
  payoutRecipientEmail: string | null;
  payoutSenderBatchId: string | null;
  payoutStatus: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type ProducerSalesData = {
  stats: {
    paidSales: number;
    pendingSales: number;
    grossPence: number;
    platformFeePence: number;
    producerEarningsPence: number;
    payoutPaidPence: number;
    payoutPendingPence: number;
    payablePence: number;
  };
  sales: ProducerSaleRow[];
};

export type PublicMusicTrack = ProducerTrackRow & {
  producerName: string;
  producerSlug: string;
  producerBio: string | null;
};

export type PublicProducerProfile = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  approvedTracks: number;
  tracks: PublicMusicTrack[];
};

export type AccountDownloadRow = {
  id: string;
  trackId: string;
  trackTitle: string;
  producerName: string;
  genre: string | null;
  bpm: number | null;
  musicalKey: string | null;
  pricePence: number;
  downloadUrl: string | null;
  licenseType: string;
  licenseSummary: string | null;
  downloadCount: number;
  lastDownloadedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type AccountDownloadsData = {
  downloads: AccountDownloadRow[];
  stats: {
    ownedTracks: number;
    downloadableTracks: number;
    totalSpendPence: number;
    totalDownloads: number;
  };
};

export type ProducerLicenseRow = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  trackTitle: string;
  licenseType: string;
  licenseSummary: string | null;
  downloadCount: number;
  completedAt: string | null;
};

export type ProducerLicensesData = {
  licenses: ProducerLicenseRow[];
  stats: {
    issuedLicenses: number;
    downloadedLicenses: number;
    grossPence: number;
  };
};

export type ProducerDownloadAssetRow = ProducerTrackRow & {
  paidSales: number;
  downloadCount: number;
};

export type ProducerDownloadsData = {
  tracks: ProducerDownloadAssetRow[];
  stats: {
    configuredDownloads: number;
    totalTracks: number;
    totalDownloadCount: number;
    missingDownloads: number;
  };
};

function normalizeSlug(value: string, fallback: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);

  if (normalizedValue) {
    return normalizedValue;
  }

  return (
    fallback
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 58) || "producer"
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

function normalizedEmail(value: string | undefined, maxLength: number) {
  const text = value?.trim().toLowerCase() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Email must be ${maxLength} characters or fewer.`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error("Enter a valid PayPal payout email address.");
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

function toTrackRow(track: {
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
}): ProducerTrackRow {
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
    status: track.status
  };
}

function toPublicTrack(track: {
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
  producer: {
    name: string;
    slug: string;
    bio: string | null;
  };
}): PublicMusicTrack {
  return {
    ...toTrackRow(track),
    producerName: track.producer.name,
    producerSlug: track.producer.slug,
    producerBio: track.producer.bio
  };
}

function toProducerSaleRow(sale: {
  id: string;
  status: string;
  trackTitle: string;
  pricePence: number;
  downloadUrl: string | null;
  licenseType: string;
  licenseSummary: string | null;
  platformFeePence: number;
  producerEarningsPence: number;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  track: {
    downloadUrl: string | null;
    licenseType: string;
    licenseSummary: string | null;
  };
  buyer: {
    displayName: string;
    email: string;
  };
  payoutItems: {
    recipientEmail: string;
    status: string;
    batch: {
      id: string;
      senderBatchId: string;
    };
  }[];
}): ProducerSaleRow {
  const payoutItem = sale.payoutItems[0];

  return {
    buyerEmail: sale.buyer.email,
    buyerName: sale.buyer.displayName,
    cancelledAt: sale.cancelledAt?.toISOString() ?? null,
    completedAt: sale.completedAt?.toISOString() ?? null,
    createdAt: sale.createdAt.toISOString(),
    id: sale.id,
    paypalCaptureId: sale.paypalCaptureId,
    paypalOrderId: sale.paypalOrderId,
    paypalPayerEmail: sale.paypalPayerEmail,
    payoutBatchId: payoutItem?.batch.id ?? null,
    payoutRecipientEmail: payoutItem?.recipientEmail ?? null,
    payoutSenderBatchId: payoutItem?.batch.senderBatchId ?? null,
    payoutStatus: payoutItem?.status ?? null,
    downloadUrl: sale.downloadUrl ?? sale.track.downloadUrl,
    licenseType: sale.licenseType || sale.track.licenseType,
    licenseSummary: sale.licenseSummary ?? sale.track.licenseSummary,
    platformFeePence: sale.platformFeePence,
    pricePence: sale.pricePence,
    producerEarningsPence: sale.producerEarningsPence,
    status: sale.status,
    trackTitle: sale.trackTitle
  };
}

async function uniqueProducerSlug(slug: string, userId: string) {
  const existing = await prisma.producerProfile.findUnique({
    where: {
      slug
    },
    select: {
      userId: true
    }
  });

  if (existing && existing.userId !== userId) {
    throw new Error("That producer slug is already in use.");
  }
}

async function uniqueTrackSlug(slug: string, trackId?: string) {
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

export async function getProducerWorkspaceData(userId: string): Promise<ProducerWorkspaceData> {
  const profile = await prisma.producerProfile.findUnique({
    where: {
      userId
    },
    include: {
      tracks: {
        orderBy: {
          title: "asc"
        }
      }
    }
  });
  const tracks = profile?.tracks ?? [];

  return {
    profile: profile
        ? {
            id: profile.id,
            name: profile.name,
            slug: profile.slug,
            bio: profile.bio,
            paypalPayoutEmail: profile.paypalPayoutEmail
          }
        : null,
    stats: {
      totalTracks: tracks.length,
      draftTracks: tracks.filter((track) => track.status === "draft").length,
      pendingTracks: tracks.filter((track) => track.status === "pending").length,
      approvedTracks: tracks.filter((track) => track.status === "approved").length,
      archivedTracks: tracks.filter((track) => track.status === "archived").length,
      catalogueValuePence: tracks.reduce((total, track) => total + track.pricePence, 0)
    },
    tracks: tracks.map(toTrackRow)
  };
}

export async function getProducerSalesData(userId: string): Promise<ProducerSalesData> {
  const profile = await prisma.producerProfile.findUnique({
    where: {
      userId
    },
    select: {
      id: true
    }
  });

  if (!profile) {
    return {
      sales: [],
      stats: {
        grossPence: 0,
        paidSales: 0,
        pendingSales: 0,
        payablePence: 0,
        platformFeePence: 0,
        producerEarningsPence: 0,
        payoutPaidPence: 0,
        payoutPendingPence: 0
      }
    };
  }

  const sales = await prisma.digitalTrackPurchase.findMany({
    where: {
      producerId: profile.id
    },
    include: {
      buyer: {
        select: {
          displayName: true,
          email: true
        }
      },
      payoutItems: {
        include: {
          batch: {
            select: {
              id: true,
              senderBatchId: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      },
      track: {
        select: {
          downloadUrl: true,
          licenseSummary: true,
          licenseType: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });
  const rows = sales.map(toProducerSaleRow);
  const paidSales = rows.filter((sale) => sale.status === "paid");
  const payoutPendingSales = paidSales.filter((sale) =>
    ["pending", "processing", "unclaimed", "onhold"].includes(sale.payoutStatus ?? "")
  );
  const payoutPaidSales = paidSales.filter((sale) => sale.payoutStatus === "success");
  const payableSales = paidSales.filter(
    (sale) => !sale.payoutStatus || ["failed", "returned", "blocked", "denied", "canceled", "refunded", "reversed"].includes(sale.payoutStatus)
  );

  return {
    sales: rows,
    stats: {
      grossPence: paidSales.reduce((total, sale) => total + sale.pricePence, 0),
      paidSales: paidSales.length,
      payablePence: payableSales.reduce((total, sale) => total + sale.producerEarningsPence, 0),
      pendingSales: rows.filter((sale) => sale.status === "pending").length,
      platformFeePence: paidSales.reduce((total, sale) => total + sale.platformFeePence, 0),
      producerEarningsPence: paidSales.reduce((total, sale) => total + sale.producerEarningsPence, 0),
      payoutPaidPence: payoutPaidSales.reduce((total, sale) => total + sale.producerEarningsPence, 0),
      payoutPendingPence: payoutPendingSales.reduce((total, sale) => total + sale.producerEarningsPence, 0)
    }
  };
}

export async function updateProducerProfile(userId: string, input: ProducerProfileInput) {
  const name = normalizedText(input.name, 100);

  if (!name || name.length < 2) {
    throw new Error("Producer name must be at least 2 characters.");
  }

  const slug = normalizeSlug(input.slug, name);
  const bio = normalizedText(input.bio, 600);
  const paypalPayoutEmail = normalizedEmail(input.paypalPayoutEmail, 180);

  await uniqueProducerSlug(slug, userId);

  const profile = await prisma.producerProfile.upsert({
    where: {
      userId
    },
    update: {
      bio,
      name,
      paypalPayoutEmail,
      slug
    },
    create: {
      bio,
      name,
      paypalPayoutEmail,
      slug,
      userId
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "producer.profile.update",
    target: `producer-profile:${profile.id}`,
    severity: "info",
    metadata: {
      slug: profile.slug
    }
  });

  return profile;
}

export async function ensureProducerProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    select: {
      displayName: true
    }
  });
  const existing = await prisma.producerProfile.findUnique({
    where: {
      userId
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.producerProfile.create({
    data: {
      name: user.displayName,
      slug: makeProfileSlug(user.displayName),
      userId
    }
  });
}

async function normalizeTrackInput(input: DigitalTrackInput) {
  assertTrackStatus(input.status);

  const title = normalizedText(input.title, 120);

  if (!title || title.length < 2) {
    throw new Error("Track title must be at least 2 characters.");
  }

  return {
    artworkUrl: normalizeOptionalImageUrl(input.artworkUrl, "Track artwork URL"),
    bpm: parseBpm(input.bpm),
    downloadUrl: await normalizeDownloadUrl(input.downloadUrl),
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

export async function createProducerTrack(userId: string, input: DigitalTrackInput) {
  const profile = await ensureProducerProfile(userId);
  const trackInput = await normalizeTrackInput(input);

  await uniqueTrackSlug(trackInput.slug);

  const track = await prisma.digitalTrack.create({
    data: {
      ...trackInput,
      producerId: profile.id
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "producer.track.create",
    target: `digital-track:${track.id}`,
    severity: track.status === "approved" ? "warning" : "info",
    metadata: {
      slug: track.slug,
      status: track.status
    }
  });

  return track;
}

export async function updateProducerTrack(userId: string, input: DigitalTrackInput) {
  if (!input.trackId) {
    throw new Error("Missing track.");
  }

  const profile = await ensureProducerProfile(userId);
  const existing = await prisma.digitalTrack.findUniqueOrThrow({
    where: {
      id: input.trackId
    }
  });

  if (existing.producerId !== profile.id) {
    throw new Error("You can only update your own tracks.");
  }

  const trackInput = await normalizeTrackInput(input);

  await uniqueTrackSlug(trackInput.slug, input.trackId);

  const track = await prisma.digitalTrack.update({
    where: {
      id: input.trackId
    },
    data: trackInput
  });

  await writeAuditLog({
    actorId: userId,
    action: "producer.track.update",
    target: `digital-track:${track.id}`,
    severity: existing.status !== track.status ? "warning" : "info",
    metadata: {
      slug: track.slug,
      status: track.status,
      previousStatus: existing.status
    }
  });

  return track;
}

export async function archiveProducerTrack(userId: string, trackId: string) {
  if (!trackId) {
    throw new Error("Missing track.");
  }

  const profile = await ensureProducerProfile(userId);
  const existing = await prisma.digitalTrack.findUniqueOrThrow({
    where: {
      id: trackId
    }
  });

  if (existing.producerId !== profile.id) {
    throw new Error("You can only archive your own tracks.");
  }

  const track = await prisma.digitalTrack.update({
    where: {
      id: trackId
    },
    data: {
      status: "archived"
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "producer.track.archive",
    target: `digital-track:${track.id}`,
    severity: "warning",
    metadata: {
      slug: track.slug
    }
  });

  return track;
}

export async function getPublicMusicTracks(): Promise<PublicMusicTrack[]> {
  const tracks = await prisma.digitalTrack.findMany({
    where: {
      status: "approved"
    },
    orderBy: {
      title: "asc"
    },
    include: {
      producer: {
        select: {
          bio: true,
          name: true,
          slug: true
        }
      }
    },
    take: 100
  });

  return tracks.map(toPublicTrack);
}

export async function getPurchasedMusicTrackIds(userId: string) {
  const purchases = await prisma.digitalTrackPurchase.findMany({
    where: {
      buyerId: userId,
      status: "paid"
    },
    select: {
      trackId: true
    }
  });

  return new Set(purchases.map((purchase) => purchase.trackId));
}

function toAccountDownloadRow(purchase: {
  id: string;
  trackId: string;
  trackTitle: string;
  producerName: string;
  pricePence: number;
  downloadUrl: string | null;
  licenseType: string;
  licenseSummary: string | null;
  downloadCount: number;
  lastDownloadedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  track: {
    genre: string | null;
    bpm: number | null;
    musicalKey: string | null;
    downloadUrl: string | null;
    licenseType: string;
    licenseSummary: string | null;
  };
}): AccountDownloadRow {
  return {
    bpm: purchase.track.bpm,
    completedAt: purchase.completedAt?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    downloadCount: purchase.downloadCount,
    downloadUrl: purchase.downloadUrl ?? purchase.track.downloadUrl,
    genre: purchase.track.genre,
    id: purchase.id,
    lastDownloadedAt: purchase.lastDownloadedAt?.toISOString() ?? null,
    licenseSummary: purchase.licenseSummary ?? purchase.track.licenseSummary,
    licenseType: purchase.licenseType || purchase.track.licenseType,
    musicalKey: purchase.track.musicalKey,
    pricePence: purchase.pricePence,
    producerName: purchase.producerName,
    trackId: purchase.trackId,
    trackTitle: purchase.trackTitle
  };
}

export async function getAccountDownloadsData(userId: string): Promise<AccountDownloadsData> {
  const purchases = await prisma.digitalTrackPurchase.findMany({
    where: {
      buyerId: userId,
      status: "paid"
    },
    include: {
      track: {
        select: {
          bpm: true,
          downloadUrl: true,
          genre: true,
          licenseSummary: true,
          licenseType: true,
          musicalKey: true
        }
      }
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    take: 100
  });
  const rows = purchases.map(toAccountDownloadRow);

  return {
    downloads: rows,
    stats: {
      downloadableTracks: rows.filter((download) => Boolean(download.downloadUrl)).length,
      ownedTracks: rows.length,
      totalDownloads: rows.reduce((total, download) => total + download.downloadCount, 0),
      totalSpendPence: rows.reduce((total, download) => total + download.pricePence, 0)
    }
  };
}

export async function getOwnedTrackDownload(userId: string, purchaseId: string) {
  const purchase = await prisma.digitalTrackPurchase.findFirst({
    where: {
      buyerId: userId,
      id: purchaseId,
      status: "paid"
    },
    include: {
      track: {
        select: {
          downloadUrl: true
        }
      }
    }
  });

  if (!purchase) {
    return null;
  }

  const downloadUrl = purchase.downloadUrl ?? purchase.track.downloadUrl;

  if (!downloadUrl) {
    return {
      downloadUrl: null,
      purchase
    };
  }

  const updated = await prisma.digitalTrackPurchase.update({
    where: {
      id: purchase.id
    },
    data: {
      downloadCount: {
        increment: 1
      },
      lastDownloadedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "music.download",
    target: `track-purchase:${purchase.id}`,
    severity: "info",
    metadata: {
      downloadCount: updated.downloadCount,
      trackId: purchase.trackId
    }
  });

  return {
    downloadUrl,
    purchase: updated
  };
}

export async function getProducerLicensesData(userId: string): Promise<ProducerLicensesData> {
  const profile = await prisma.producerProfile.findUnique({
    where: {
      userId
    },
    select: {
      id: true
    }
  });

  if (!profile) {
    return {
      licenses: [],
      stats: {
        downloadedLicenses: 0,
        grossPence: 0,
        issuedLicenses: 0
      }
    };
  }

  const purchases = await prisma.digitalTrackPurchase.findMany({
    where: {
      producerId: profile.id,
      status: "paid"
    },
    include: {
      buyer: {
        select: {
          displayName: true,
          email: true
        }
      },
      track: {
        select: {
          licenseSummary: true,
          licenseType: true
        }
      }
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    take: 100
  });
  const licenses = purchases.map((purchase) => ({
    buyerEmail: purchase.buyer.email,
    buyerName: purchase.buyer.displayName,
    completedAt: purchase.completedAt?.toISOString() ?? null,
    downloadCount: purchase.downloadCount,
    id: purchase.id,
    licenseSummary: purchase.licenseSummary ?? purchase.track.licenseSummary,
    licenseType: purchase.licenseType || purchase.track.licenseType,
    trackTitle: purchase.trackTitle
  }));

  return {
    licenses,
    stats: {
      downloadedLicenses: licenses.filter((license) => license.downloadCount > 0).length,
      grossPence: purchases.reduce((total, purchase) => total + purchase.pricePence, 0),
      issuedLicenses: licenses.length
    }
  };
}

export async function getProducerDownloadsData(userId: string): Promise<ProducerDownloadsData> {
  const profile = await prisma.producerProfile.findUnique({
    where: {
      userId
    },
    include: {
      tracks: {
        include: {
          purchases: {
            where: {
              status: "paid"
            },
            select: {
              downloadCount: true
            }
          }
        },
        orderBy: {
          title: "asc"
        }
      }
    }
  });

  if (!profile) {
    return {
      stats: {
        configuredDownloads: 0,
        missingDownloads: 0,
        totalDownloadCount: 0,
        totalTracks: 0
      },
      tracks: []
    };
  }

  const tracks = profile.tracks.map((track) => ({
    ...toTrackRow(track),
    downloadCount: track.purchases.reduce((total, purchase) => total + purchase.downloadCount, 0),
    paidSales: track.purchases.length
  }));

  return {
    stats: {
      configuredDownloads: tracks.filter((track) => Boolean(track.downloadUrl)).length,
      missingDownloads: tracks.filter((track) => !track.downloadUrl).length,
      totalDownloadCount: tracks.reduce((total, track) => total + track.downloadCount, 0),
      totalTracks: tracks.length
    },
    tracks
  };
}

export async function getPublicProducerProfiles(): Promise<PublicProducerProfile[]> {
  const profiles = await prisma.producerProfile.findMany({
    orderBy: {
      name: "asc"
    },
    include: {
      tracks: {
        where: {
          status: "approved"
        },
        orderBy: {
          title: "asc"
        },
        take: 6
      }
    },
    take: 100
  });

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    bio: profile.bio,
    approvedTracks: profile.tracks.length,
    tracks: profile.tracks.map((track) =>
      toPublicTrack({
        ...track,
        producer: {
          bio: profile.bio,
          name: profile.name,
          slug: profile.slug
        }
      })
    )
  }));
}

export async function getPublicProducerProfileBySlug(slug: string): Promise<PublicProducerProfile | null> {
  const profile = await prisma.producerProfile.findUnique({
    where: {
      slug
    },
    include: {
      tracks: {
        where: {
          status: "approved"
        },
        orderBy: {
          title: "asc"
        }
      }
    }
  });

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    bio: profile.bio,
    approvedTracks: profile.tracks.length,
    tracks: profile.tracks.map((track) =>
      toPublicTrack({
        ...track,
        producer: {
          bio: profile.bio,
          name: profile.name,
          slug: profile.slug
        }
      })
    )
  };
}

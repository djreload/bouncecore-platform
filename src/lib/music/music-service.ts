import { writeAuditLog } from "@/lib/auth/audit";
import { makeProfileSlug } from "@/lib/auth/slugs";
import { prisma } from "@/lib/db/prisma";

export const digitalTrackStatusOptions = ["draft", "pending", "approved", "archived"] as const;

export type DigitalTrackStatus = (typeof digitalTrackStatusOptions)[number];

export type ProducerProfileInput = {
  name: string;
  slug: string;
  bio?: string;
};

export type DigitalTrackInput = {
  trackId?: string;
  title: string;
  slug: string;
  genre?: string;
  bpm?: string;
  musicalKey?: string;
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
  pricePence: number;
  status: string;
};

export type ProducerWorkspaceData = {
  profile: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
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
  platformFeePence: number;
  producerEarningsPence: number;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
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
  pricePence: number;
  status: string;
}): ProducerTrackRow {
  return {
    id: track.id,
    title: track.title,
    slug: track.slug,
    genre: track.genre,
    bpm: track.bpm,
    musicalKey: track.musicalKey,
    pricePence: track.pricePence,
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
  pricePence: number;
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
  platformFeePence: number;
  producerEarningsPence: number;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  buyer: {
    displayName: string;
    email: string;
  };
}): ProducerSaleRow {
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
          bio: profile.bio
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
        platformFeePence: 0,
        producerEarningsPence: 0
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
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });
  const rows = sales.map(toProducerSaleRow);
  const paidSales = rows.filter((sale) => sale.status === "paid");

  return {
    sales: rows,
    stats: {
      grossPence: paidSales.reduce((total, sale) => total + sale.pricePence, 0),
      paidSales: paidSales.length,
      pendingSales: rows.filter((sale) => sale.status === "pending").length,
      platformFeePence: paidSales.reduce((total, sale) => total + sale.platformFeePence, 0),
      producerEarningsPence: paidSales.reduce((total, sale) => total + sale.producerEarningsPence, 0)
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

  await uniqueProducerSlug(slug, userId);

  const profile = await prisma.producerProfile.upsert({
    where: {
      userId
    },
    update: {
      bio,
      name,
      slug
    },
    create: {
      bio,
      name,
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

function normalizeTrackInput(input: DigitalTrackInput) {
  assertTrackStatus(input.status);

  const title = normalizedText(input.title, 120);

  if (!title || title.length < 2) {
    throw new Error("Track title must be at least 2 characters.");
  }

  return {
    bpm: parseBpm(input.bpm),
    genre: normalizedText(input.genre, 60),
    musicalKey: normalizedText(input.musicalKey, 20),
    pricePence: parsePricePence(input.pricePounds),
    slug: normalizeSlug(input.slug, title),
    status: input.status,
    title
  };
}

export async function createProducerTrack(userId: string, input: DigitalTrackInput) {
  const profile = await ensureProducerProfile(userId);
  const trackInput = normalizeTrackInput(input);

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

  const trackInput = normalizeTrackInput(input);

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

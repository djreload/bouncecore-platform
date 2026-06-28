import { createHash } from "node:crypto";
import type { StreamStatus } from "./stream-provider";

export type ActiveIngestStreamProfile = {
  audioBitrateKbps: number;
  fps: number;
  key: string;
  keyframeSeconds: number;
  label: string;
  videoBitrateKbps: number;
  videoHeight: number;
  videoWidth: number;
};

export type ActiveIngestState = {
  bitrateKbps: number | null;
  channelId: string | null;
  channelSlug: string | null;
  channelTitle: string | null;
  directPlaybackUrl: string | null;
  droppedFrames: number | null;
  id: string;
  ingestPath: string;
  lastIngestAt: string;
  playbackUrl: string | null;
  presenterName: string | null;
  startedAt: string;
  status: StreamStatus;
  streamKeyFingerprint: string | null;
  streamProfile: ActiveIngestStreamProfile | null;
  viewerCount: number;
};

export type PublicActiveIngest = {
  id: string;
  lastIngestAt: string;
  playbackUrl: string | null;
  presenterName: string | null;
  profile: ActiveIngestStreamProfile | null;
  role: "primary" | "secondary";
  startedAt: string;
  status: StreamStatus;
  streamKeyFingerprint: string | null;
  title: string | null;
};

type ActiveIngestSortOptions = {
  maxActiveIngests: number;
  now: Date;
  offlineAfterSeconds: number;
};

export function createActiveIngestId(path: string, fingerprint: string | null) {
  return createHash("sha256")
    .update(`${fingerprint ?? "unknown"}:${path}`)
    .digest("hex")
    .slice(0, 16);
}

export function activeIngestIsFresh(ingest: ActiveIngestState, options: Pick<ActiveIngestSortOptions, "now" | "offlineAfterSeconds">) {
  const lastIngestAt = new Date(ingest.lastIngestAt);

  if (!Number.isFinite(lastIngestAt.getTime())) {
    return false;
  }

  return options.now.getTime() - lastIngestAt.getTime() <= options.offlineAfterSeconds * 1000;
}

export function sortActiveIngests(ingests: ActiveIngestState[], options: ActiveIngestSortOptions) {
  return ingests
    .filter((ingest) => ingest.status !== "offline" && activeIngestIsFresh(ingest, options))
    .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())
    .slice(0, options.maxActiveIngests);
}

export function upsertActiveIngestState(ingests: ActiveIngestState[], ingest: ActiveIngestState, options: ActiveIngestSortOptions) {
  const existing = ingests.find((activeIngest) => activeIngest.id === ingest.id);
  const freshIngests = sortActiveIngests(ingests, options);

  if (!existing && freshIngests.length >= options.maxActiveIngests) {
    return {
      activeIngests: freshIngests,
      accepted: false
    };
  }

  return {
    activeIngests: sortActiveIngests(
      [
        ...ingests.filter(
          (activeIngest) => activeIngest.id !== ingest.id && activeIngestIsFresh(activeIngest, options)
        ),
        ingest
      ],
      options
    ),
    accepted: true
  };
}

export function removeActiveIngestState(
  ingests: ActiveIngestState[],
  criteria: {
    fingerprint?: string | null;
    path: string | null;
  },
  options: ActiveIngestSortOptions
) {
  const nextIngests = ingests.filter((ingest) => {
    if (criteria.path && ingest.ingestPath === criteria.path) {
      return false;
    }

    if (criteria.fingerprint && ingest.streamKeyFingerprint === criteria.fingerprint) {
      return false;
    }

    return true;
  });

  return {
    activeIngests: sortActiveIngests(nextIngests, options),
    removed: nextIngests.length !== ingests.length
  };
}

export function toPublicActiveIngests(
  ingests: ActiveIngestState[],
  getPlaybackUrl: (ingest: ActiveIngestState, index: number) => string | null
) {
  return ingests.map<PublicActiveIngest>((ingest, index) => ({
    id: ingest.id,
    lastIngestAt: ingest.lastIngestAt,
    playbackUrl: getPlaybackUrl(ingest, index),
    presenterName: ingest.presenterName,
    profile: ingest.streamProfile,
    role: index === 0 ? "primary" : "secondary",
    startedAt: ingest.startedAt,
    status: ingest.status,
    streamKeyFingerprint: ingest.streamKeyFingerprint,
    title: ingest.channelTitle
  }));
}

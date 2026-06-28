export type MusicRankingTrack = {
  createdAt: Date | string;
  id: string;
  successfulDownloads: number;
  title: string;
};

function createdAtValue(value: Date | string) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareOldestFirst<T extends MusicRankingTrack>(first: T, second: T) {
  const createdAtDiff = createdAtValue(first.createdAt) - createdAtValue(second.createdAt);

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const titleDiff = first.title.localeCompare(second.title);

  if (titleDiff !== 0) {
    return titleDiff;
  }

  return first.id.localeCompare(second.id);
}

export function orderMusicTracksOldestFirst<T extends MusicRankingTrack>(tracks: T[]) {
  return [...tracks].sort(compareOldestFirst);
}

export function getTopDownloadedMusicTracks<T extends MusicRankingTrack>(tracks: T[], limit = 20) {
  return tracks
    .filter((track) => track.successfulDownloads > 0)
    .sort((first, second) => {
      const downloadDiff = second.successfulDownloads - first.successfulDownloads;

      if (downloadDiff !== 0) {
        return downloadDiff;
      }

      return compareOldestFirst(first, second);
    })
    .slice(0, limit);
}

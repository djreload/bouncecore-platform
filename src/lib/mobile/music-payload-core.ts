import { getTopDownloadedMusicTracks, type MusicRankingTrack } from "../music/music-ranking";

export type MobileMusicTrackSource = MusicRankingTrack & {
  artworkUrl: string | null;
  bpm: number | null;
  genre: string | null;
  licenseSummary: string | null;
  licenseType: string;
  musicalKey: string | null;
  previewUrl: string | null;
  pricePence: number;
  producerBio: string | null;
  producerName: string;
  producerSlug: string;
  slug: string;
};

function publicTrack(track: MobileMusicTrackSource) {
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
    successfulDownloads: track.successfulDownloads,
    producer: {
      name: track.producerName,
      slug: track.producerSlug,
      bio: track.producerBio
    }
  };
}

export function buildMobileMusicPayload(tracks: MobileMusicTrackSource[]) {
  const genres = new Set(tracks.flatMap((track) => (track.genre ? [track.genre] : [])));
  const topTracks = getTopDownloadedMusicTracks(tracks, 20);

  return {
    tracks: tracks.map(publicTrack),
    topTracks: topTracks.map(publicTrack),
    stats: {
      tracks: tracks.length,
      genres: genres.size,
      totalDownloads: tracks.reduce((total, track) => total + track.successfulDownloads, 0),
      averagePricePence: tracks.length
        ? Math.round(tracks.reduce((total, track) => total + track.pricePence, 0) / tracks.length)
        : 0
    }
  };
}

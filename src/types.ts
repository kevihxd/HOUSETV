export interface PlaylistItem {
  id: string;
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: string;
}

export interface PlayerSettings {
  loopPlaylist: boolean;
  loopSong: boolean;
  shuffle: boolean;
  volume: number;
  autoPlay: boolean;
}

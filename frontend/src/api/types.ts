import type { ActiveMixContext } from '../store/playerStore';
export interface Track {
  artists?: { id: string; name: string }[];
  playback_context?: ActiveMixContext; // Local queue origin, applied when this song starts.
  queued_next?: boolean; // Local explicit queue priority; consumed when selected.
  recommended_automatically?: boolean;
  id: string;
  title: string;
  artist_name: string;
  artist_id?: string;
  artist_picture?: string;
  album_title?: string;
  album_id?: string;
  cover_url: string;
  duration: number; // in seconds
  preview?: string;
  is_liked?: boolean;
  is_familiar?: boolean;
  badge?: string;
}

export interface Artist {
  id: string;
  name: string;
  picture_url: string;
  nb_fan?: number;
  nb_album?: number;
  is_following?: boolean;
}

export interface Album {
  artists?: { id: string; name: string }[];
  record_type?: string;
  id: string;
  title: string;
  artist_name: string;
  artist_id?: string;
  cover_url: string;
  release_date?: string;
  nb_tracks?: number;
  tracks?: Track[];
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  is_public?: boolean;
  is_owner?: boolean;
  track_count?: number;
  creator_name?: string;
  created_at?: string;
  tracks?: Track[];
}

export interface User {
  telegram_id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
  is_admin?: boolean;
  auth_token?: string;
}

export interface SyncRequestResponse {
  code: string;
  deep_link: string;
  expires_in: number;
  poll_token: string;
}

export interface SyncCheckResponse {
  status: 'pending' | 'confirmed' | 'expired';
  auth_token?: string;
  user?: {
    telegram_id: number;
    first_name?: string;
    username?: string;
    photo_url?: string;
  };
}

export interface AdminStats {
  total_users: number;
  new_today: number;
  online_5m: number;
  online_15m: number;
  active_24h: number;
  total_plays: number;
  plays_today: number;
  total_favorites: number;
  total_playlists: number;
  cache_size_mb: number;
  cache_files: number;
  cache_max_mb: number;
  updated_at: string;
}

export interface AdminUserItem {
  telegram_id: number;
  first_name: string;
  username: string;
  photo_url?: string;
  created_at?: string;
  last_active_at?: string;
  is_online: boolean;
}

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
  albums: Album[];
}

export interface ChartsData {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
  albums: Album[];
  title?: string;
  description?: string;
  source_url?: string;
  fetched_at?: string;
  stale?: boolean;
}

export type TabType = 'home' | 'search' | 'library' | 'charts';

export interface TopTrackItem {
  id: string;
  title: string;
  artist_name: string;
  cover_url: string;
  duration: number;
  play_count: number;
  rank: number;
}

export interface TopArtistItem {
  artist_name: string;
  picture_url?: string;
  play_count: number;
  unique_songs: number;
  rank: number;
}

export interface UserStats {
  user_id: number;
  username: string;
  total_plays: number;
  total_seconds: number;
  total_minutes: number;
  total_hours: number;
  unique_tracks: number;
  unique_artists: number;
  top_tracks: TopTrackItem[];
  top_artists: TopArtistItem[];
  listener_vibe: string;
  favorite_artist: string;
}

export interface RecentContextItem {
  id: string;
  context_type?: string;
  title: string;
  subtitle?: string;
  cover_url?: string;
  query?: string;
  banner_color?: string;
  banner_text?: string;
  type?: string;
  is_liked_songs?: boolean;
  last_played_at?: string;
}

import axios from 'axios';
import { useMixTuning } from '../store/mixTuning';
import { readAuthToken } from '../platform/authStorage';
import { recordingVersion } from '../hooks/recordingVersions';
import { isHiddenTrack } from '../store/recommendationPreferences';
import { Track, Artist, Album, Playlist, User, SearchResults, ChartsData, AdminStats, AdminUserItem, SyncRequestResponse, SyncCheckResponse, UserStats, RecentContextItem } from './types';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject Telegram InitData and persistent Auth Token
apiClient.interceptors.request.use(async (config) => {
  const tg = (window as any).Telegram?.WebApp;
  if (tg && tg.initData) {
    config.headers['X-Telegram-Init-Data'] = tg.initData;
  }
  const token = await readAuthToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    config.headers['X-Auth-Token'] = token;
  }
  return config;
});

export const api = {
  // Auth
  authTelegram: async (initData: string): Promise<User> => {
    const res = await apiClient.post<User>('/auth/telegram', { init_data: initData });
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },
  getCustomization: async (): Promise<{ customization: any; updated_at: number }> => {
    const res = await apiClient.get('/auth/customization');
    return res.data;
  },
  saveCustomization: async (customization: any): Promise<{ customization: any; updated_at: number }> => {
    const res = await apiClient.put('/auth/customization', { customization });
    return res.data;
  },
  checkCustomization: async (since: number): Promise<{ changed: boolean; customization?: any; updated_at: number }> => {
    const res = await apiClient.get('/auth/customization/check', { params: { since } });
    return res.data;
  },

  // Charts & Search
  getCharts: async (): Promise<ChartsData> => {
    const res = await apiClient.get<ChartsData>('/search/charts');
    return res.data;
  },
  search: async (q: string, type: string = 'all', limit: number = 25): Promise<SearchResults> => {
    const res = await apiClient.get<SearchResults>('/search', { params: { q, type, limit } });
    return res.data;
  },
  getTrack: async (id: string): Promise<Track> => {
    const res = await apiClient.get<Track>(`/search/tracks/${id}`);
    return res.data;
  },
  getAlbum: async (id: string): Promise<Album> => {
    const res = await apiClient.get<Album>(`/search/albums/${id}`);
    return res.data;
  },
  getExternalPlaylist: async (id: string): Promise<Playlist> => {
    const res = await apiClient.get<Playlist>(`/search/playlists/${id}`);
    return res.data;
  },
  getMixTracks: async (query: string, limit = 50, forceRefresh = false, mixId?: string): Promise<Track[]> => {
    const res = await apiClient.get<Track[]>('/recommendations/mix/tracks', {
      params: { q: query, limit, force_refresh: forceRefresh, novelty: useMixTuning.getState().novelty, diversity: useMixTuning.getState().diversity, ...(mixId ? { mix_id: mixId } : {}) },
    });
    return res.data.filter(t => !isHiddenTrack(t));
  },

  // Streaming
  getStreamUrl: (
    trackId: string,
    query?: string,
    duration?: number,
    nextTrack?: { id: string; query?: string; duration?: number }
  ): string => {
    const params = new URLSearchParams({ track_id: trackId, recording_version: String(recordingVersion(trackId)) });
    if (query) params.append('q', query);
    if (duration && duration > 0) params.append('duration', String(duration));
    if (nextTrack && nextTrack.id && nextTrack.id !== trackId) {
      params.append('next_track_id', nextTrack.id);
      if (nextTrack.query) params.append('next_q', nextTrack.query);
      if (nextTrack.duration && nextTrack.duration > 0) {
        params.append('next_duration', String(nextTrack.duration));
      }
    }
    return `${API_BASE}/stream?${params.toString()}`;
  },
  preloadTrack: async (trackId: string, query?: string, duration?: number): Promise<void> => {
    try {
      const params = new URLSearchParams({ track_id: trackId });
      if (query) params.append('q', query);
      if (duration && duration > 0) params.append('duration', String(duration));
      await apiClient.post(`/stream/preload?${params.toString()}`);
    } catch (e) {}
  },
  getContinuousStreamUrl: (trackId: string, queueIds: string[] = []): string => {
    const params = new URLSearchParams({ track_id: trackId });
    if (queueIds.length > 0) {
      params.append('queue', queueIds.slice(0, 15).join(','));
    }
    return `${API_BASE}/stream/continuous?${params.toString()}`;
  },
  refreshTrack: async (trackId: string, artist?: string, title?: string, duration?: number): Promise<{ status: string; message: string }> => {
    const params = new URLSearchParams();
    if (artist) params.append('artist', artist);
    if (title) params.append('title', title);
    if (duration && duration > 0) params.append('duration', String(duration));
    const res = await apiClient.post<{ status: string; message: string }>(`/tracks/${trackId}/refresh?${params.toString()}`);
    return res.data;
  },

  // Artists
  getArtist: async (id: string): Promise<Artist> => {
    const res = await apiClient.get<Artist>(`/artists/${id}`);
    return res.data;
  },
  getArtistTopTracks: async (id: string): Promise<Track[]> => {
    const res = await apiClient.get<Track[]>(`/artists/${id}/top-tracks`);
    return res.data;
  },
  getArtistAlbums: async (id: string): Promise<Album[]> => {
    const res = await apiClient.get<Album[]>(`/artists/${id}/albums`);
    return res.data;
  },
  followArtist: async (id: string): Promise<{ status: string; is_following: boolean }> => {
    const res = await apiClient.post(`/artists/${id}/follow`);
    return res.data;
  },
  unfollowArtist: async (id: string): Promise<{ status: string; is_following: boolean }> => {
    const res = await apiClient.delete(`/artists/${id}/follow`);
    return res.data;
  },
  getMyFollowing: async (): Promise<Artist[]> => {
    const res = await apiClient.get<Artist[]>('/me/following');
    return res.data;
  },

  // Playlists
  getMyPlaylists: async (): Promise<Playlist[]> => {
    const res = await apiClient.get<Playlist[]>('/playlists');
    return res.data;
  },
  getPlaylist: async (id: string): Promise<Playlist> => {
    const res = await apiClient.get<Playlist>(`/playlists/${id}`);
    return res.data;
  },
  createPlaylist: async (title: string, description?: string): Promise<Playlist> => {
    const res = await apiClient.post<Playlist>('/playlists', { title, description });
    return res.data;
  },
  deletePlaylist: async (id: string): Promise<void> => {
    await apiClient.delete(`/playlists/${id}`);
  },
  addTrackToPlaylist: async (playlistId: string, track: Track): Promise<void> => {
    await apiClient.post(`/playlists/${playlistId}/tracks`, {
      track_id: track.id,
      title: track.title,
      artist_name: track.artist_name,
      cover_url: track.cover_url,
      duration: track.duration,
    });
  },
  addBatchTracksToPlaylist: async (
    playlistId: string,
    tracks: Track[]
  ): Promise<{ added_count: number; total_count: number }> => {
    const res = await apiClient.post<{ status: string; added_count: number; total_count: number }>(
      `/playlists/${playlistId}/batch-tracks`,
      {
        tracks: tracks.map((t) => ({
          track_id: t.id,
          title: t.title,
          artist_name: t.artist_name,
          cover_url: t.cover_url,
          duration: t.duration || 0,
        })),
      }
    );
    return res.data;
  },
  downloadTrack: (track: Track): void => {
    const q = `${track.artist_name} - ${track.title}`;
    const url = `${API_BASE}/stream?track_id=${encodeURIComponent(track.id)}&q=${encodeURIComponent(q)}&download=1`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${q}.mp3`);
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  saveOffline: (track: Track): void => {
    void import('../store/offlineStore').then(({ useOfflineStore }) => useOfflineStore.getState().download([track])).catch(() => {});
  },
  removeTrackFromPlaylist: async (playlistId: string, trackId: string): Promise<void> => {
    await apiClient.delete(`/playlists/${playlistId}/tracks/${trackId}`);
  },

  // Favorites (Liked Songs)
  getMyFavorites: async (): Promise<Track[]> => {
    const res = await apiClient.get<Track[]>('/me/favorites');
    return res.data;
  },
  getMyFavoriteIds: async (): Promise<string[]> => {
    const res = await apiClient.get<string[]>('/me/favorites/ids');
    return res.data;
  },
  addFavorite: async (track: Track): Promise<void> => {
    await apiClient.post('/me/favorites', {
      track_id: track.id,
      title: track.title,
      artist_name: track.artist_name,
      cover_url: track.cover_url,
      duration: track.duration,
    });
  },
  removeFavorite: async (trackId: string): Promise<void> => {
    await apiClient.delete(`/me/favorites/${trackId}`);
  },

  // History
  getMyDislikes: async (): Promise<Track[]> => (await apiClient.get('/me/dislikes')).data,
  addDislike: async (track: Track): Promise<void> => {
    await apiClient.post('/me/dislikes', { track_id: track.id, title: track.title, artist_name: track.artist_name,
      cover_url: track.cover_url, duration: Math.max(0, Math.round(track.duration || 0)) });
  },
  removeDislike: async (id: string): Promise<void> => { await apiClient.delete(`/me/dislikes/${encodeURIComponent(id)}`); },

  getMyHistory: async (): Promise<Track[]> => {
    const res = await apiClient.get<Track[]>('/me/history');
    return res.data;
  },
  recordHistory: async (track: Track): Promise<void> => {
    await apiClient.post('/me/history', {
      track_id: track.id,
      title: track.title,
      artist_name: track.artist_name,
      cover_url: track.cover_url,
      duration: track.duration,
    });
  },
  recordRecentContext: async (context: {
    context_type: string;
    context_id: string;
    title: string;
    subtitle?: string;
    cover_url?: string;
    query?: string;
    banner_color?: string;
    banner_text?: string;
  }): Promise<void> => {
    try {
      await apiClient.post('/me/history/context', context);
    } catch (e) {}
  },
  getRecentContexts: async (): Promise<RecentContextItem[]> => {
    try {
      const res = await apiClient.get<RecentContextItem[]>('/me/history/contexts');
      return res.data;
    } catch (e) {
      return [];
    }
  },
  getMyStats: async (): Promise<UserStats> => {
    const res = await apiClient.get<UserStats>('/me/history/stats');
    return res.data;
  },

  // Admin & Presence
  getAdminStats: async (userId: number): Promise<AdminStats> => {
    const res = await apiClient.get<AdminStats>('/admin/stats', {
      params: { user_id: userId },
    });
    return res.data;
  },
  getAdminUsers: async (userId: number, limit: number = 20): Promise<AdminUserItem[]> => {
    const res = await apiClient.get<AdminUserItem[]>('/admin/users', {
      params: { user_id: userId, limit },
    });
    return res.data;
  },
  pingPresence: async (userId: number): Promise<void> => {
    try {
      await apiClient.post('/admin/ping', { user_id: userId });
    } catch (e) {}
  },

  // Lyrics (Supports Synchronized Karaoke LRC & Plain Lyrics)
  getLyrics: async (trackId: string, artist: string, title: string, duration?: number) => {
    const res = await apiClient.get(`/tracks/${trackId}/lyrics`, {
      params: { artist, title, duration },
    });
    return res.data as {
      lyrics: string | null;
      synced_lyrics: string | null;
      is_synced: boolean;
      has_lyrics: boolean;
      source?: string;
    };
  },

  // Similar tracks (for Radio Mode / Up Next)
  getSimilarTracks: async (trackId: string, artistName: string, title: string, limit = 20, exclude: string[] = []) => {
    const res = await apiClient.get(`/tracks/${trackId}/similar`, {
      params: { artist_name: artistName, title, limit, exclude: exclude.join(',') },
    });
    return (res.data as Track[]).filter(t => !isHiddenTrack(t)).map(t => ({ ...t, recommended_automatically: true }));
  },

  // PC & Telegram Account Synchronization
  getWebLink: async (): Promise<{ auth_token: string; web_url: string }> => {
    const res = await apiClient.get('/auth/web-link');
    return res.data;
  },
  requestSyncCode: async (): Promise<SyncRequestResponse> => {
    const res = await apiClient.post<SyncRequestResponse>('/auth/sync/request');
    return res.data;
  },
  checkSyncCode: async (code: string, pollToken: string): Promise<SyncCheckResponse> => {
    const res = await apiClient.get<SyncCheckResponse>(`/auth/sync/check/${code}`, { headers: { 'X-Sync-Poll-Token': pollToken } });
    return res.data;
  },
  confirmSyncCode: async (code: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.post(`/auth/sync/confirm`, null, { params: { code } });
    return res.data;
  },

  // Custom Background Upload & Wallhaven 4K Wallpaper Search
  uploadCustomBackground: async (file: File): Promise<{
    status: string;
    url: string;
    is_video: boolean;
    preview_url?: string;
    title?: string;
    saved_item?: any;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{
      status: string;
      url: string;
      is_video: boolean;
      preview_url?: string;
      title?: string;
      saved_item?: any;
    }>(
      '/auth/customization/upload-bg',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },

  searchWallpapers: async (
    q: string = 'anime',
    page: number = 1,
    sorting: string = 'toplist',
    apiKey?: string
  ): Promise<{
    wallpapers: Array<{ id: string; url: string; thumb: string; resolution: string; category: string; colors: string[] }>;
    total: number;
  }> => {
    const params = new URLSearchParams({ q, page: String(page), sorting });
    if (apiKey) params.append('api_key', apiKey);
    const res = await apiClient.get(`/auth/wallpapers/search?${params.toString()}`);
    return res.data;
  },

  resolveYouTube: async (url: string): Promise<{
    status: string;
    video_id: string;
    title: string;
    preview_url: string;
    is_cached: boolean;
    url: string | null;
    message: string;
  }> => {
    const res = await apiClient.get('/auth/customization/resolve-yt', { params: { url } });
    return res.data;
  },

  convertYoutubeBackground: async (url: string): Promise<{
    status: string;
    video_id?: string;
    title?: string;
    url: string;
    preview_url?: string;
    is_video: boolean;
    message: string;
  }> => {
    const res = await apiClient.post<{
      status: string;
      video_id?: string;
      title?: string;
      url: string;
      preview_url?: string;
      is_video: boolean;
      message: string;
    }>('/auth/customization/convert-yt', { url });
    return res.data;
  },

  resolveSteamWorkshop: async (url: string): Promise<{
    status: string;
    workshop_id: string;
    title: string;
    url: string;
    preview_url: string;
    content_type: string;
    is_animated: boolean;
    youtube_id?: string | null;
    local_path: string;
    message: string;
  }> => {
    const res = await apiClient.get('/auth/customization/resolve-steam', {
      params: { url },
    });
    return res.data;
  },
};


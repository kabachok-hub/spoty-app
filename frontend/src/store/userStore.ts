import { create } from 'zustand';
import { writeAuthToken, clearAuthToken } from '../platform/authStorage';
import { User, Track, Playlist, Artist } from '../api/types';
import { api } from '../api/client';
import { usePlayerStore } from './playerStore';
import { syncHiddenTracks, trackSignature, isHiddenTrack } from './recommendationPreferences';

const preferenceRequests = new Set<string>();

interface UserState {
  user: User | null;
  favoriteIds: Set<string>;
  favorites: Track[];
  playlists: Playlist[];
  followedArtistIds: Set<string>;
  followedArtists: Artist[];
  isLoading: boolean;
  authStatus: 'checking' | 'ready' | 'error';
  dislikes: Track[];
  preferenceNotice: { message: string; undoTrack?: Track } | null;
  toggleDislike: (track: Track) => Promise<boolean>;
  isDisliked: (track: Track) => boolean;
  dismissPreferenceNotice: () => void;

  // Actions
  initUser: () => Promise<void>;
  toggleLike: (track: Track) => Promise<boolean>;
  toggleFollowArtist: (artist: Artist) => Promise<boolean>;
  createPlaylist: (title: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  addBatchTracksToPlaylist: (playlistId: string, tracks: Track[]) => Promise<number>;
  getOrCreateHugePlaylist: () => Promise<Playlist>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  isLiked: (trackId: string) => boolean;
  isFollowing: (artistId: string) => boolean;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  favoriteIds: new Set<string>(),
  favorites: [],
  playlists: [],
  followedArtistIds: new Set<string>(),
  followedArtists: [],
  isLoading: false,
  authStatus: 'checking',
  dislikes: [],
  preferenceNotice: null,
  isDisliked: isHiddenTrack,
  dismissPreferenceNotice: () => set({ preferenceNotice: null }),

  initUser: async () => {
    set({ isLoading: true, authStatus: 'checking' });
    let authenticated = false;
    try {
      // 1. Check for incoming auth token in URL (e.g. opened from Telegram bot or web login link)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('auth_token') || urlParams.get('auth');
        if (tokenFromUrl) {
          await writeAuthToken(tokenFromUrl);
          urlParams.delete('auth_token');
          urlParams.delete('auth');
          const cleanQuery = urlParams.toString();
          const cleanUrl = window.location.pathname + (cleanQuery ? '?' + cleanQuery : '') + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
      } catch (e) {}

      // 2. Get or authenticate user
      let user: User;
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initData) {
        user = await api.authTelegram(tg.initData);
        if (user.auth_token) {
          await writeAuthToken(user.auth_token);
        }
      } else {
        user = await api.getMe();
        if (user.auth_token) {
          await writeAuthToken(user.auth_token);
        }
      }
      set({ user, authStatus: 'ready' });
      authenticated = true;
      api.pingPresence(user.telegram_id);

      // 3. Fetch user's data in parallel
      const [favIds, favs, playlists, following, dislikes] = await Promise.all([
        api.getMyFavoriteIds().catch(() => [] as string[]),
        api.getMyFavorites().catch(() => [] as Track[]),
        api.getMyPlaylists().catch(() => [] as Playlist[]),
        api.getMyFollowing().catch(() => [] as Artist[]),
        api.getMyDislikes(),
      ]);

      syncHiddenTracks(dislikes);
      set({
        favoriteIds: new Set(favIds),
        dislikes,
        favorites: favs,
        playlists,
        followedArtists: following,
        followedArtistIds: new Set(following.map((a) => a.id)),
      });
      usePlayerStore.getState().pruneDislikedRecommendations();
    } catch (error) {
      console.error('Failed to init user data:', error);
      if (!authenticated) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        set({ user: null, authStatus: status === 401 || status === 403 ? 'ready' : 'error' });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithToken: async (token: string) => {
    await writeAuthToken(token);
    await get().initUser();
  },

  logout: () => {
    void clearAuthToken().then(() => window.location.reload());
  },

  isLiked: (trackId: string) => {
    return get().favoriteIds.has(trackId);
  },

  isFollowing: (artistId: string) => {
    return get().followedArtistIds.has(artistId);
  },

  toggleLike: async (track: Track) => {
    const requestKey = trackSignature(track);
    if (preferenceRequests.has(requestKey)) return get().isLiked(track.id);
    preferenceRequests.add(requestKey);
    const { favoriteIds, favorites } = get();
    const isCurrentlyLiked = favoriteIds.has(track.id);

    // Optimistic UI update
    const nextFavIds = new Set(favoriteIds);
    let nextFavorites: Track[];

    if (isCurrentlyLiked) {
      nextFavIds.delete(track.id);
      nextFavorites = favorites.filter((t) => t.id !== track.id);
    } else {
      nextFavIds.add(track.id);
      nextFavorites = [{ ...track, is_liked: true }, ...favorites];
    }

    set({ favoriteIds: nextFavIds, favorites: nextFavorites });

    try {
      if (isCurrentlyLiked) {
        await api.removeFavorite(track.id);
      } else {
        await api.addFavorite(track);
        const dislikes = get().dislikes.filter(t => t.id !== track.id && trackSignature(t) !== trackSignature(track));
        syncHiddenTracks(dislikes);
        set({ dislikes });
      }
      return !isCurrentlyLiked;
    } catch (err) {
      // Revert on failure
      set({ favoriteIds, favorites });
      console.error('Failed to toggle like:', err);
      return isCurrentlyLiked;
    } finally {
      preferenceRequests.delete(requestKey);
    }
  },

  toggleDislike: async (track: Track) => {
    const requestKey = trackSignature(track);
    const hidden = get().dislikes.find(t => t.id === track.id || trackSignature(t) === requestKey);
    if (!get().user) {
      set({ preferenceNotice: { message: 'Войдите через Telegram, чтобы сохранять дизлайки.' } });
      return false;
    }
    if (preferenceRequests.has(requestKey)) return Boolean(hidden);
    preferenceRequests.add(requestKey);
    try {
      if (hidden) await api.removeDislike(hidden.id); else await api.addDislike(track);
      const dislikes = get().dislikes.filter(t => t.id !== track.id && trackSignature(t) !== requestKey);
      if (!hidden) dislikes.unshift(track);
      syncHiddenTracks(dislikes);
      const favorites = hidden ? get().favorites : get().favorites.filter(t => t.id !== track.id && trackSignature(t) !== requestKey);
      set({ dislikes, favorites, favoriteIds: new Set(favorites.map(t => t.id)),
        preferenceNotice: hidden ? { message: 'Трек снова разрешён в рекомендациях.' }
          : { message: 'Больше не предлагаем этот трек в миксах.', undoTrack: track } });
      usePlayerStore.getState().pruneDislikedRecommendations();
      return !hidden;
    } catch {
      set({ preferenceNotice: { message: 'Не удалось сохранить изменение. Проверьте соединение и попробуйте ещё раз.' } });
      return Boolean(hidden);
    } finally { preferenceRequests.delete(requestKey); }
  },

  toggleFollowArtist: async (artist: Artist) => {
    const { followedArtistIds, followedArtists } = get();
    const isCurrentlyFollowed = followedArtistIds.has(artist.id);

    // Optimistic update
    const nextIds = new Set(followedArtistIds);
    let nextArtists: Artist[];

    if (isCurrentlyFollowed) {
      nextIds.delete(artist.id);
      nextArtists = followedArtists.filter((a) => a.id !== artist.id);
    } else {
      nextIds.add(artist.id);
      nextArtists = [{ ...artist, is_following: true }, ...followedArtists];
    }

    set({ followedArtistIds: nextIds, followedArtists: nextArtists });

    try {
      if (isCurrentlyFollowed) {
        await api.unfollowArtist(artist.id);
      } else {
        await api.followArtist(artist.id);
      }
      return !isCurrentlyFollowed;
    } catch (err) {
      // Revert on error
      set({ followedArtistIds, followedArtists });
      console.error('Failed to toggle follow artist:', err);
      return isCurrentlyFollowed;
    }
  },

  createPlaylist: async (title: string, description?: string) => {
    const newPl = await api.createPlaylist(title, description);
    set((state) => ({ playlists: [newPl, ...state.playlists] }));
    return newPl;
  },

  deletePlaylist: async (playlistId: string) => {
    await api.deletePlaylist(playlistId);
    set((state) => ({
      playlists: state.playlists.filter((p) => p.id !== playlistId),
    }));
  },

  addTrackToPlaylist: async (playlistId: string, track: Track) => {
    await api.addTrackToPlaylist(playlistId, track);
    // Update local playlist count
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, track_count: (p.track_count || 0) + 1 } : p
      ),
    }));
  },

  addBatchTracksToPlaylist: async (playlistId: string, tracks: Track[]) => {
    const res = await api.addBatchTracksToPlaylist(playlistId, tracks);
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, track_count: res.total_count } : p
      ),
    }));
    return res.added_count;
  },

  getOrCreateHugePlaylist: async () => {
    const { playlists, createPlaylist } = get();
    const existing = playlists.find(
      (p) => p.title.trim().toLowerCase() === 'огромный плейлист'
    );
    if (existing) return existing;
    return await createPlaylist(
      'Огромный плейлист',
      'Все добавленные треки и любимая музыка'
    );
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    await api.removeTrackFromPlaylist(playlistId, trackId);
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, track_count: Math.max(0, (p.track_count || 1) - 1) } : p
      ),
    }));
  },

  refreshPlaylists: async () => {
    try {
      const playlists = await api.getMyPlaylists();
      set({ playlists });
    } catch (e) {
      console.error('Failed to refresh playlists:', e);
    }
  },

  refreshFavorites: async () => {
    try {
      const [favIds, favs] = await Promise.all([
        api.getMyFavoriteIds(),
        api.getMyFavorites(),
      ]);
      set({ favoriteIds: new Set(favIds), favorites: favs });
    } catch (e) {
      console.error('Failed to refresh favorites:', e);
    }
  },
}));

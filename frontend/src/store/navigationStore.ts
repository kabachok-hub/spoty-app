import { create } from 'zustand';
import { api } from '../api/client';
import { MixItem } from '../components/cards/MixCard';
import { TabType } from '../api/types';
import { usePlayerStore } from './playerStore';

export type ViewState =
  | { type: 'tab'; tab: TabType }
  | { type: 'artist'; artistId: string }
  | { type: 'album'; albumId: string }
  | { type: 'playlist'; playlistId: string }
  | { type: 'liked_songs' }
  | { type: 'stats' }
  | { type: 'mix'; mix: MixItem; nextMix?: MixItem };

interface NavigationState {
  currentView: ViewState;
  viewHistory: ViewState[];
  activeTab: TabType;
  navigateTo: (view: ViewState) => void;
  goBack: () => void;
  setActiveTab: (tab: TabType) => void;
  openArtist: (artistId?: string, artistName?: string) => Promise<void>;
  openAlbum: (albumId: string) => void;
  openStats: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentView: { type: 'tab', tab: 'home' },
  viewHistory: [{ type: 'tab', tab: 'home' }],
  activeTab: 'home',

  navigateTo: (view: ViewState) => {
    set((state) => ({
      currentView: view,
      viewHistory: [...state.viewHistory.slice(-49), view],
      activeTab: view.type === 'tab' ? view.tab : state.activeTab,
    }));
  },

  goBack: () => {
    const { viewHistory } = get();
    if (viewHistory.length > 1) {
      const newHistory = viewHistory.slice(0, viewHistory.length - 1);
      set({
        viewHistory: newHistory,
        currentView: newHistory[newHistory.length - 1],
        activeTab: newHistory.find(v => v.type === 'tab')?.type === 'tab' ? (newHistory.find(v => v.type === 'tab') as {type: 'tab'; tab: TabType}).tab : get().activeTab,
      });
    }
  },

  setActiveTab: (tab: TabType) => {
    set({
      activeTab: tab,
      currentView: { type: 'tab', tab },
      viewHistory: [{ type: 'tab', tab }],
    });
  },

  openArtist: async (artistId?: string, artistName?: string) => {
    // Close fullscreen player if open
    usePlayerStore.getState().setFullscreen(false);

    if (artistId && artistId.trim() !== '') {
      get().navigateTo({ type: 'artist', artistId: artistId.trim() });
      return;
    }

    if (artistName && artistName.trim() !== '') {
      try {
        const cleanName = artistName.split(',')[0].split('feat.')[0].trim();
        const res = await api.search(cleanName, 'artist');
        if (res.artists && res.artists.length > 0) {
          get().navigateTo({ type: 'artist', artistId: res.artists[0].id });
          return;
        }
      } catch (err) {
        console.warn('Failed to resolve artist by name:', err);
      }
    }
  },

  openAlbum: (albumId: string) => {
    // Close fullscreen player if open
    usePlayerStore.getState().setFullscreen(false);
    if (albumId && albumId.trim() !== '') {
      get().navigateTo({ type: 'album', albumId: albumId.trim() });
    }
  },

  openStats: () => {
    usePlayerStore.getState().setFullscreen(false);
    get().navigateTo({ type: 'stats' });
  },
}));

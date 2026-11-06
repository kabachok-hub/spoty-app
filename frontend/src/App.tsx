import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useUserStore } from './store/userStore';
import { useSettingsStore } from './store/settingsStore';
import { usePlayerStore } from './store/playerStore';
import { api } from './api/client';
import { PlaybackRuntime } from './platform/PlaybackRuntime';
import { isNativeClient } from './platform/nativeBridge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ChevronLeft } from 'lucide-react';
import { DesktopLibrary } from './components/layout/DesktopLibrary';
import { Header } from './components/layout/Header';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { useTelegram } from './hooks/useTelegram';
import { MiniPlayer } from './components/player/MiniPlayer';
import { PreferenceNotice } from './components/player/PreferenceNotice';
import { BackgroundPlaybackHelp, openBackgroundPlaybackHelp } from './components/player/BackgroundPlaybackHelp';
import { TasteSetup } from './components/onboarding/TasteSetup';
import { BACKGROUND_PLAYBACK_MESSAGE } from './hooks/playbackDiagnostics';
import { NowPlayingSidebar } from './components/player/NowPlayingSidebar';
import { FullscreenPlayer } from './components/player/FullscreenPlayer';
import { QueueDrawer } from './components/player/QueueDrawer';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer';
import { SettingsModal } from './components/settings/SettingsModal';
import { AdminModal } from './components/admin/AdminModal';

import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { ArtistPage } from './pages/ArtistPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { MixPage } from './pages/MixPage';
import { AlbumPage } from './pages/AlbumPage';
import { StatsPage } from './pages/StatsPage';
import { ChartsPage } from './pages/ChartsPage';
import { MixItem } from './components/cards/MixCard';

import { useNavigationStore, ViewState } from './store/navigationStore';
import { useCustomizationTheme } from './hooks/useCustomizationTheme';
import { LiveBackground } from './components/layout/LiveBackground';

export const App: React.FC = () => {
  // Initialize dynamic theme, accent colors, and glassmorphism
  useCustomizationTheme();
  // Initialize audio engine and MediaSession integrations
  // Desktop keyboard shortcuts: Space, Arrows, M, L, F
  useKeyboardShortcuts();
  useEffect(() => {
    if (!isNativeClient()) return;
    const back = (event: Event) => {
      const player = usePlayerStore.getState(), nav = useNavigationStore.getState();
      if (player.isQueueOpen) { player.setQueueOpen(false); event.preventDefault(); }
      else if (player.isFullscreen) { player.setFullscreen(false); event.preventDefault(); }
      else if (nav.currentView.type !== 'tab') { nav.goBack(); event.preventDefault(); }
      else if (nav.activeTab !== 'home') { nav.setActiveTab('home'); event.preventDefault(); }
    };
    window.addEventListener('spoty-back', back);
    const accountChanged = () => usePlayerStore.getState().setQueue([], 0);
    window.addEventListener('spoty-account-changed', accountChanged);
    const toggle = () => usePlayerStore.getState().togglePlay();
    window.addEventListener('spoty-toggle-play', toggle);
    return () => { window.removeEventListener('spoty-back', back); window.removeEventListener('spoty-account-changed', accountChanged); window.removeEventListener('spoty-toggle-play', toggle); };
  }, []);

  const initUser = useUserStore((state) => state.initUser);
  const user = useUserStore((state) => state.user);
  const theme = useSettingsStore((state) => state.theme);
  const t = useSettingsStore((state) => state.t);
  const isAdminOpen = useSettingsStore((state) => state.isAdminOpen);
  const setAdminOpen = useSettingsStore((state) => state.setAdminOpen);

  const currentView = useNavigationStore((state) => state.currentView);
  const activeTab = useNavigationStore((state) => state.activeTab);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const setActiveTab = useNavigationStore((state) => state.setActiveTab);

  const isNowPlayingOpen = usePlayerStore((state) => state.isNowPlayingOpen);
  const setNowPlayingOpen = usePlayerStore((state) => state.setNowPlayingOpen);
  const toggleNowPlaying = usePlayerStore((state) => state.toggleNowPlaying);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playbackError = usePlayerStore(s => s.playbackError);
  const playbackNotice = usePlayerStore(s => s.playbackNotice);
  useEffect(()=>{if(!playbackNotice)return;const timer=setTimeout(()=>usePlayerStore.setState({playbackNotice:null}),7000);return()=>clearTimeout(timer);},[playbackNotice]);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const isQueueOpen = usePlayerStore((state) => state.isQueueOpen);
  const setQueueOpen = usePlayerStore((state) => state.setQueueOpen);
  const { haptic } = useTelegram();

  useEffect(() => {
    initUser();

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const trackId = urlParams.get('trackId');
      if (trackId) {
        // Clean trackId from URL right away so refreshing page restores the actual latest track
        urlParams.delete('trackId');
        const cleanQuery = urlParams.toString();
        const cleanUrl = window.location.pathname + (cleanQuery ? '?' + cleanQuery : '') + window.location.hash;
        try {
          window.history.replaceState({}, '', cleanUrl);
        } catch (e) {}

        api.getTrack(trackId).then((track) => {
          if (track) {
            usePlayerStore.getState().playTrack(track);
          }
        }).catch((err) => {
          console.warn('Failed to load track from URL param:', err);
        });
      }
    } catch (e) {}
  }, [initUser]);

  // Real-time presence heartbeat to track active users
  useEffect(() => {
    if (!user?.telegram_id) return;
    api.pingPresence(user.telegram_id);
    const interval = setInterval(() => {
      api.pingPresence(user.telegram_id);
    }, 45000);
    return () => clearInterval(interval);
  }, [user?.telegram_id]);

  const handleBack = () => {
    goBack();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const isDetailView = currentView.type !== 'tab';
  const [visitedTabs, setVisitedTabs] = useState(() => new Set<TabType>(['home']));
  const scrollPositions = useRef(new Map<string, number>());
  const viewKey = JSON.stringify(currentView);
  useLayoutEffect(() => {
    if (currentView.type === 'tab' && !visitedTabs.has(currentView.tab)) {
      setVisitedTabs(previous => new Set([...previous, currentView.tab]));
    }
    window.scrollTo(0, scrollPositions.current.get(viewKey) || 0);
    return () => { scrollPositions.current.set(viewKey, window.scrollY); };
  }, [viewKey]);


  return (
    <div className="min-h-screen text-white flex flex-col font-sans transition-colors duration-300 relative overflow-x-hidden">
      <PlaybackRuntime />
      {/* ── Live / Animated Background Layer ── */}
      <LiveBackground />
      {/* Top Header with desktop tabs */}
      {!isFullscreen && (
        <Header
          showBack={isDetailView}
          onBack={handleBack}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          title={
            !isDetailView
              ? activeTab === 'search'
                ? t('search')
                : activeTab === 'library'
                ? t('your_library')
                : undefined
              : undefined
          }
        />
      )}

      {/* ── Main Layout: Content Area on Left + Right Sidebar on Right ── */}
      <div
        className={`flex-1 flex min-h-0 w-full relative ${
          isFullscreen ? 'invisible pointer-events-none' : ''
        }`}
      >
        {!isFullscreen && <DesktopLibrary />}
        {/* Main Content Pages: shifts left / contracts right margin on desktop so content isn't covered */}
        <main
          className={`spoty-main flex-1 min-w-0 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            isNowPlayingOpen ? 'md:mr-80 lg:mr-[340px]' : 'mr-0'
          }`}
        >
          <div className="spoty-page-surface glass-surface w-full max-w-2xl md:max-w-5xl lg:max-w-7xl xl:max-w-[1400px] mx-auto px-0 md:px-2 rounded-2xl">
            {visitedTabs.has('home') && (<div hidden={currentView.type !== 'tab' || currentView.tab !== 'home'}>
              <HomePage
                onSelectArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
                onSelectPlaylist={(playlistId) => navigateTo({ type: 'playlist', playlistId })}
                onSelectLikedSongs={() => navigateTo({ type: 'liked_songs' })}
                onSelectMix={(mix, nextMix) => navigateTo({ type: 'mix', mix, nextMix })}
                onSelectAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
              />
            </div>)}

            {visitedTabs.has('search') && (<div hidden={currentView.type !== 'tab' || currentView.tab !== 'search'}>
              <SearchPage
                onSelectArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
                onSelectPlaylist={(playlistId) => navigateTo({ type: 'playlist', playlistId })}
                onSelectAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
              />
            </div>)}

            {visitedTabs.has('library') && (<div hidden={currentView.type !== 'tab' || currentView.tab !== 'library'}>
              <LibraryPage
                onSelectPlaylist={(playlistId) => navigateTo({ type: 'playlist', playlistId })}
                onSelectLikedSongs={() => navigateTo({ type: 'liked_songs' })}
                onSelectArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
              />
            </div>)}

            {currentView.type === 'artist' && (
              <ArtistPage
                artistId={currentView.artistId}
                onBack={handleBack}
                onSelectAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
              />
            )}

            {currentView.type === 'album' && (
              <AlbumPage
                albumId={currentView.albumId}
                onBack={handleBack}
              />
            )}

            {currentView.type === 'playlist' && (
              <PlaylistPage
                playlistId={currentView.playlistId}
                onBack={handleBack}
              />
            )}

            {currentView.type === 'mix' && (
              <MixPage
                mix={currentView.mix}
                nextMix={currentView.nextMix}
                onBack={handleBack}
                onSelectNextMix={(nextMix) => navigateTo({ type: 'mix', mix: nextMix })}
              />
            )}

            {currentView.type === 'liked_songs' && (
              <PlaylistPage isLikedSongs={true} onBack={handleBack} />
            )}

            {currentView.type === 'stats' && (
              <StatsPage onBack={handleBack} />
            )}

            {visitedTabs.has('charts') && (<div hidden={currentView.type !== 'tab' || currentView.tab !== 'charts'}>
              <ChartsPage
                onSelectArtist={(artistId) => navigateTo({ type: 'artist', artistId })}
                onSelectAlbum={(albumId) => navigateTo({ type: 'album', albumId })}
              />
            </div>)}
          </div>
        </main>

        {/* ── Animated Card on the Right (Spotify Now Playing View) ── */}
        <NowPlayingSidebar />
      </div>

      {playbackNotice && !playbackError && <div role="status" className="fixed bottom-36 md:bottom-24 left-4 right-4 max-w-lg mx-auto z-50 rounded-2xl bg-[#202020] border border-white/10 px-4 py-3 text-sm shadow-xl flex items-center gap-3">
        <span className="flex-1">{playbackNotice}</span>
        <button className="min-h-11 px-2 text-zinc-300" onClick={()=>usePlayerStore.getState().pause()}>Остановить</button>
        <button className="min-h-11 px-2 text-zinc-400" aria-label="Скрыть уведомление плеера" onClick={()=>usePlayerStore.setState({playbackNotice:null})}>×</button>
      </div>}
      {playbackError && <div role="alert" className="fixed bottom-36 md:bottom-24 left-4 right-4 max-w-lg mx-auto z-50 rounded-2xl bg-[#27221b] border border-amber-300/30 p-4 text-sm shadow-xl">
        <p>{playbackError}</p>
        {playbackError.startsWith(BACKGROUND_PLAYBACK_MESSAGE) && <button className="min-h-11 px-4 mt-2 rounded-full bg-[#1DB954] text-black font-semibold" onClick={openBackgroundPlaybackHelp}>Как настроить фон</button>}
        <button className="min-h-11 px-4 mt-2 rounded-full bg-white/10 font-semibold" onClick={() => usePlayerStore.setState({playbackError:null,playbackNotice:null,playbackIntent:usePlayerStore.getState().playbackIntent+1,playToken:Date.now(),isPlaying:true})}>Повторить</button>
        <button className="min-h-11 px-4 mt-2 text-zinc-400" onClick={() => usePlayerStore.setState({playbackError:null})}>Закрыть</button>
      </div>}

      {/* Sticky Mini Player above Bottom Nav with Sound Controls (Always fixed at bottom) */}
      <PreferenceNotice />
      <MiniPlayer />

      {/* Spotify Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} onChangeTab={handleTabChange} />

      {/* ── Floating Right-Edge Pull Tab (visible when sidebar is closed) ── */}
      {!isNowPlayingOpen && !isFullscreen && (
        <button
          onClick={() => {
            haptic.impact('medium');
            toggleNowPlaying();
          }}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-[#181818]/90 hover:bg-[#282828] text-white border-l border-y border-white/15 rounded-l-xl px-1.5 py-3 shadow-2xl backdrop-blur-md flex-col items-center gap-1 transition-all active:scale-95 group hover:border-[#1DB954]/50 hover:bg-[#1DB954]/10 cursor-pointer"
          title="Выдвинуть музыкальную карточку"
          aria-label="Музыкальная карточка"
        >
          <ChevronLeft size={16} className="text-zinc-400 group-hover:text-[#1DB954] transition-colors" />
          <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold text-zinc-400 group-hover:text-white tracking-widest uppercase">
            {isPlaying ? 'Играет' : 'Трек'}
          </span>
          {isPlaying && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-ping mt-0.5" />
          )}
        </button>
      )}

      {/* Fullscreen Player modal */}
      <FullscreenPlayer />
      <QueueDrawer isOpen={isQueueOpen} onClose={() => setQueueOpen(false)} />

      {/* Notifications Drawer */}
      <NotificationsDrawer />

      {/* Settings Modal (Language & Themes) */}
      <SettingsModal />
      <TasteSetup />
      <BackgroundPlaybackHelp hasError={Boolean(playbackError)} />

      {/* Admin Panel Modal */}
      <AdminModal isOpen={isAdminOpen} onClose={() => setAdminOpen(false)} />
    </div>
  );
};

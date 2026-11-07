import { AppUpdateButton } from './AppUpdateButton';
import React, { useState } from 'react';
import { ChevronLeft, User as UserIcon, Bell, Settings, Shield, Home, Search, Library, BarChart3, PanelRightOpen, PanelRightClose, TrendingUp, ExternalLink } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useNavigationStore } from '../../store/navigationStore';
import { usePlayerStore } from '../../store/playerStore';
import { useTelegram } from '../../hooks/useTelegram';
import { TabType } from './BottomNav';
import { useCustomizationStore } from '../../store/customizationStore';
import { SyncModal } from '../auth/SyncModal';
import { mobileMiniAppPlatform } from '../../hooks/playbackDiagnostics';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  activeTab?: TabType;
  onChangeTab?: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  activeTab = 'home',
  onChangeTab,
}) => {
  const user = useUserStore((state) => state.user);
  const authStatus = useUserStore(state => state.authStatus);
  const initUser = useUserStore(state => state.initUser);
  const [syncOpen, setSyncOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { haptic } = useTelegram();
  const t = useSettingsStore((state) => state.t);
  const setNotificationsOpen = useSettingsStore((state) => state.setNotificationsOpen);
  const setSettingsOpen = useSettingsStore((state) => state.setSettingsOpen);
  const setAdminOpen = useSettingsStore((state) => state.setAdminOpen);
  const unreadCount = useSettingsStore((state) => state.unreadCount);
  const openStats = useNavigationStore((state) => state.openStats);
  const isNowPlayingOpen = usePlayerStore((state) => state.isNowPlayingOpen);
  const toggleNowPlaying = usePlayerStore((state) => state.toggleNowPlaying);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const navStyle = useCustomizationStore((state) => state.navStyle);

  const isRealUser = user && user.telegram_id !== 999999999;

  const handleOpenBrowser = () => {
    haptic.impact('medium');
    const url = window.location.origin;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (<>
    <header className="spoty-header sticky top-0 z-30 px-3 sm:px-6 md:px-8 py-2 sm:py-2.5 glass-surface safe-top border-b border-white/5 select-none relative backdrop-blur-xl">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 relative min-h-[38px] sm:min-h-[42px]">
        {/* Left: Brand & Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-10 flex-1 sm:flex-initial sm:max-w-[calc(50%-220px)] lg:max-w-[calc(50%-240px)]">
          {showBack && (
            <button
              onClick={() => {
                haptic.impact('light');
                onBack?.();
              }}
              className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition active:scale-95 flex-shrink-0"
              aria-label="Назад" title="Вернуться назад"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Spoty Logo & Brand */}
          <button onClick={() => useNavigationStore.getState().setActiveTab('home')} aria-label="Spoty — на главную" className="flex items-center gap-1.5 sm:gap-2 mr-1 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#1DB954] to-[#10b981] flex items-center justify-center shadow-md shadow-[#1DB954]/25 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="10" width="2.5" height="4" rx="1.25" fill="#121212" />
                <rect x="9" y="7" width="2.5" height="10" rx="1.25" fill="#121212" />
                <rect x="13" y="5" width="2.5" height="14" rx="1.25" fill="#121212" />
                <rect x="17" y="8.5" width="2.5" height="7" rx="1.25" fill="#121212" />
              </svg>
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">Spoty</span>
          </button>

          {title && (
            <h1 className={`text-sm sm:text-base md:text-xl font-bold text-white truncate min-w-0 border-l border-white/10 pl-2 sm:pl-2.5 ${!showBack ? 'sm:hidden' : ''}`}>
              {title}
            </h1>
          )}
        </div>

        {/* Center: Desktop Navigation Tabs (Strictly centered, never jumps left or right) */}
        {onChangeTab && (
          <div
            className={`hidden md:flex items-center transition-all absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto ${
              navStyle === 'floating'
                ? 'glass-surface border border-white/20 rounded-full px-2 py-1 shadow-2xl shadow-black/80 gap-1.5'
                : navStyle === 'compact'
                ? 'bg-black/40 border border-white/10 rounded-full p-1 gap-1'
                : 'bg-[#222222] p-1 rounded-full border border-white/10 shadow-inner gap-1.5'
            }`}
          >
            {[
              { id: 'home' as TabType, label: t('home'), icon: Home },
              { id: 'search' as TabType, label: t('search'), icon: Search },
              { id: 'charts' as TabType, label: 'Чарты', icon: TrendingUp },
              { id: 'library' as TabType, label: t('your_library'), icon: Library },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id && !showBack;

              if (navStyle === 'compact') {
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      haptic.selection();
                      onChangeTab(tab.id);
                    }}
                    title={tab.label}
                    className={`p-2 rounded-full transition-all active:scale-95 ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      size={18}
                      style={{ color: isActive ? 'var(--accent-color, #1DB954)' : undefined }}
                    />
                  </button>
                );
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    haptic.selection();
                    onChangeTab(tab.id);
                  }}
                  className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                    isActive
                      ? navStyle === 'floating'
                        ? 'bg-[var(--accent-color,#1DB954)] text-black font-extrabold shadow-lg shadow-[var(--accent-glow)] scale-105'
                        : 'bg-white text-black shadow-md'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Right side icons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto z-10">

          {/* Animated Card Toggle Button in Header (desktop only, hidden on mobile) */}
          <button
            onClick={() => {
              haptic.impact('medium');
              toggleNowPlaying();
            }}
            className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border active:scale-95 shadow-sm ${
              isNowPlayingOpen
                ? 'bg-[#1DB954] text-black border-[#1DB954] font-bold shadow-md shadow-[#1DB954]/25'
                : 'bg-white/10 border-white/15 text-zinc-200 hover:bg-white/15 hover:text-white hover:border-white/30'
            }`}
            title={isNowPlayingOpen ? 'Скрыть карточку' : 'Выдвинуть карточку'}
            aria-label="Карточка трека"
          >
            {isNowPlayingOpen ? (
              <PanelRightClose size={16} />
            ) : (
              <PanelRightOpen size={16} className={isNowPlayingOpen ? 'text-black' : 'text-[#1DB954]'} />
            )}
            <span>
              {isNowPlayingOpen ? 'Скрыть' : 'Карточка'}
            </span>
          </button>

          {/* Stats Button (Desktop/Tablet) */}
          <button
            onClick={() => {
              haptic.selection();
              openStats();
            }}
            className="hidden xl:flex p-2 text-zinc-300 hover:text-[#1DB954] transition rounded-full hover:bg-white/10"
            title="Статистика и Топ-5"
          >
            <BarChart3 size={19} />
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => {
              haptic.selection();
              setNotificationsOpen(true);
            }}
            className="hidden xl:flex relative p-1.5 sm:p-2 text-zinc-300 hover:text-white transition rounded-full hover:bg-white/10 active:scale-95"
            title={t('notifications')}
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#1DB954] rounded-full ring-2 ring-[#121212]" />
            )}
          </button>

          <AppUpdateButton />

          {/* Settings Gear */}
          <button
            onClick={() => {
              haptic.selection();
              setSettingsOpen(true);
            }}
            className="p-1.5 sm:p-2 text-zinc-300 hover:text-white transition rounded-full hover:bg-white/10 active:scale-95"
            title={t('settings')}
          >
            <Settings size={19} />
          </button>

          {/* Admin Shield Button */}
          {user?.is_admin && (
            <button
              onClick={() => {
                haptic.impact('medium');
                setAdminOpen(true);
              }}
              className="flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-full text-amber-400 text-xs font-bold transition active:scale-95 shadow-sm"
              title="Панель администратора"
            >
              <Shield size={14} className="text-amber-400" />
              <span className="hidden sm:inline">Админ</span>
            </button>
          )}

          {!isRealUser && authStatus === 'checking' && (
            <div role="status" aria-label="Проверяем вход" className="h-11 w-11 rounded-full bg-white/10 animate-pulse flex items-center justify-center">
              <UserIcon size={18} className="text-zinc-500" />
            </div>
          )}
          {!isRealUser && authStatus === 'error' && (
            <button onClick={() => void initUser()} className="min-h-11 px-3 rounded-full bg-white/10 text-sm" aria-label="Повторить проверку входа">Повторить</button>
          )}
          {!isRealUser && authStatus === 'ready' && (
            <button onClick={() => setSyncOpen(true)} className="min-h-11 px-4 rounded-full bg-[#1DB954] text-black text-sm font-bold" aria-label="Войти через Telegram">
              Войти
            </button>
          )}

          {/* User Badge */}
          <div className="relative">
          <button onClick={() => isRealUser ? setProfileOpen(!profileOpen) : setSyncOpen(true)}
            aria-label="Профиль и настройки" aria-expanded={profileOpen}
            className={`min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-white/10 px-2 text-sm ${isRealUser ? 'flex' : 'hidden'}`}>
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name || 'User'}
                className="w-6 h-6 sm:w-5 sm:h-5 rounded-full object-cover"
              />
            ) : (
              <div className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                isRealUser ? 'bg-[#1DB954] text-black' : 'bg-zinc-700 text-zinc-300'
              }`}>
                {isRealUser && user?.first_name ? user.first_name[0].toUpperCase() : <UserIcon size={12} />}
              </div>
            )}
            <span className="max-w-[100px] truncate hidden sm:inline">
              {isRealUser ? user?.first_name || user?.username : 'Слушатель'}
            </span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#202020] border border-white/10 p-2 shadow-xl z-50">
              <div className="px-3 py-2 text-sm text-zinc-400 truncate">{user?.first_name || 'Профиль'}</div>
              <button className="w-full text-left px-3 min-h-11 rounded-lg hover:bg-white/10 text-sm" onClick={() => {setNotificationsOpen(true); setProfileOpen(false);}}>Уведомления {unreadCount > 0 ? `(${unreadCount})` : ''}</button>
              <button className="w-full text-left px-3 min-h-11 rounded-lg hover:bg-white/10 text-sm" onClick={() => {openStats(); setProfileOpen(false);}}>Моя статистика</button>
              <button className="w-full text-left px-3 min-h-11 rounded-lg hover:bg-white/10 text-sm" onClick={() => {setSettingsOpen(true); setProfileOpen(false);}}>Настройки</button>
              <button className="w-full text-left px-3 min-h-11 rounded-lg hover:bg-white/10 text-sm" onClick={() => setProfileOpen(false)}>Закрыть</button>
            </div>
          )}
          </div>
        </div>
      </div>
      {mobileMiniAppPlatform() && <div className="md:hidden pt-1 flex justify-end"><button onClick={handleOpenBrowser} className="flex items-center gap-2 min-h-11 px-3 rounded-full text-xs font-semibold bg-white/10 text-zinc-200" aria-label="Открыть в браузере"><ExternalLink size={16}/>Открыть в браузере</button></div>}
    </header>
    <SyncModal isOpen={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
};

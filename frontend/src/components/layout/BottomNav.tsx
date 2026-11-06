import React, { useLayoutEffect, useRef } from 'react';
import { Home, Search, Library, TrendingUp } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { useSettingsStore } from '../../store/settingsStore';
import { useCustomizationStore } from '../../store/customizationStore';
import { usePlayerStore } from '../../store/playerStore';

export type TabType = 'home' | 'search' | 'library' | 'charts';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const { haptic } = useTelegram();
  const t = useSettingsStore((state) => state.t);
  const navStyle = useCustomizationStore((state) => state.navStyle);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const measure = () => {
      const bounds = nav.getBoundingClientRect();
      if (bounds.height === 0) root.style.removeProperty('--mobile-nav-offset');
      else root.style.setProperty('--mobile-nav-offset', `${Math.ceil(window.innerHeight - bounds.top)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      root.style.removeProperty('--mobile-nav-offset');
    };
  }, [navStyle, isFullscreen]);

  if (isFullscreen) return null;

  const handleTabClick = (tab: TabType) => {
    if (tab !== activeTab) {
      haptic.selection();
      onChangeTab(tab);
    }
  };

  const navItems = [
    { id: 'home' as TabType, label: t('home'), icon: Home },
    { id: 'search' as TabType, label: t('search'), icon: Search },
    { id: 'charts' as TabType, label: 'Чарты', icon: TrendingUp },
    { id: 'library' as TabType, label: t('library'), icon: Library },
  ];

  // ── STYLE 1: FLOATING DOCK (Dootify floating island) ──
  if (navStyle === 'floating') {
    return (
      <nav ref={navRef} className="md:hidden fixed bottom-3 left-3 right-3 max-w-sm mx-auto z-30 safe-bottom">
        <div className="glass-surface border border-white/15 rounded-3xl shadow-2xl px-2 py-1.5 flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'text-white bg-white/15 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <Icon
                  size={20}
                  style={{ color: isActive ? 'var(--accent-color, #1DB954)' : undefined }}
                />
                <span className={`text-xs mt-0.5 font-semibold tracking-tight ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ── STYLE 2: COMPACT ──
  if (navStyle === 'compact') {
    return (
      <nav ref={navRef} className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-surface border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-around h-12">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className="flex items-center justify-center flex-1 h-full transition-transform active:scale-90"
                title={item.label}
              >
                <Icon
                  size={21}
                  style={{ color: isActive ? 'var(--accent-color, #1DB954)' : undefined }}
                  className={!isActive ? 'text-zinc-400' : ''}
                />
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ── STYLE 3: DEFAULT (Classic) ──
  return (
    <nav ref={navRef} className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-surface border-t border-white/5 safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors duration-150 ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon
                size={22}
                style={{ color: isActive ? 'var(--accent-color, #1DB954)' : undefined }}
                className={!isActive ? 'text-zinc-400' : ''}
              />
              <span className={`text-[11px] mt-1 font-medium ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React, { useEffect, useState } from 'react';
import { X, Play, Bell, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { useTelegram } from '../../hooks/useTelegram';
import { apiClient } from '../../api/client';
import { Track } from '../../api/types';
import { useNavigationStore } from '../../store/navigationStore';
import { useUserStore } from '../../store/userStore';

interface NotificationItem {
  id: string;
  artist_name: string;
  artist_picture?: string;
  title: string;
  cover_url?: string;
  release_date: string;
  type: string;
  type_label: string;
  type_label_en: string;
  item_id: string;
}

export const NotificationsDrawer: React.FC = () => {
  const isOpen = useSettingsStore((state) => state.isNotificationsOpen);
  const setOpen = useSettingsStore((state) => state.setNotificationsOpen);
  const setUnreadCount = useSettingsStore((state) => state.setUnreadCount);
  const t = useSettingsStore((state) => state.t);
  const language = useSettingsStore((state) => state.language);

  const playTrack = usePlayerStore((state) => state.playTrack);
  const { haptic } = useTelegram();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const user = useUserStore(s => s.user);
  const following = useUserStore(s => s.followedArtists);

  useEffect(() => {
    let cancelled = false;
    async function fetchNotifications() {
      if (!user || user.telegram_id === 999999999) { setItems([]); setUnreadCount(0); return; }
      setLoading(true); setError(false);
      try {
        const res = await apiClient.get('/notifications');
        if (cancelled) return;
        const list = res.data?.notifications || [];
        setItems(list);
        const key = `spoty_seen_releases_${user.telegram_id}`;
        let seen: string[] = [];
        try { seen = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(seen)) seen = []; } catch { seen = []; }
        setUnreadCount(isOpen ? 0 : list.filter((item: NotificationItem) => !seen.includes(item.id)).length);
        if (isOpen) { try { localStorage.setItem(key, JSON.stringify(list.map((item: NotificationItem) => item.id).slice(0, 200))); } catch {} }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchNotifications();
    return () => { cancelled = true; };
  }, [setUnreadCount, isOpen, user?.telegram_id, following, retry]);

  if (!isOpen) return null;

  const handlePlayRelease = async (item: NotificationItem) => {
    haptic.impact('medium');
    try {
      useNavigationStore.getState().navigateTo({ type: 'album', albumId: item.item_id });
      setOpen(false);
    } catch (e) {
      console.error('Failed to play release track:', e);
    }
  };

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-[80vh] w-full max-w-lg mx-auto bg-[#1a1a1a] border-t border-white/10 rounded-t-3xl flex flex-col p-5 animate-slide-up text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-[#1DB954]" />
            <h2 className="text-lg font-bold">{t('whats_new')}</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-full text-zinc-400 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-3">
          <p className="text-xs text-zinc-400">Альбомы, EP и синглы ваших подписок за последние 90 дней.</p>
          {error && <button onClick={() => setRetry(v => v + 1)} className="min-h-11 text-amber-300 text-sm">Не удалось обновить новинки. Повторить</button>}
          {loading && <p role="status" className="text-sm text-zinc-400">Проверяем релизы…</p>}
          {!loading && items.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 space-y-2">
              <Sparkles size={36} className="mx-auto text-zinc-600 mb-2" />
              <p className="font-semibold text-sm">{t('no_notifications')}</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Подпишитесь на любимых артистов. Здесь появятся их свежие релизы.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const label = language === 'en' ? item.type_label_en : item.type_label;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#222222] border border-white/5 hover:bg-[#2a2a2a] transition group select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <img
                      src={item.cover_url || item.artist_picture || '/placeholder.png'}
                      alt={item.title}
                      className="w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] rounded-xl object-cover flex-shrink-0 bg-[#181818] shadow-md"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1DB954]/20 text-[#1DB954]">
                          {label}
                        </span>
                        {item.release_date && (
                          <span className="text-[11px] text-zinc-500 font-medium">
                            {item.release_date}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-white truncate leading-snug">
                        {item.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {item.artist_name}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePlayRelease(item)}
                    className="w-10 h-10 min-w-[40px] rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center flex-shrink-0 shadow-lg active:scale-95 transition"
                    title="Открыть релиз"
                    aria-label={`Открыть релиз: ${item.title}`}
                  >
                    <Play size={18} className="fill-black translate-x-0.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

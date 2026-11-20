import React, { useEffect, useState } from 'react';
import { X, Play, Bell, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';
import { useTelegram } from '../../hooks/useTelegram';
import { api, apiClient } from '../../api/client';
import { DialogSurface } from '../ui/DialogSurface';
import { useNavigationStore } from '../../store/navigationStore';
import { useUserStore } from '../../store/userStore';

interface NotificationItem {
  id: string;
  artist_id?: string;
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

  const setQueue = usePlayerStore((state) => state.setQueue);
  const { haptic } = useTelegram();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [playingRelease, setPlayingRelease] = useState<string>();
  const [playError, setPlayError] = useState<string>();
  const [openingArtist, setOpeningArtist] = useState<string>();
  const [artistError, setArtistError] = useState<string>();
  const user = useUserStore(s => s.user);
  const following = useUserStore(s => s.followedArtists);

  useEffect(() => {
    let cancelled = false;
    async function fetchNotifications() {
      if (cancelled || !user || user.telegram_id === 999999999) { setItems([]); setUnreadCount(0); return; }
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
        if (isOpen) { try { localStorage.setItem(key, JSON.stringify([...new Set([...list.map((item: NotificationItem) => item.id), ...seen])].slice(0, 500))); } catch {} }
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

  const openRelease = (id: string) => {
    useNavigationStore.getState().navigateTo({ type: 'album', albumId: id });
    setOpen(false);
  };
  const openReleaseArtist = async (item: NotificationItem) => {
    if (openingArtist) return;
    setArtistError(undefined);
    setOpeningArtist(item.id);
    try {
      let id = item.artist_id;
      if (!id) {
        const matches = following.filter(artist => artist.name === item.artist_name);
        if (matches.length === 1) id = matches[0].id;
      }
      if (!id) {
        const album = await api.getAlbum(item.item_id);
        id = album.artists?.find(artist => artist.name === item.artist_name)?.id
          || (album.artist_name === item.artist_name ? album.artist_id : undefined);
      }
      if (!id) throw new Error('Release artist unavailable');
      if (useSettingsStore.getState().isNotificationsOpen) {
        useNavigationStore.getState().openArtist(id, item.artist_name);
        setOpen(false);
      }
    } catch {
      setArtistError(item.id);
    } finally {
      setOpeningArtist(undefined);
    }
  };
  const playRelease = async (item: NotificationItem) => {
    if (playingRelease) return;
    haptic.impact('medium');
    setPlayError(undefined);
    setPlayingRelease(item.id);
    try {
      const album = await api.getAlbum(item.item_id);
      if (!album.tracks?.length) throw new Error('Release has no tracks');
      setQueue(album.tracks, 0);
    } catch {
      setPlayError(item.id);
    } finally {
      setPlayingRelease(undefined);
    }
  };

  const today = new Date();
  const todayKey = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const groups: { title: string; releases: NotificationItem[] }[] = [
    { title: 'За неделю', releases: [] },
    { title: 'За месяц', releases: [] },
    { title: 'Ранее', releases: [] },
  ];
  const seenReleases = new Set<string>();
  for (const release of [...items].sort((a, b) => b.release_date.localeCompare(a.release_date))) {
    const date = Date.parse(release.release_date);
    if (!Number.isFinite(date) || seenReleases.has(release.item_id)) continue;
    seenReleases.add(release.item_id);
    const days = Math.max(0, Math.floor((todayKey - date) / 86400000));
    groups[days < 7 ? 0 : days < 30 ? 1 : 2].releases.push(release);
  }

  return (
    <DialogSurface title={t('whats_new')} onClose={() => setOpen(false)}
      className="w-[min(92vw,760px)] rounded-3xl border border-white/10 bg-[#151719] p-0 text-white shadow-2xl">
      <div className="flex max-h-[min(80dvh,800px)] min-h-[min(55dvh,420px)] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-7 sm:py-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold"><Bell size={19} className="text-emerald-400" />{t('whats_new')}</h2>
            <p className="mt-1 text-sm text-zinc-400">Новые релизы исполнителей, на которых ты подписан.</p>
          </div>
          <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}
            className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/10"><X size={20} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-7">
          {error && <button onClick={() => setRetry(v => v + 1)} className="min-h-11 text-amber-300 text-sm">Не удалось обновить новинки. Повторить</button>}
          {loading && <p role="status" className="py-3 text-sm text-zinc-400">Проверяем релизы…</p>}
          {!error && !loading && seenReleases.size === 0 && (
            <div className="py-12 text-center text-zinc-400">
              <Sparkles size={28} className="mx-auto mb-3" />
              <p>{t('no_notifications')}</p>
            </div>
          )}
          {groups.filter(group => group.releases.length).map(group => (
            <section key={group.title} className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">{group.title}</h3>
              {group.releases.map(item => (
                <article key={item.id} className="flex items-center gap-3 border-t border-white/10 py-3 sm:gap-4">
                  <button type="button" onClick={() => openRelease(item.item_id)} aria-label={`Открыть релиз: ${item.title}`} className="shrink-0">
                    <img src={item.cover_url || item.artist_picture || '/placeholder.png'} alt="" loading="lazy"
                      className="size-14 rounded-lg object-cover sm:size-[72px]" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openRelease(item.item_id)} className="block max-w-full truncate text-left font-semibold hover:underline">{item.title}</button>
                    <button type="button" onClick={() => void openReleaseArtist(item)} disabled={Boolean(openingArtist)}
                      aria-label={`Открыть исполнителя: ${item.artist_name}`}
                      className="block max-w-full truncate text-left text-sm text-zinc-300 hover:text-white hover:underline">
                      {item.artist_name}
                    </button>
                    <p className="mt-1 text-xs text-zinc-400">
                      {language === 'en' ? item.type_label_en : item.type_label} ·{' '}
                      <time dateTime={item.release_date}>{new Intl.DateTimeFormat(language, {
                        day: 'numeric', month: 'long', timeZone: 'UTC',
                      }).format(new Date(item.release_date))}</time>
                    </p>
                    {playError === item.id && <p role="alert" className="mt-1 text-xs text-rose-300">Не удалось включить релиз.</p>}
                    {artistError === item.id && <p role="alert" className="mt-1 text-xs text-rose-300">Не удалось открыть исполнителя.</p>}
                  </div>
                  <button type="button" onClick={() => void playRelease(item)} disabled={Boolean(playingRelease)}
                    aria-label={`Воспроизвести: ${item.title}`}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-60">
                    <Play size={17} className="ml-0.5 fill-current" />
                  </button>
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </DialogSurface>
  );
};

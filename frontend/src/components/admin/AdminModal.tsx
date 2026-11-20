import React, { useEffect, useState } from 'react';
import {
  Shield,
  X,
  RefreshCw,
  Users,
  Activity,
  Headphones,
  Heart,
  ListMusic,
  HardDrive,
  UserCheck,
  Copy,
  Check,
} from 'lucide-react';
import { DialogSurface } from '../ui/DialogSurface';
import { api } from '../../api/client';
import { AdminStats, AdminUserItem } from '../../api/types';
import { useUserStore } from '../../store/userStore';
import { useTelegram } from '../../hooks/useTelegram';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const user = useUserStore((state) => state.user);
  return isOpen && user?.is_admin ? <AdminPanel key={user.telegram_id} userId={user.telegram_id} onClose={onClose} /> : null;
};

function AdminPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { haptic } = useTelegram();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'users'>('metrics');

  const [error, setError] = useState('');
  const request = React.useRef(0);
  const loadData = async () => {
    const current = ++request.current;
    setError('');
    setLoading(true);
    try {
      const [s, u] = await Promise.allSettled([
        api.getAdminStats(userId),
        api.getAdminUsers(userId, 20),
      ]);
      if (request.current !== current) return;
      if (s.status === 'fulfilled') setStats(s.value);
      if (u.status === 'fulfilled') setUsers(u.value);
      const missing = [s.status === 'rejected' && 'метрики', u.status === 'rejected' && 'список пользователей'].filter(Boolean);
      if (missing.length) setError('Не удалось обновить ' + missing.join(' и ') + '.');
    } finally {
      if (request.current === current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    return () => { request.current++; };
  }, [userId]);

  const term = query.trim().toLowerCase().replace(/^@/, '');
  const visibleUsers = users.filter(item => [item.first_name, item.username, String(item.telegram_id)]
    .some(value => value?.toLowerCase().includes(term)));

  const handleCopyReport = async () => {
    if (!stats) return;
    const text = [
      '🛡️ Отчёт Spoty Music',
      `🟢 Онлайн сейчас: ${stats.online_5m}`,
      `⚡ Активны за сегодня: ${stats.active_24h}`,
      `👥 Всего пользователей: ${stats.total_users} (+${stats.new_today} сегодня)`,
      `🎵 Всего прослушано: ${stats.total_plays} (+${stats.plays_today} сегодня)`,
      `❤️ Лайков: ${stats.total_favorites}`,
      `📁 Плейлистов: ${stats.total_playlists}`,
      `💾 Кэш на сервере: ${stats.cache_size_mb} MB (${stats.cache_files} файлов)`,
      `⏱️ ${stats.updated_at}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Не удалось скопировать отчёт. Проверьте разрешение на доступ к буферу обмена.');
      return;
    }
    haptic.notification('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DialogSurface title="Панель администратора" onClose={onClose} className="max-w-2xl rounded-2xl border border-white/10 bg-[#141414] p-0 text-white shadow-2xl">
      <div className="flex max-h-[inherit] flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 px-4 py-4 sm:px-6 sm:py-5 border-b border-white/10 bg-gradient-to-r from-emerald-950/60 to-[#171918]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-300">
              <Shield size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Панель администратора</h2>

              </div>
              <p className="text-xs text-zinc-400">
                Активность, медиатека и кэш
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                haptic.impact('light');
                loadData();
              }}
              disabled={loading}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition active:scale-95 disabled:opacity-50"
              title="Обновить"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-[#1DB954]' : ''} />
            </button>
            <button
              aria-label="Закрыть панель" onClick={() => {
                haptic.impact('light');
                onClose();
              }}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Live Status Pill */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30 text-xs font-semibold text-[#1DB954]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
              </span>
              <span>Онлайн · {stats?.online_5m ?? '—'}</span>
            </div>

            <div className="flex gap-1 text-xs bg-white/5 p-1 rounded-xl">
              <button
                aria-pressed={activeTab === 'metrics'} onClick={() => setActiveTab('metrics')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  activeTab === 'metrics'
                    ? 'bg-[#1DB954] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Метрики
              </button>
              <button
                aria-pressed={activeTab === 'users'} onClick={() => setActiveTab('users')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  activeTab === 'users'
                    ? 'bg-[#1DB954] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Пользователи ({users.length})
              </button>
            </div>
          </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-4 overscroll-contain">
          {error && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</p>}
          {loading && !stats && !users.length ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <RefreshCw size={32} className="animate-spin text-[#1DB954]" />
              <p className="text-xs">Загрузка данных сервера...</p>
            </div>
          ) : stats && activeTab === 'metrics' ? (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {/* 1. Total Registered */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-2 [&>svg]:shrink-0">
                    <span className="min-w-0 text-xs text-zinc-400 font-medium">Пользователи</span>
                    <Users size={16} className="text-blue-400" />
                  </div>
                  <div className="text-2xl tabular-nums font-bold text-white tracking-tight">
                    {stats.total_users}
                  </div>
                  <div className="text-[11px] text-[#1DB954] mt-1 font-medium">
                    +{stats.new_today} сегодня
                  </div>
                </div>

                {/* 2. Active 24h */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-2 [&>svg]:shrink-0">
                    <span className="min-w-0 text-xs text-zinc-400 font-medium">Активны за сутки</span>
                    <Activity size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl tabular-nums font-bold text-white tracking-tight">
                    {stats.active_24h}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    за 15 мин: {stats.online_15m}
                  </div>
                </div>

                {/* 3. Total Plays */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-2 [&>svg]:shrink-0">
                    <span className="min-w-0 text-xs text-zinc-400 font-medium">Прослушиваний</span>
                    <Headphones size={16} className="text-[#1DB954]" />
                  </div>
                  <div className="text-2xl tabular-nums font-bold text-white tracking-tight">
                    {stats.total_plays}
                  </div>
                  <div className="text-[11px] text-[#1DB954] mt-1 font-medium">
                    +{stats.plays_today} сегодня
                  </div>
                </div>

                {/* 4. Total Favorites */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-2 [&>svg]:shrink-0">
                    <span className="min-w-0 text-xs text-zinc-400 font-medium">В избранном</span>
                    <Heart size={16} className="text-rose-400" />
                  </div>
                  <div className="text-2xl tabular-nums font-bold text-white tracking-tight">
                    {stats.total_favorites}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    треков сохранено
                  </div>
                </div>

                {/* 5. Playlists */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-2 [&>svg]:shrink-0">
                    <span className="min-w-0 text-xs text-zinc-400 font-medium">Плейлистов</span>
                    <ListMusic size={16} className="text-purple-400" />
                  </div>
                  <div className="text-2xl tabular-nums font-bold text-white tracking-tight">
                    {stats.total_playlists}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    создано людьми
                  </div>
                </div>

                {/* 6. Disk Cache */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-start justify-between gap-2 mb-2 [&>svg]:shrink-0">
                    <span className="min-w-0 text-xs text-zinc-400 font-medium">Аудиокэш</span>
                    <HardDrive size={16} className="text-cyan-400" />
                  </div>
                  <div className="text-2xl tabular-nums font-bold text-white tracking-tight">
                    {stats.cache_size_mb.toFixed(1)}{' '}
                    <span className="text-xs text-zinc-400 font-normal">MB</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    Файлов: {stats.cache_files}{stats.cache_max_mb > 0 && <> · лимит {stats.cache_max_mb} МБ</>}
                  </div>
                </div>
              </div>

              {/* Bot Info Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#222] border border-white/5 text-xs text-zinc-400 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Команды в Telegram-чате:</span>
                  <span className="text-[11px] font-mono text-zinc-500">/admin, /stats</span>
                </div>
                <p>
                  Вы можете проверять статистику прямо в Telegram без входа в приложение: отправьте боту команду <code className="text-[#1DB954] font-mono">/admin</code> и нажимайте кнопку обновления в чате.
                </p>
              </div>
            </>
          ) : activeTab === 'users' ? (
            /* Users Tab */
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-400 mb-1 px-1">
                Последние регистрации
              </div>

              <input type="search" aria-label="Найти в списке пользователей" value={query}
                onChange={event => setQuery(event.target.value)} placeholder="Имя, @username или ID"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white" />
              {visibleUsers.length === 0 && (users.length > 0 || !error) && <p className="p-3 text-sm text-zinc-400">{term ? 'Совпадений нет.' : 'Пока нет пользователей.'}</p>}
              {visibleUsers.map((u) => (
                <div
                  key={u.telegram_id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#1c1c1c] border border-white/5 hover:bg-[#252525] transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      {u.photo_url ? (
                        <img
                          src={u.photo_url}
                          alt={u.first_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-300">
                          {u.first_name?.[0] || 'U'}
                        </div>
                      )}
                      {u.is_online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#1DB954] border-2 border-[#1c1c1c] rounded-full" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{u.first_name}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {u.username} • ID: {u.telegram_id}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end pl-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        u.is_online
                          ? 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {u.is_online ? 'В сети' : 'Офлайн'}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1">
                      {u.created_at ? u.created_at.split(' ')[0] : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-[#181818]/60 flex items-center justify-between gap-3">
          <button
            disabled={!stats} onClick={handleCopyReport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition active:scale-95"
          >
            {copied ? (
              <>
                <Check size={16} className="text-[#1DB954]" />
                <span>Скопировано!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Скопировать отчёт</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              haptic.impact('light');
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition active:scale-95"
          >
            Закрыть
          </button>
        </div>
      </div>
    </DialogSurface>
  );
}

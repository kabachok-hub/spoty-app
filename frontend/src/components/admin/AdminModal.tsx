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
  const { haptic } = useTelegram();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'users'>('metrics');

  const loadData = async () => {
    if (!user?.telegram_id) return;
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.getAdminStats(user.telegram_id),
        api.getAdminUsers(user.telegram_id, 20),
      ]);
      setStats(s);
      setUsers(u);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (!stats) return;
    haptic.notification('success');
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

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-[#141414] border border-[#282828] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#181818]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Shield size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Панель администратора</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  ROOT
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Мониторинг пользователей и активности бота
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
              onClick={() => {
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
        {stats && (
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30 text-xs font-semibold text-[#1DB954]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
              </span>
              <span>{stats.online_5m} {stats.online_5m === 1 ? 'человек' : 'человек'} сейчас в боте</span>
            </div>

            <div className="flex gap-1 text-xs bg-white/5 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  activeTab === 'metrics'
                    ? 'bg-[#1DB954] text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Метрики
              </button>
              <button
                onClick={() => setActiveTab('users')}
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
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-4 no-scrollbar">
          {loading && !stats ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <RefreshCw size={32} className="animate-spin text-[#1DB954]" />
              <p className="text-xs">Загрузка данных сервера...</p>
            </div>
          ) : stats && activeTab === 'metrics' ? (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Total Registered */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400 font-medium">Всего подписано</span>
                    <Users size={16} className="text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {stats.total_users}
                  </div>
                  <div className="text-[11px] text-[#1DB954] mt-1 font-medium">
                    +{stats.new_today} сегодня
                  </div>
                </div>

                {/* 2. Active 24h */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400 font-medium">Активны за сутки</span>
                    <Activity size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {stats.active_24h}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    за 15 мин: {stats.online_15m}
                  </div>
                </div>

                {/* 3. Total Plays */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400 font-medium">Прослушиваний</span>
                    <Headphones size={16} className="text-[#1DB954]" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {stats.total_plays}
                  </div>
                  <div className="text-[11px] text-[#1DB954] mt-1 font-medium">
                    +{stats.plays_today} сегодня
                  </div>
                </div>

                {/* 4. Total Favorites */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400 font-medium">В избранном</span>
                    <Heart size={16} className="text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {stats.total_favorites}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    треков сохранено
                  </div>
                </div>

                {/* 5. Playlists */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400 font-medium">Плейлистов</span>
                    <ListMusic size={16} className="text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {stats.total_playlists}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    создано людьми
                  </div>
                </div>

                {/* 6. Disk Cache */}
                <div className="p-3.5 rounded-xl bg-[#1c1c1c] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400 font-medium">Кэш MP3 файлов</span>
                    <HardDrive size={16} className="text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {stats.cache_size_mb.toFixed(1)}{' '}
                    <span className="text-xs text-zinc-400 font-normal">MB</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                    {stats.cache_files} треков / 1000 MB
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
          ) : stats && activeTab === 'users' ? (
            /* Users Tab */
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-400 mb-1 px-1">
                Последние зарегистрированные пользователи:
              </div>

              {users.map((u) => (
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
                          {u.first_name[0] || 'U'}
                        </div>
                      )}
                      {u.is_online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#1DB954] border-2 border-[#1c1c1c] rounded-full" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                        <span>{u.first_name}</span>
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
            onClick={handleCopyReport}
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
    </div>
  );
};

import React, { useState } from 'react';
import { X, Check, Plus, FolderPlus, Sparkles, Music2, Loader2 } from 'lucide-react';
import { Track } from '../../api/types';
import { useUserStore } from '../../store/userStore';
import { useTelegram } from '../../hooks/useTelegram';

interface BatchAddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  sourceTitle?: string;
}

export const BatchAddToPlaylistModal: React.FC<BatchAddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  tracks,
  sourceTitle,
}) => {
  const playlists = useUserStore((state) => state.playlists);
  const addBatchTracksToPlaylist = useUserStore((state) => state.addBatchTracksToPlaylist);
  const getOrCreateHugePlaylist = useUserStore((state) => state.getOrCreateHugePlaylist);
  const createPlaylist = useUserStore((state) => state.createPlaylist);
  const { haptic } = useTelegram();

  const [savingPlaylistId, setSavingPlaylistId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  if (!isOpen || tracks.length === 0) return null;

  const handleAddToHugePlaylist = async () => {
    haptic.impact('medium');
    setSavingPlaylistId('huge');
    try {
      const hugePl = await getOrCreateHugePlaylist();
      const added = await addBatchTracksToPlaylist(hugePl.id, tracks);
      haptic.notification('success');
      setSuccessMsg(`Добавлено ${added} треков в «Огромный плейлист»!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to add to huge playlist:', err);
      haptic.notification('error');
    } finally {
      setSavingPlaylistId(null);
    }
  };

  const handleAddToPlaylist = async (playlistId: string, title: string) => {
    haptic.impact('light');
    setSavingPlaylistId(playlistId);
    try {
      const added = await addBatchTracksToPlaylist(playlistId, tracks);
      haptic.notification('success');
      setSuccessMsg(`Добавлено ${added} треков в «${title}»!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to add to playlist:', err);
      haptic.notification('error');
    } finally {
      setSavingPlaylistId(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    haptic.impact('medium');
    setSavingPlaylistId('new');
    try {
      const newPl = await createPlaylist(newTitle.trim());
      const added = await addBatchTracksToPlaylist(newPl.id, tracks);
      haptic.notification('success');
      setSuccessMsg(`Создан плейлист «${newPl.title}» и добавлено ${added} треков!`);
      setShowNewInput(false);
      setNewTitle('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to create and add:', err);
      haptic.notification('error');
    } finally {
      setSavingPlaylistId(null);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-base font-bold text-white truncate">
              Добавить все в плейлист
            </h2>
            <p className="text-xs text-zinc-400 truncate">
              {sourceTitle ? `${tracks.length} треков из «${sourceTitle}»` : `${tracks.length} треков`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="bg-[#1DB954]/20 border-b border-[#1DB954]/30 px-4 py-3 flex items-center gap-2 text-xs font-semibold text-[#1DB954] animate-fade-in">
            <Check size={16} className="flex-shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto no-scrollbar flex-1">
          {/* Featured One-Click Button: Огромный плейлист */}
          <button
            onClick={handleAddToHugePlaylist}
            disabled={savingPlaylistId !== null}
            className="w-full group p-3.5 rounded-xl bg-gradient-to-r from-[#1DB954]/20 to-[#1DB954]/5 border border-[#1DB954]/40 hover:border-[#1DB954] active:scale-[0.98] transition flex items-center gap-3.5 text-left"
          >
            <div className="w-11 h-11 rounded-lg bg-[#1DB954] flex items-center justify-center text-black flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
              {savingPlaylistId === 'huge' ? (
                <Loader2 size={22} className="animate-spin text-black" />
              ) : (
                <Sparkles size={22} className="fill-black" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white group-hover:text-[#1DB954] transition flex items-center gap-1.5">
                <span>Огромный плейлист</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#1DB954]/20 text-[#1DB954] rounded font-mono font-extrabold uppercase">
                  Основной
                </span>
              </div>
              <div className="text-xs text-zinc-400 truncate">
                Добавить все {tracks.length} треков в единый сборник
              </div>
            </div>
          </button>

          {/* Existing User Playlists */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 pb-1">
              Ваши плейлисты
            </div>

            {playlists.length === 0 ? (
              <div className="text-xs text-zinc-500 py-3 text-center">
                У вас пока нет созданных плейлистов
              </div>
            ) : (
              playlists
                .filter((p) => p.title.trim().toLowerCase() !== 'огромный плейлист')
                .map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id, pl.title)}
                    disabled={savingPlaylistId !== null}
                    className="w-full p-2.5 rounded-lg hover:bg-white/10 active:bg-white/15 transition flex items-center justify-between text-left gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        {pl.cover_url ? (
                          <img
                            src={pl.cover_url}
                            alt={pl.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music2 size={16} className="text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">
                          {pl.title}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {pl.track_count || 0} треков
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-zinc-400">
                      {savingPlaylistId === pl.id ? (
                        <Loader2 size={16} className="animate-spin text-[#1DB954]" />
                      ) : (
                        <Plus size={18} />
                      )}
                    </div>
                  </button>
                ))
            )}
          </div>

          {/* New Playlist Form */}
          {showNewInput ? (
            <form onSubmit={handleCreateAndAdd} className="space-y-2 pt-2 border-t border-white/5">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Название нового плейлиста..."
                autoFocus
                className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newTitle.trim() || savingPlaylistId === 'new'}
                  className="flex-1 py-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {savingPlaylistId === 'new' && <Loader2 size={14} className="animate-spin" />}
                  <span>Создать и добавить</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewInput(false)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowNewInput(true)}
              className="w-full py-2.5 px-3 border border-dashed border-white/20 hover:border-white/40 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition flex items-center justify-center gap-2"
            >
              <FolderPlus size={16} className="text-[#1DB954]" />
              <span>Создать новый плейлист</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

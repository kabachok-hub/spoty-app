import { useSettingsStore } from '../store/settingsStore';
import React, { useState } from 'react';
import { Plus, Heart, Music } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { SyncModal } from '../components/auth/SyncModal';
import { Modal } from '../components/ui/Modal';
import { useTelegram } from '../hooks/useTelegram';
import { ArtistCard } from '../components/cards/ArtistCard';
import { TrackRow } from '../components/cards/TrackRow';
import { DislikeButton } from '../components/player/DislikeButton';

interface LibraryPageProps {
  onSelectPlaylist: (playlistId: string) => void;
  onSelectLikedSongs: () => void;
  onSelectArtist: (artistId: string) => void;
}

type LibraryTab = 'playlists' | 'artists' | 'hidden';

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onSelectPlaylist,
  onSelectLikedSongs,
  onSelectArtist,
}) => {
  const [syncOpen, setSyncOpen] = useState(false);
  const user = useUserStore(state => state.user);
  const isSignedIn = !!user && user.telegram_id !== 999999999;
  const playlists = useUserStore((state) => state.playlists);
  const favorites = useUserStore((state) => state.favorites);
  const dislikes = useUserStore(s => s.dislikes);
  const followedArtists = useUserStore((state) => state.followedArtists);
  const createPlaylist = useUserStore((state) => state.createPlaylist);
  const { haptic } = useTelegram();
  const t = useSettingsStore(state => state.t);

  const [activeTab, setActiveTab] = useState<LibraryTab>('playlists');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSaveError('');
    setIsSubmitting(true);
    try {
      const pl = await createPlaylist(newTitle.trim(), newDescription.trim() || undefined);
      haptic.notification('success');
      setIsModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      onSelectPlaylist(pl.id);
    } catch (err) {
      setSaveError('Не удалось создать плейлист. Проверьте вход в аккаунт и попробуйте ещё раз.');
      console.error('Failed to create playlist:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-36 md:pb-28 select-none animate-fade-in">
      {/* Header with Title and Create Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Медиатека</h1>
        <button
          onClick={() => {
            haptic.impact('light');
            if (isSignedIn) setIsModalOpen(true); else setSyncOpen(true);
          }}
          className="min-h-11 flex items-center px-3 rounded-full bg-white/10 text-white transition"
          aria-label="Создать плейлист"
        >
          <Plus size={20} /><span className="text-sm font-semibold ml-1">Создать плейлист</span>
        </button>
      </div>

      {/* Mini Stats */}
      <div className="hidden sm:grid grid-cols-3 gap-2">
        {[
          { value: favorites.length, label: 'Лайков', icon: '❤️' },
          { value: playlists.length, label: 'Плейлистов', icon: '🎵' },
          { value: followedArtists.length, label: 'Артистов', icon: '⭐' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <div className="text-lg mb-0.5">{stat.icon}</div>
            <div className="text-xl font-extrabold text-white">{stat.value}</div>
            <div className="text-[10px] text-zinc-400 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab('playlists');
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
            activeTab === 'playlists'
              ? 'bg-white text-black font-bold'
              : 'bg-[#242424] text-zinc-300 hover:bg-[#2e2e2e]'
          }`}
        >{t('playlists')}</button>
        <button
          onClick={() => {
            haptic.selection();
            setActiveTab('artists');
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
            activeTab === 'artists'
              ? 'bg-white text-black font-bold'
              : 'bg-[#242424] text-zinc-300 hover:bg-[#2e2e2e]'
          }`}
        >
          {t('artists')} ({followedArtists.length})
        </button>
      </div>

      <button onClick={() => setActiveTab(activeTab === 'hidden' ? 'playlists' : 'hidden')}
        className={`min-h-11 px-4 rounded-full text-sm transition ${activeTab === 'hidden' ? 'bg-white text-black' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}>
        Скрытые ({dislikes.length})
      </button>

      {activeTab === 'hidden' && <section className="space-y-3">
        <h2 className="text-lg font-bold">Не предлагать в рекомендациях</h2>
        <p className="text-sm text-zinc-400">Эти записи не попадают в ваши миксы и радио. Их можно слушать вручную или вернуть в рекомендации.</p>
        {dislikes.length === 0 ? <p className="text-zinc-500 py-8 text-center">Скрытых треков пока нет</p> : dislikes.map(track =>
          <div key={track.id} className="rounded-xl bg-white/5 p-2">
            <TrackRow track={track} showIndex={false} />
            <DislikeButton track={track} label />
          </div>)}
      </section>}

      {/* Playlists View */}
      {activeTab === 'playlists' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Prominent Liked Songs Tile */}
          <div
            onClick={() => {
              haptic.impact('light');
              onSelectLikedSongs();
            }}
            className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition cursor-pointer select-none"
          >
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 flex items-center justify-center shadow-lg flex-shrink-0">
              <Heart size={28} className="text-white fill-white" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white truncate">{t('liked_songs')}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Плейлист · Треков: {favorites.length}
              </p>
            </div>
          </div>

          {/* User Created Playlists */}
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => {
                haptic.impact('light');
                onSelectPlaylist(pl.id);
              }}
              className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/5 active:bg-white/10 transition cursor-pointer select-none"
            >
              <div className="w-16 h-16 rounded-lg bg-[#242424] flex items-center justify-center overflow-hidden flex-shrink-0 shadow">
                {pl.cover_url ? (
                  <img
                    src={pl.cover_url}
                    alt={pl.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music size={28} className="text-zinc-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-white truncate">{pl.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Плейлист · Треков: {pl.track_count || 0}
                </p>
              </div>
            </div>
          ))}

          {playlists.length === 0 && (
            <div className="py-12 text-center text-zinc-500">
              <Music size={36} className="mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-sm">Создайте первый плейлист</p>
              <p className="text-xs mt-1">Нажмите «Создать плейлист», чтобы собрать любимую музыку</p>
            </div>
          )}
        </div>
      )}

      {/* Followed Artists View */}
      {activeTab === 'artists' && (
        <div>
          {followedArtists.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <p className="font-semibold text-sm">Здесь появятся ваши исполнители</p>
              <p className="text-xs mt-1">Найдите исполнителя в поиске и нажмите «Подписаться»</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {followedArtists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  onClick={onSelectArtist}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SyncModal isOpen={syncOpen} onClose={() => setSyncOpen(false)} />
      {/* Create Playlist Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Название плейлиста"
      >
        <form onSubmit={handleCreatePlaylist} className="space-y-4">
          {saveError && <p role="alert" className="text-sm text-amber-300">{saveError}</p>}
          <div>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('playlist_name_placeholder')}
              className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
            />
          </div>
          <div>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t('description_placeholder')}
              rows={2}
              className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954] resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || isSubmitting}
              className="px-6 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-bold text-sm transition"
            >
              {t('create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

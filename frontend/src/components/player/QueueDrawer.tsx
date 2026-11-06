import React from 'react';
import { X, Trash2, Play, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useTelegram } from '../../hooks/useTelegram';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const activeMix = usePlayerStore((state) => state.activeMix);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const { haptic } = useTelegram();

  if (!isOpen) return null;

  const upcomingTracks = queue.slice(queueIndex + 1);

  return (
    <div
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Очередь воспроизведения"
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-[75vh] w-full bg-[#1e1e1e] border-t border-white/10 rounded-t-3xl flex flex-col p-5 animate-slide-up text-white"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold">Очередь</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть очередь"
            className="p-1 rounded-full text-zinc-400 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        {/* Queue List Content */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-6">
          {/* Now Playing */}
          {currentTrack && (
            <div>
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Сейчас играет
              </div>
              <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/5">
                <img
                  src={currentTrack.cover_url || '/placeholder.png'}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-[#1DB954] truncate">
                    {currentTrack.title}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    {currentTrack.artist_name}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Mix Banner */}
          {activeMix && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/25">
              <Sparkles size={16} className="text-[#1DB954] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#1DB954]">
                  Активный микс
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {activeMix.title}
                </div>
              </div>
              {activeMix.nextMix && (
                <div className="text-[11px] text-zinc-400 max-w-[130px] truncate text-right">
                  Далее: <span className="text-zinc-200">{activeMix.nextMix.title}</span>
                </div>
              )}
            </div>
          )}

          {/* Up Next */}
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Далее ({upcomingTracks.length})
            </div>

            {upcomingTracks.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6 text-center">
                Очередь пуста. Добавьте песню через «Играть следующей».
              </div>
            ) : (
              <div className="space-y-1">
                {upcomingTracks.map((track, idx) => {
                  const absoluteIndex = queueIndex + 1 + idx;
                  return (
                    <div
                      key={`${track.id}-${absoluteIndex}`}
                      className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition"
                    >
                      <div
                        onClick={() => {
                          haptic.impact('light');
                          setQueue(queue, absoluteIndex, activeMix);
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <img
                          src={track.cover_url || '/placeholder.png'}
                          alt={track.title}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-zinc-200 truncate group-hover:text-white">
                            {track.title}
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            {track.artist_name}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          haptic.notification('warning');
                          removeFromQueue(absoluteIndex);
                        }}
                        className="p-2 text-zinc-500 hover:text-red-400 transition"
                        title="Убрать из очереди"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

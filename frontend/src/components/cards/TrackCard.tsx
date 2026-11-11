import { ArtistNames } from '../player/ArtistNames';
import React from 'react';
import { Play, Pause } from 'lucide-react';
import { Track } from '../../api/types';
import { usePlayerStore } from '../../store/playerStore';
import { useTelegram } from '../../hooks/useTelegram';

interface TrackCardProps {
  track: Track;
  queueContext?: Track[];
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, queueContext }) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playTrack = usePlayerStore((state) => state.playTrack);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { haptic } = useTelegram();

  const isCurrent = currentTrack?.id === track.id;

  const handleClick = () => {
    haptic.impact('light');
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, queueContext);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative flex flex-col p-3 rounded-xl bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer select-none"
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-[#242424] shadow-lg">
        <img
          src={track.cover_url || '/placeholder.png'}
          alt={track.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Floating Green Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className={`absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#1DB954] hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center transition-all duration-200 ${
            isCurrent
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
          }`}
        >
          {isCurrent && isPlaying ? (
            <Pause size={20} className="text-black fill-black" />
          ) : (
            <Play size={20} className="text-black fill-black translate-x-0.5" />
          )}
        </button>
      </div>

      <div
        className={`font-semibold text-sm truncate mb-0.5 ${
          isCurrent ? 'text-[#1DB954]' : 'text-white'
        }`}
      >
        {track.title}
      </div>
      <div className="text-xs text-zinc-400 truncate"><ArtistNames track={track} /></div>
    </div>
  );
};

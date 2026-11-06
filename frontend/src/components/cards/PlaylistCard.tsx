import React from 'react';
import { Music } from 'lucide-react';
import { Playlist } from '../../api/types';
import { useTelegram } from '../../hooks/useTelegram';

interface PlaylistCardProps {
  playlist: Playlist;
  onClick: (playlistId: string) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({ playlist, onClick }) => {
  const { haptic } = useTelegram();

  return (
    <div
      onClick={() => {
        haptic.impact('light');
        onClick(playlist.id);
      }}
      className="group relative flex flex-col p-3 rounded-xl bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer select-none"
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-lg flex items-center justify-center">
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            alt={playlist.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <Music size={40} className="text-zinc-600" />
        )}
      </div>

      <div className="font-semibold text-sm truncate text-white mb-0.5">{playlist.title}</div>
      <div className="text-xs text-zinc-400 truncate">
        {playlist.creator_name || (playlist.track_count !== undefined ? `${playlist.track_count} songs` : 'Playlist')}
      </div>
    </div>
  );
};

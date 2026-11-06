import React from 'react';
import { Artist } from '../../api/types';
import { useTelegram } from '../../hooks/useTelegram';

interface ArtistCardProps {
  artist: Artist;
  onClick: (artistId: string) => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onClick }) => {
  const { haptic } = useTelegram();

  return (
    <div
      onClick={() => {
        haptic.impact('light');
        onClick(artist.id);
      }}
      className="group relative flex flex-col p-3 rounded-xl bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer select-none"
    >
      <div className="relative aspect-square w-full rounded-full overflow-hidden mb-3 bg-[#242424] shadow-lg">
        <img
          src={artist.picture_url || '/placeholder.png'}
          alt={artist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div className="font-semibold text-sm truncate text-white mb-0.5">{artist.name}</div>
      <div className="text-xs text-zinc-400 capitalize">Исполнитель</div>
    </div>
  );
};

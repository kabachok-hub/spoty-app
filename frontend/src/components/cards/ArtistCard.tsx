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
    <button type="button"
      onClick={() => {
        haptic.impact('light');
        onClick(artist.id);
      }}
      className="group relative min-w-0 w-full text-left flex flex-col p-3 rounded-2xl border border-white/[0.07] bg-[#191b1c] hover:border-white/20 hover:bg-[#232627] transition-colors duration-200 cursor-pointer select-none"
    >
      <div className="relative aspect-square w-full rounded-full overflow-hidden mb-3 bg-[#242424] shadow-lg">
        <img
          src={artist.picture_url || '/placeholder.png'}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div className="font-semibold text-sm truncate text-white mb-0.5">{artist.name}</div>
      <div className="text-xs text-zinc-400 capitalize">Исполнитель</div>
    </button>
  );
};

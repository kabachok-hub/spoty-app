import React, { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';

export interface MixItem {
  id: string;
  title: string;
  title_en?: string;
  banner_text?: string;
  banner_color?: string;
  subtitle: string;
  subtitle_en?: string;
  cover_url?: string;
  query?: string;
  type?: string;
  is_liked_songs?: boolean;
}

interface MixCardProps {
  mix: MixItem;
  onClick: (mix: MixItem) => void;
  onPlay?: (mix: MixItem) => void;
}

export const MixCard: React.FC<MixCardProps> = ({ mix, onClick, onPlay }) => {
  const { haptic } = useTelegram();
  const language = useSettingsStore((state) => state.language);
  const activeContextUri = usePlayerStore((state) => state.activeContextUri);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [isLoading, setIsLoading] = useState(false);

  const isCurrentMix = activeContextUri === mix.id;
  const isThisPlaying = isCurrentMix && isPlaying;

  const displayTitle = language === 'en' && mix.title_en ? mix.title_en : mix.title;
  const displaySubtitle = language === 'en' && mix.subtitle_en ? mix.subtitle_en : mix.subtitle;

  const bannerColor = mix.banner_color || '#1DB954';

  const handleClick = () => {
    haptic.impact('light');
    onClick(mix);
  };

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.impact('medium');

    if (isCurrentMix) {
      togglePlay();
      return;
    }

    if (onPlay) {
      setIsLoading(true);
      try {
        await onPlay(mix);
      } finally {
        setIsLoading(false);
      }
    } else {
      onClick(mix);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative flex flex-col p-2.5 rounded-xl bg-white/[0.025] hover:bg-white/[0.08] active:bg-[#303030] transition-all duration-200 cursor-pointer select-none"
    >
      {/* Artwork with Spotify Mix colored badge */}
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#202020] shadow-md">
        {mix.cover_url ? (
          <img
            src={mix.cover_url}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-3 text-center">
            <span className="text-sm font-bold text-zinc-300 line-clamp-2">{displayTitle}</span>
          </div>
        )}

        {/* Top left Spotify badge */}
        <div className="absolute top-2 left-2 w-3.5 h-3.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-[#1DB954]" />
        </div>

        {/* Bottom Banner Badge (Spotify Mix Style) */}
        {mix.banner_text && (
          <div
            className="absolute bottom-2 left-0 right-0 px-2 py-1 text-black font-extrabold text-xs tracking-tight truncate shadow-md"
            style={{ backgroundColor: bannerColor }}
          >
            {mix.banner_text}
          </div>
        )}

        {/* Floating Green Play Button with instant feedback */}
        <button
          onClick={handlePlayClick}
          disabled={isLoading}
          className={`absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 active:scale-95 text-black shadow-xl flex items-center justify-center transition-all duration-200 z-10 ${
            isThisPlaying ? 'opacity-100 sm:opacity-100 scale-100' : 'opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
          aria-label={isThisPlaying ? "Pause Mix" : "Play Mix"}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : isThisPlaying ? (
            <Pause size={18} className="fill-black" />
          ) : (
            <Play size={20} className="fill-black translate-x-0.5" />
          )}
        </button>
      </div>

      <h3 className="text-sm font-bold text-white truncate mb-1">{displayTitle}</h3>
      {/* Subtitle / Artist list */}
      <p className="text-xs text-zinc-400 line-clamp-2 leading-snug font-normal mt-0.5">
        {displaySubtitle}
      </p>
    </div>
  );
};

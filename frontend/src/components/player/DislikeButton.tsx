import React, { useState } from 'react';
import { ThumbsDown, Undo2 } from 'lucide-react';
import { Track } from '../../api/types';
import { useUserStore } from '../../store/userStore';

export const DislikeButton: React.FC<{ track: Track; label?: boolean; iconSize?: number }> = ({ track, label = false, iconSize = 17 }) => {
  const hidden = useUserStore(s => s.isDisliked(track));
  const toggle = useUserStore(s => s.toggleDislike);
  const [pending, setPending] = useState(false);
  const text = hidden ? 'Вернуть в рекомендации' : 'Не предлагать в миксах';
  return <button type="button" disabled={pending} aria-label={text} title={text} aria-pressed={hidden}
    onClick={async e => { e.stopPropagation(); setPending(true); try { await toggle(track); } finally { setPending(false); } }}
    className={label ? 'w-full min-h-11 flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left text-sm disabled:opacity-50'
      : `min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-50 ${hidden ? 'text-amber-300' : 'text-zinc-400 hover:text-white'}`}>
    {hidden ? <Undo2 size={iconSize} /> : <ThumbsDown size={iconSize} />}{label && <span>{pending ? 'Сохраняем…' : text}</span>}
  </button>;
};

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, ListPlus, Link, Download, RefreshCw } from 'lucide-react';
import type { Track } from '../../api/types';
import { api } from '../../api/client';
import { refreshRecording } from '../../hooks/refreshRecording';
import { BatchAddToPlaylistModal } from '../modals/BatchAddToPlaylistModal';

export function TrackActionsMenu({ track }: { track: Track }) {
  const [position, setPosition] = useState<{ left: number; bottom: number }>();
  const [playlist, setPlaylist] = useState(false), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useEffect(() => { setPosition(undefined); setPlaylist(false); setNotice(''); }, [track.id]);
  useEffect(() => {
    if (!position) return;
    const outside = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setPosition(undefined); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPosition(undefined); button.current?.focus(); } };
    const close = () => setPosition(undefined);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); window.addEventListener('resize', close);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', close); };
  }, [position]);
  const item = 'w-full min-h-11 flex items-center gap-3 px-4 text-left text-sm hover:bg-white/10 rounded-lg disabled:opacity-50';
  return <>
    <button ref={button} aria-label="Действия с треком" aria-expanded={!!position} aria-haspopup="menu" title="Действия с треком" className="p-1 xl:p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10" onClick={e => {
      e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setNotice('');
      setPosition(position ? undefined : { left: Math.max(8, Math.min(innerWidth - 248, rect.right - 240)), bottom: innerHeight - rect.top + 8 });
    }}><MoreHorizontal size={18} /></button>
    {position && createPortal(<div ref={menu} role="menu" aria-label="Действия с треком" style={{ position: 'fixed', ...position, width: 240, maxHeight: '70dvh', zIndex: 150 }} className="overflow-y-auto rounded-2xl border border-white/10 bg-[#202125] p-1.5 shadow-2xl text-white" onClick={e => e.stopPropagation()}>
      <button role="menuitem" className={item} onClick={() => { setPosition(undefined); setPlaylist(true); }}><ListPlus size={17} />В плейлист</button>
      <button role="menuitem" className={item} onClick={async () => { try { const site = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin; await navigator.clipboard.writeText(`${site}/?trackId=${encodeURIComponent(track.id)}`); setNotice('Ссылка скопирована'); } catch { setNotice('Не удалось скопировать ссылку'); } }}><Link size={17} />Скопировать ссылку</button>
      <button role="menuitem" className={item} onClick={() => { api.downloadTrack(track); setPosition(undefined); }}><Download size={17} />Скачать MP3</button>
      <button role="menuitem" className={item} disabled={busy} onClick={async () => { setBusy(true); try { await refreshRecording(track); setNotice('Аудио обновлено'); } catch { setNotice('Не удалось обновить аудио'); } finally { setBusy(false); } }}><RefreshCw size={17} className={busy ? 'animate-spin' : ''} />{busy ? 'Обновляем…' : 'Не тот трек? Обновить'}</button>
      {notice && <p role="status" className="px-4 py-2 text-xs text-zinc-300">{notice}</p>}
    </div>, document.body)}
    <BatchAddToPlaylistModal isOpen={playlist} onClose={() => setPlaylist(false)} tracks={[track]} sourceTitle={track.title} />
  </>;
}

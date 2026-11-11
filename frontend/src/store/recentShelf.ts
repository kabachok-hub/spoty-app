import { create } from 'zustand';
import type { Track, RecentContextItem } from '../api/types';
import type { MixItem } from '../components/cards/MixCard';

export type ShelfEntry = { key: string; at: number; mix?: MixItem; track?: Track };
const namespace = 'spoty:recent-shelf:v1:';
export const mixKey = (mix: Pick<MixItem, 'id' | 'query'>) => `${mix.id}|${mix.query || ''}`;
const save = (owner: string, entries: ShelfEntry[], hidden: string[], resetAt: number, activeMixKey: string) => {
  try { localStorage.setItem(namespace + owner, JSON.stringify({ entries, hidden, resetAt, activeMixKey })); } catch { /* Storage may be full. */ }
};
const cleanMix = (m: MixItem): MixItem => ({ id: m.id, title: m.title, title_en: m.title_en,
  query: m.query, type: m.type, subtitle: m.subtitle || '', cover_url: m.cover_url,
  banner_color: m.banner_color, banner_text: m.banner_text });
export const useRecentShelf = create<{
  owner: string; entries: ShelfEntry[]; hidden: string[]; resetAt: number; activeMixKey: string;
  switchOwner: (owner: string) => void;
  selectMix: (owner: string, mix: MixItem) => void;
  finishMix: (owner: string) => void;
  addMix: (owner: string, mix: MixItem, at?: number) => void;
  addTrack: (owner: string, track: Track, at?: number) => void;
  hydrate: (owner: string, rows: RecentContextItem[]) => void;
  showAllMixes: () => void;
}>((set, get) => {
  const put = (owner: string, entry: ShelfEntry, hiddenKey?: string) => {
    if (!owner || get().owner !== owner) return;
    const old = get().entries.find(e => e.key === entry.key);
    if (old && old.at > entry.at) return;
    const entries = [entry, ...get().entries.filter(e => e.key !== entry.key)].sort((a,b) => b.at-a.at).slice(0,30);
    const hidden = hiddenKey && entry.at > get().resetAt ? [...new Set([...get().hidden, hiddenKey])].slice(-100) : get().hidden;
    const retained = hidden.filter(key => entries.some(e => e.mix && mixKey(e.mix) === key));
    set({ entries, hidden: retained }); save(owner, entries, retained, get().resetAt, get().activeMixKey);
  };
  return {
    owner: '', entries: [], hidden: [], resetAt: 0, activeMixKey: '',
    switchOwner(owner) {
      if (owner === get().owner) return;
      let entries: ShelfEntry[] = [], hidden: string[] = [], resetAt = 0, activeMixKey = '';
      try {
        const data = JSON.parse(localStorage.getItem(namespace + owner) || '{}');
        if (owner && Array.isArray(data.entries)) entries = data.entries.filter((e: ShelfEntry) => e && typeof e.key === 'string' && Number.isFinite(e.at) && (e.mix?.id || e.track?.id)).slice(0,30);
        if (owner && typeof data.activeMixKey === 'string') activeMixKey = data.activeMixKey;
        if (owner && Number.isFinite(data.resetAt)) resetAt = data.resetAt;
        if (owner && Array.isArray(data.hidden)) hidden = data.hidden.filter((x: unknown) => typeof x === 'string').slice(-100);
      } catch { /* Invalid cache is discarded. */ }
      hidden = hidden.filter(key => entries.some(e => e.mix && mixKey(e.mix) === key));
      set({ owner, entries, hidden, resetAt, activeMixKey });
    },
    selectMix(owner, mix) {
      if (!owner || owner !== get().owner || !mix.query || ['album','playlist','artist','liked_songs'].includes(mix.type || '')) return;
      set({ activeMixKey: mixKey(mix) });
      const old = get().entries.find(e => e.mix?.id === mix.id)?.mix;
      const defined = Object.fromEntries(Object.entries(mix).filter(([,v]) => v !== undefined && v !== ''));
      get().addMix(owner, { ...old, ...defined, id: mix.id, title: mix.title, query: mix.query, subtitle: mix.subtitle || old?.subtitle || '' });
    },
    finishMix(owner) {
      if (owner !== get().owner) return;
      set({ activeMixKey: '' });
      save(owner, get().entries, get().hidden, get().resetAt, '');
    },
    addMix(owner, mix, at=Date.now()) {
      if (!mix.query || ['album','playlist','artist','liked_songs'].includes(mix.type || '')) return;
      put(owner, { key: 'mix:'+mix.id, at, mix: cleanMix(mix) }, mixKey(mix));
    },
    addTrack(owner, track, at=Date.now()) {
      const { id, title, artist_name, artist_id, cover_url, duration } = track;
      put(owner, { key: 'track:'+id, at, track: { id, title, artist_name, artist_id, cover_url, duration } });
    },
    hydrate(owner, rows) {
      if (owner !== get().owner) return;
      for (const row of [...rows].reverse()) {
        const at = row.last_played_at ? Date.parse(row.last_played_at + (/Z$|[+-]\d\d:\d\d$/.test(row.last_played_at) ? '' : 'Z')) : 0;
        if (!Number.isFinite(at)) continue;
        if ((row.context_type || row.type) === 'track') get().addTrack(owner, {
          id: row.id.replace(/^track:/,''), title: row.title, artist_name: row.subtitle || '', artist_id: '',
          cover_url: row.cover_url || '', duration: Number(row.query) || 0,
        }, at);
        else get().addMix(owner, { ...row, subtitle: row.subtitle || '' }, at);
      }
    },
    showAllMixes() { const resetAt = Date.now(); set({ hidden: [], resetAt }); save(get().owner, get().entries, [], resetAt, get().activeMixKey); },
  };
});

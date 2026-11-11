import React, { useEffect, useRef, useState } from 'react';
import { Artist } from '../../api/types';
import { api, apiClient } from '../../api/client';
import { useUserStore } from '../../store/userStore';
import { parseArtistNames } from './artistImport';
import { expandArtistFrontier } from './artistFrontier';

export const openTasteSetup = () => window.dispatchEvent(new Event('spoty:taste-setup'));
const merge = (a: Artist[], b: Artist[]) => Array.from(new Map([...a, ...b].map(x => [x.id, x])).values()).slice(-80);

export const TasteSetup: React.FC = () => {
  const user = useUserStore(s => s.user);
  const followed = useUserStore(s => s.followedArtistIds);
  const followedArtists = useUserStore(s => s.followedArtists);
  const toggleFollow = useUserStore(s => s.toggleFollowArtist);
  const profileLoading = useUserStore(s => s.isLoading);
  const favorites = useUserStore(s => s.favorites);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [pool, setPool] = useState<Artist[]>([]), [chosen, setChosen] = useState<Artist[]>([]);
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanding, setExpanding] = useState<string[]>([]);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const [query, setQuery] = useState(''), [text, setText] = useState(''), [notice, setNotice] = useState('');
  const [relatedTo, setRelatedTo] = useState('');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(false);
  const generation = useRef(0), input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const frontier = useRef<Artist[]>([]);
  const selectedRef = useRef<Artist[]>([]);
  const loadedUser = useRef<number | null>(null);
  useEffect(() => { frontier.current = pool; }, [pool]);
  useEffect(() => { selectedRef.current = chosen; }, [chosen]);
  const remember = () => {
    if (user) { try { localStorage.setItem(`spoty_taste_setup_seen_v1_${user.telegram_id}`, 'seen'); } catch {} }
  };
  useEffect(() => {
    const show = () => { if (user && user.telegram_id !== 999999999) { setOpen(true); setNotice(''); remember(); } };
    window.addEventListener('spoty:taste-setup', show);
    return () => window.removeEventListener('spoty:taste-setup', show);
  }, [user?.telegram_id]);
  useEffect(() => { if (open) { if(searchOpen) input.current?.focus(); else dialog.current?.focus(); } }, [open, searchOpen]);
  useEffect(() => {
    if (!user || user.telegram_id === 999999999 || profileLoading || followed.size || favorites.length) return;
    const key = `spoty_taste_setup_seen_v1_${user.telegram_id}`;
    try { if (localStorage.getItem(key)) return; } catch {}
    let cancelled = false;
    // Do not treat an empty/loading/failed collection response as a new listener.
    Promise.all([api.getMyFollowing(), api.getMyHistory()]).then(([following, history]) => {
      if (cancelled || following.length || history.length) return;
      try { localStorage.setItem(key, 'seen'); } catch {}
      setOpen(true);
    }).catch(() => {});
    return () => { cancelled=true; };
  }, [user?.telegram_id, profileLoading, followed.size, favorites.length]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importing) { remember(); setOpen(false); setExpanding([]); generation.current++; }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary') || []).filter(el => el.offsetParent !== null);
      const first=nodes[0],last=nodes[nodes.length-1];
      if (e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();}
      else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[open,importing]);
  useEffect(() => {
    if (!open || !user || loadedUser.current === user.telegram_id) return;
    loadedUser.current = user.telegram_id;
    let cancelled=false;
    (async () => {
      setInitialLoading(true);
      try {
        const saved = useUserStore.getState().followedArtists.slice(0,6);
        const initial = saved.length ? saved : (await api.getCharts()).artists;
        let candidates = initial;
        if (saved.length) {
          const seeds = saved.slice(0, 3);
          const batches = await Promise.allSettled(seeds.map(seed => apiClient.get<Artist[]>(`/artists/${encodeURIComponent(seed.id)}/related`)));
          for (let i = 0; i < seeds.length; i++) {
            const batch = batches[i];
            if (batch.status === 'fulfilled') candidates = expandArtistFrontier(candidates, seeds[i], batch.value.data, initial);
          }
        }
        if (!cancelled) setPool(v => v.length ? v : candidates);
      } catch { if (!cancelled) { loadedUser.current=null; setNotice('Не удалось загрузить рекомендации. Найдите первого артиста через «Поиск».'); } }
      finally { if (!cancelled) setInitialLoading(false); }
    })();
    return()=>{cancelled=true;setInitialLoading(false);if(!frontier.current.length)loadedUser.current=null;};
  },[open,user?.telegram_id]);
  useEffect(() => {
    if (!open || !query.trim() || importPreview) { setSearchResults([]); setBusy(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const found = (await apiClient.get('/search', { params: { q: query.trim(), type: 'artist', limit: 18 } })).data.artists;
        if (!cancelled) setSearchResults(found || []);
      } catch { if (!cancelled) setNotice('Не удалось загрузить артистов. Попробуйте поиск ещё раз.'); }
      finally { if (!cancelled) setBusy(false); }
    }, query ? 350 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query, importPreview]);
  const select = async (artist: Artist, expandOnly = false) => {
    if (importing) return;
    const alreadyChosen = chosen.some(a => a.id === artist.id);
    if (alreadyChosen && !expandOnly) { const next=chosen.filter(a => a.id !== artist.id);selectedRef.current=next;setChosen(next); return; }
    if (!alreadyChosen && chosen.length >= 30) { setNotice('За один раз можно добавить до 30 артистов.'); return; }
    const selection = alreadyChosen ? chosen : [...chosen, artist];
    selectedRef.current=selection;
    setChosen(selection);
    setRelatedTo(artist.name);
    setQuery(''); setSearchOpen(false); setImportPreview(false); setSearchResults([]);
    setPool(v => expandArtistFrontier(v, artist, [], selection));
    const request = generation.current;
    setExpanding(v => [...v, artist.id]);
    try {
      const candidates=(await apiClient.get<Artist[]>(`/artists/${encodeURIComponent(artist.id)}/related`, { params: { exclude: frontier.current.map(a=>a.id).slice(0,120).join(',') } })).data;
      if (request !== generation.current || !selectedRef.current.some(a => a.id===artist.id)) return;
      const previous = new Set(frontier.current.map(a => a.id));
      setRelatedTo(artist.name);
      setFreshIds(candidates.filter(a => !previous.has(a.id)).map(a => a.id));
      setPool(v => expandArtistFrontier(v, artist, candidates!, selectedRef.current));
      setNotice(candidates.length ? '' : `Новых похожих для ${artist.name} пока нет. Попробуйте раскрыть одного из уже предложенных артистов.`);
    } catch { if(request===generation.current) setNotice('Не удалось загрузить похожих артистов. Выбор сохранён — попробуйте другого исполнителя.'); }
    finally { if(request===generation.current) setExpanding(v => v.filter(id => id!==artist.id)); }
  };
  const previewImport = async () => {
    let names: string[];
    try { names = parseArtistNames(text); } catch (e) { setNotice((e as Error).message); return; }
    setImporting(true); setImportPreview(true); setNotice('Ищем точные совпадения. Подписки пока не меняются.');
    const candidates: Artist[] = [], missing: string[] = [];
    for (const name of names) {
      if (user?.telegram_id !== useUserStore.getState().user?.telegram_id) return;
      try {
        const res = await apiClient.get('/search', { params: { q: name, type: 'artist', limit: 5 } });
        const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/ё/g,'е').trim();
        const found = (res.data.artists || []).find((a: Artist) => norm(a.name) === norm(name));
        if (found) candidates.push(found); else missing.push(name);
      } catch { missing.push(name); }
    }
    if (user?.telegram_id !== useUserStore.getState().user?.telegram_id) return;
    setPool(merge([], candidates)); setQuery(''); setImporting(false); setRelatedTo('');
    setNotice(`Найдено ${candidates.length} из ${names.length}. Выберите нужных артистов в сетке.${missing.length ? ' Не найдены: '+missing.slice(0,8).join(', ') : ''}`);
  };
  const save = async () => {
    setImporting(true); const failed: Artist[] = [];
    for (let i=0;i<chosen.length;i++) {
      if (user?.telegram_id !== useUserStore.getState().user?.telegram_id) return;
      setNotice(`Сохраняем ${i+1} из ${chosen.length}…`);
      if (!useUserStore.getState().followedArtistIds.has(chosen[i].id) && !await toggleFollow(chosen[i])) failed.push(chosen[i]);
    }
    setImporting(false); setChosen(failed);
    window.dispatchEvent(new Event('spoty:taste-updated'));
    if (failed.length) setNotice('Часть подписок не сохранилась. Повторите для оставшихся артистов.');
    else { remember(); setNotice('Подписки сохранены. Новые миксы учтут ваш выбор.'); setOpen(false); }
  };
  if (!open) return null;
  const searching = Boolean(query.trim()) && !importPreview;
  const candidates = searching ? searchResults : pool;
  // Pin every existing subscription, preserving the related frontier order below.
  // Search/import keep their own result scope rather than adding unrelated follows.
  const displayed = !searching && !importPreview
    ? Array.from(new Map([...followedArtists, ...candidates].map(a => [a.id, a])).values())
    : [...candidates].sort((a, b) => Number(followed.has(b.id)) - Number(followed.has(a.id)));
  const close = () => { remember(); setOpen(false); setExpanding([]); generation.current++; };
  return <div className="fixed inset-0 z-[110] bg-black/85 p-2 sm:p-5 flex items-center justify-center">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="taste-title" className="h-[90dvh] max-h-[900px] flex flex-col w-full max-w-3xl rounded-3xl bg-[#171717] border border-white/10 text-white overflow-hidden shadow-2xl outline-none">
      <header className="flex-shrink-0 p-4 sm:p-6 pb-2 border-b border-white/5">
        <div className="flex justify-between gap-3 items-center"><h2 id="taste-title" className="font-bold text-lg sm:text-2xl">Выберите любимых исполнителей</h2><button disabled={importing} onClick={close} className="min-h-11 px-2 text-zinc-400 text-xs" aria-label="Закрыть выбор артистов">Позже</button></div>
        <p className="text-sm text-zinc-400 mt-1">Нажмите на артиста — рядом появятся похожие. Продолжайте выбирать то, что нравится.</p>
        <div className="mt-3 flex items-center gap-2">
          {searchOpen ? <><input ref={input} value={query} disabled={importing} onChange={e => {setImportPreview(false);setBusy(Boolean(e.target.value.trim()));setQuery(e.target.value);}} placeholder="Имя исполнителя" className="min-h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-sm"/><button onClick={()=>{setQuery('');setSearchOpen(false);}} className="min-h-11 px-2 text-xs text-zinc-300">К подборке</button></> : <button onClick={()=>setSearchOpen(true)} className="min-h-11 rounded-full px-4 text-xs bg-white/10 text-zinc-200">Найти конкретного артиста</button>}
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {relatedTo && !query && <p className="text-xs text-emerald-400 mb-3" role="status">{expanding.length ? 'Подбираем похожих…' : `По вашему выбору: ${relatedTo}`}</p>}
        {relatedTo && !query && <button disabled={Boolean(expanding.length) || importing} className="min-h-11 mb-2 rounded-full px-4 bg-white/10 text-xs text-emerald-300" onClick={()=>{const seed=chosen.find(a=>a.name===relatedTo);if(seed)void select(seed,true);}}>Ещё похожие</button>}
        {notice && <p role="status" className="text-sm text-amber-200 my-3">{notice}</p>}
        {(busy || initialLoading) && <p role="status" className="text-sm text-zinc-400">Загружаем артистов…</p>}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-3 gap-y-5 my-2">{displayed.map(a => {
          const selected=chosen.some(x=>x.id===a.id);
          return <button key={a.id} aria-label={a.name} disabled={importing} onClick={() => select(a)} aria-pressed={selected} className="min-w-0 rounded-2xl text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
            <div className={`relative aspect-square rounded-full p-1 transition ${selected?'ring-2 ring-emerald-400 bg-emerald-400/15':freshIds.includes(a.id)?'ring-1 ring-emerald-500/40 animate-fade-in':''}`}>
              <img src={a.picture_url || '/icon.svg'} alt="" className="rounded-full aspect-square object-cover w-full"/>
              {selected && <span className="absolute right-0 bottom-0 bg-[#1DB954] rounded-full w-6 h-6 flex items-center justify-center text-black font-bold" aria-hidden="true">✓</span>}
            </div>
            <span className="block text-xs mt-2 min-h-8 leading-4 break-words line-clamp-2">{a.name}</span>
            {followed.has(a.id)&&<span className="text-[10px] text-zinc-500">В подписках</span>}
          </button>;
        })}</div>
        {!busy && !initialLoading && !displayed.length && <p className="text-sm text-zinc-400 my-6">{query?'Никого не нашли. Попробуйте другое имя.':'Выберите первого исполнителя через поиск — дальше будем предлагать похожих.'}</p>}
        <details className="mt-6 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs text-zinc-400">Есть готовый список артистов? Перенести</summary><p className="text-xs text-zinc-400 my-2">Имена по одному в строке или файл TXT/CSV/JSON (до 50). Сначала найдём совпадения, затем вы выберете подписки.</p><textarea disabled={importing} value={text} onChange={e=>setText(e.target.value)} aria-label="Список артистов" className="w-full h-24 bg-black/30 rounded-lg p-2 text-sm"/><input type="file" accept=".txt,.csv,.json" disabled={importing} aria-label="Файл со списком артистов" className="text-xs max-w-full" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>200000){setNotice('Максимум 200 КБ.');return;}setText(await f.text());}}/><button disabled={importing||!text.trim()} onClick={previewImport} className="block mt-2 min-h-11 text-xs text-emerald-400">Найти артистов из списка</button></details>
        {importPreview && pool.length>0 && <button disabled={importing} onClick={()=>setChosen(v=>merge(v,pool.filter(a=>!followed.has(a.id))).slice(0,30))} className="min-h-11 text-emerald-400 text-sm">Выбрать найденных (до 30)</button>}
      </div>
      <footer className="flex-shrink-0 border-t border-white/10 bg-[#202020] p-3 sm:p-4">
        {chosen.length>0 && <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">{chosen.map(a=><button disabled={importing} key={a.id} onClick={()=>setChosen(v=>v.filter(x=>x.id!==a.id))} className="min-h-9 shrink-0 rounded-full px-3 bg-white/10 text-xs">{a.name} ×</button>)}</div>}
        <button onClick={save} disabled={importing||!chosen.length} className="min-h-11 w-full rounded-full bg-[#1DB954] disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-semibold">{importing?'Сохраняем…':`Готово · выбрано ${chosen.length}`}</button>
        <p className="text-[10px] text-zinc-500 text-center mt-2">Подписки добавятся после «Готово». Вернуться можно в настройках.</p>
      </footer>
    </section>
  </div>;
};

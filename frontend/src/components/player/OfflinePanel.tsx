import { useOfflineStore } from '../../store/offlineStore';
import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../api/types';
export function OfflineDownloadButton({ tracks }: { tracks: Track[] }) {
  const busy = useOfflineStore(s => s.busy);
  return <button className="px-4 py-2 rounded-full border border-white/15 bg-white/5 text-sm disabled:opacity-40" disabled={busy || !tracks.length} onClick={() => void useOfflineStore.getState().download(tracks).catch(() => useOfflineStore.setState({ error: 'Не удалось сохранить песни' }))}>Скачать офлайн {tracks.length > 1 ? `(${tracks.length})` : ''}</button>;
}
export function OfflinePanel() {
  const state = useOfflineStore(), active = usePlayerStore(s => s.currentTrack?.id);
  const tracks = state.tracks.map(row => row.track), used = state.tracks.reduce((sum,row) => sum + row.bytes,0) / 1048576;
  return <section className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4" aria-label="Офлайн-музыка">
    <div className="flex flex-wrap gap-3 items-center justify-between"><h2 className="font-bold">Офлайн-музыка · {tracks.length}</h2><button disabled={!tracks.length} className="px-4 py-2 rounded-full bg-green-500 text-black disabled:opacity-30" onClick={() => usePlayerStore.getState().playTrack(tracks[0], tracks, 'offline', null)}>Слушать всё</button></div>
    <label className="flex flex-wrap items-center gap-3 text-sm"><span>Занято {used.toFixed(1)} МБ · лимит</span><select aria-label="Лимит офлайн-хранилища" className="rounded-lg bg-zinc-800 p-2" value={state.limitMB} disabled={state.busy} onChange={e => void state.setLimit(Number(e.target.value)).catch(() => useOfflineStore.setState({ error: 'Не удалось изменить лимит' }))}>{[128,512,1024,2048].map(value => <option key={value} value={value}>{value} МБ</option>)}</select></label>
    {state.error && <p role="alert" className="text-sm text-amber-300">{state.error}</p>}
    {!tracks.length && <p className="text-sm text-zinc-400">Сохрани песни или целый плейлист кнопкой скачивания. Они будут доступны на этом устройстве без интернета.</p>}
    <div className="max-h-72 overflow-y-auto space-y-2">{state.tracks.map(row => <div key={row.track.id} className="flex items-center gap-3 text-sm"><button className="min-w-0 flex-1 text-left rounded-lg p-2 hover:bg-white/5" onClick={() => usePlayerStore.getState().playTrack(row.track, tracks, 'offline', null)}><span className="block truncate font-semibold">{row.track.title}</span><span className="block truncate text-xs text-zinc-400">{row.track.artist_name} · {(row.bytes/1048576).toFixed(1)} МБ</span></button><button className="p-2 text-zinc-400 disabled:opacity-30" aria-label={`Удалить офлайн ${row.track.title}`} disabled={state.busy || active === row.track.id} onClick={() => void state.remove(row.track.id)}>Удалить</button></div>)}</div>
    <button className="text-xs text-zinc-400 underline disabled:opacity-40" disabled={state.busy} onClick={() => void state.cleanOld()}>Удалить не слушанные более 30 дней</button>
  </section>;
}
export function OfflineTransfer() {
  const state = useOfflineStore();
  if (!state.busy && !state.error) return null;
  return <div className="fixed right-3 top-[calc(var(--client-header-height,80px)+8px)] z-[70] w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-white/15 bg-zinc-900 p-4 shadow-xl text-sm" role="status">
    {state.busy ? <><p>Сохраняем офлайн: {state.done} из {state.total}</p><progress aria-label="Скачивание музыки" className="w-full accent-green-500" max={100} value={state.progress}/><button className="mt-2 text-xs text-zinc-400 underline" onClick={state.cancel}>Отменить</button></> : <><p>{state.error}</p><button className="mt-2 text-xs text-zinc-400 underline" onClick={() => useOfflineStore.setState({ error: null })}>Закрыть</button></>}
  </div>;
}

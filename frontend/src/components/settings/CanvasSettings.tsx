import React, { useEffect, useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { usePlayerStore } from '../../store/playerStore';
import { useCanvasStore, readCanvas, inspectCanvas, saveCanvas, deleteCanvas } from '../../store/trackCanvas';

export function CanvasSettings() {
  const owner = useUserStore(s => s.user?.telegram_id), track = usePlayerStore(s => s.currentTrack);
  const enabled = useCanvasStore(s => s.enabled), setEnabled = useCanvasStore(s => s.setEnabled), revision = useCanvasStore(s => s.revision);
  const [exists, setExists] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false; setExists(false); setNotice('');
    if (owner && owner !== 999999999 && track) void readCanvas(String(owner), track.id).then(clip => { if (!cancelled) setExists(!!clip); }).catch(() => { if (!cancelled) setNotice('Хранилище Canvas недоступно.'); });
    return () => { cancelled = true; };
  }, [owner, track?.id, revision]);
  const upload = async (file?: File) => {
    if (!file || !owner || !track || busy) return;
    const id = track.id, user = owner;
    setBusy(true); setNotice('Проверяем видео…');
    try {
      const duration = await inspectCanvas(file);
      if (useUserStore.getState().user?.telegram_id !== user || usePlayerStore.getState().currentTrack?.id !== id) return;
      await saveCanvas(String(user), id, file, duration);
      setNotice('Canvas сохранён для этого трека.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось сохранить Canvas.'); }
    finally { setBusy(false); }
  };
  return <section className="spoty-setting-section" data-testid="canvas-settings">
    <h3>Canvas — видео вместо обложки</h3>
    <label className="spoty-setting-row"><span>Показывать Canvas<small>Короткие видеозаставки в плеере. В экономном режиме остаётся обложка.</small></span><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} aria-label="Показывать Canvas" /></label>
    <p>Оригинальный Canvas появится автоматически, когда доступен для этой записи. Если видео не найдено, останется обложка. Свой ролик имеет приоритет.</p>
    <p>Можно добавить свой MP4 или WebM на 3–8 секунд, до 8 МБ. Он сохраняется на этом устройстве; музыка продолжает играть отдельно.</p>
    {track && owner && owner !== 999999999 ? <>
      <p className="font-semibold text-white">{track.artist_name} — {track.title}</p>
      <label className={`inline-flex min-h-11 items-center px-4 rounded-full bg-white/10 cursor-pointer ${busy ? 'opacity-50' : ''}`}>
        {busy ? 'Сохраняем…' : exists ? 'Заменить видео' : 'Добавить видео к этому треку'}
        <input type="file" accept="video/mp4,video/webm" disabled={busy} aria-label="Видео Canvas" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} />
      </label>
      {exists && <button disabled={busy} className="ml-2 min-h-11 px-4 text-zinc-400" onClick={async () => { setBusy(true); try { await deleteCanvas(String(owner), track.id); setNotice('Canvas удалён.'); } catch { setNotice('Не удалось удалить Canvas.'); } finally { setBusy(false); } }}>Удалить Canvas</button>}
    </> : <p>Войдите и включите трек, чтобы добавить к нему видео.</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}

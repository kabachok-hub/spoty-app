import { useEffect, useState, type ChangeEvent } from 'react';
import { FileUp } from 'lucide-react';
import { api, apiClient } from '../../api/client';
import { importSpotifyLibrary, parseSpotifyLibrary, type SpotifyLibrary } from '../../services/spotifyImport';
import { useUserStore } from '../../store/userStore';
import { isNativeClient, nativeCall } from '../../platform/nativeBridge';
import { readSpotifyExport, SpotifyExportError } from '../../services/spotifyExportFiles';

export function SpotifyImport() {
  const owner = useUserStore(state => state.user?.telegram_id);
  const [library, setLibrary] = useState<SpotifyLibrary>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof importSpotifyLibrary>>>();
  const [enabled, setEnabled] = useState(false);
  const [authorization, setAuthorization] = useState<{ id: string; authorize_url: string }>();
  const [unavailable, setUnavailable] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    apiClient.get('/spotify-import/config', { signal: controller.signal })
      .then(response => setEnabled(response.data?.enabled === true))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!authorization || !owner) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 900_000;
    const poll = async () => {
      try {
        if (Date.now() >= deadline) throw new Error('Expired authorization');
        const { data } = await apiClient.get(`/spotify-import/status/${encodeURIComponent(authorization.id)}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (data.status === 'error') {
          setError(data.message || 'Spotify не подтвердил вход.');
        } else if (data.status === 'ready') {
          const imported = parseSpotifyLibrary([data.library]);
          setUnavailable(Array.isArray(data.library?.unavailable) ? data.library.unavailable : []);
          setLibrary(imported);
          setAuthorization(undefined);
          void begin(imported);
          return;
        } else {
          setProgress(data.status === 'reading' ? 'Читаем медиатеку Spotify…' : 'Подтверди вход в открывшемся браузере.');
          timer = setTimeout(() => void poll(), 2000);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setError('Подключение к Spotify прервалось. Попробуй ещё раз.');
      }
      setAuthorization(undefined);
      setProgress('');
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [authorization, owner]);
  if (!owner || owner === 999999999) return null;
  const currentOwner = () => useUserStore.getState().user?.telegram_id;

  const connect = async () => {
    const native = isNativeClient();
    const popup = native ? null : window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setLibrary(undefined);
    setResult(undefined);
    setUnavailable([]);
    setError('');
    setBusy(true);
    try {
      const { data } = await apiClient.post('/spotify-import/start');
      const url = new URL(data.authorize_url);
      if (url.origin !== 'https://accounts.spotify.com' || url.pathname !== '/authorize') throw new Error('Invalid Spotify link');
      if (native) await nativeCall('openExternal', { url: url.href });
      else if (popup) popup.location.href = url.href;
      setAuthorization({ id: data.id, authorize_url: url.href });
    } catch {
      popup?.close();
      setError('Не удалось открыть вход в Spotify. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const selectFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    setLibrary(undefined);
    setResult(undefined);
    setUnavailable([]);
    setError('');
    if (!files.length) return;
    setBusy(true);
    try {
      const preview = parseSpotifyLibrary(await readSpotifyExport(files));
      if (!Object.values(preview).some(list => list.length)) {
        setError('В выбранных файлах нет музыкальных подписок, треков или плейлистов.');
        return;
      }
      setLibrary(preview);
    } catch (cause) {
      setError(cause instanceof SpotifyExportError ? cause.message : 'Не удалось прочитать архив или JSON-файлы Spotify.');
    } finally {
      setBusy(false);
    }
  };

  const begin = async (selected: SpotifyLibrary) => {
    if (busy || currentOwner() !== owner) return;
    setError('');
    setResult(undefined);
    setBusy(true);
    setProgress('Проверяем библиотеку…');
    try {
      const imported = await importSpotifyLibrary(selected, owner, currentOwner, name => setProgress(`Обрабатываем «${name}»…`));
      setResult(imported);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Импорт прерван. Попробуй ещё раз.');
    } finally {
      if (currentOwner() === owner) {
        const state = useUserStore.getState();
        void Promise.allSettled([state.refreshPlaylists(), state.refreshFavorites(), api.getMyFollowing().then(artists => {
          if (currentOwner() === owner) useUserStore.setState({ followedArtists: artists, followedArtistIds: new Set(artists.map(artist => artist.id)) });
        })]);
      }
      setProgress('');
      setBusy(false);
    }
  };

  return <section className="spoty-setting-section">
    <h3>Импорт из Spotify</h3>
    {enabled && <button type="button" className="spoty-setting-action" disabled={busy || Boolean(authorization)}
      onClick={() => void connect()}>Войти в Spotify и импортировать</button>}
    {authorization && <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <a href={authorization.authorize_url} target="_blank" rel="noreferrer" className="text-emerald-300 underline">Открыть вход в Spotify</a>
      <button type="button" onClick={() => { setAuthorization(undefined); setProgress(''); }}>Отмена</button>
    </div>}
    <p>Выбери ZIP «Данные аккаунта» или JSON-файлы медиатеки Spotify.</p>
    <label className="spoty-setting-row">
      <FileUp size={18} />
      <span className="min-w-0 flex-1">Файлы Spotify<input type="file" accept=".zip,.json,application/zip,application/json" multiple disabled={busy || Boolean(authorization)}
        aria-label="Файлы Spotify" onChange={event => void selectFiles(event)} className="mt-2 block max-w-full text-xs" /></span>
    </label>
    {library && <div className="mt-3 space-y-2 text-sm">
      <p>Артисты: {library.artists.length} · Треки: {library.tracks.length} · Плейлисты: {library.playlists.length} · Альбомы: {library.albums.length}</p>
      {library.albums.length > 0 && <p>Сохранённые альбомы появятся как плейлисты.</p>}
      <button type="button" className="spoty-setting-action" disabled={busy} onClick={() => void begin(library)}>
        {result ? 'Повторить импорт' : 'Перенести в медиатеку'}
      </button>
    </div>}
    {progress && <p role="status" className="mt-3 break-words">{progress}</p>}
    {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
    {unavailable.length > 0 && <p className="mt-2 text-sm">Spotify ограничил доступ к плейлистам: {unavailable.join(', ')}.</p>}
    {result && <div role="status" className="mt-3 space-y-2 text-sm">
      <p>В медиатеке: {result.artists} артистов, {result.tracks} треков, {result.playlists} плейлистов, {result.albums} альбомов.</p>
      {result.failures.length > 0 && <details>
        <summary>Пропущено: {result.failures.length}</summary>
        <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-4">
          {result.failures.map((label, index) => <li key={index} className="break-words">{label}</li>)}
        </ul>
      </details>}
    </div>}
  </section>;
}

import { useSettingsStore } from '../../store/settingsStore';
import { isNativeAndroid } from '../../platform/nativeBridge';
export function SoundOptions() {
  const enabled = useSettingsStore(s => s.normalizeAudio), set = useSettingsStore(s => s.setNormalizeAudio);
  const telegram = !isNativeAndroid() && !!(window as any).Telegram?.WebApp?.initData;
  const crossfade = useSettingsStore(s => s.crossfadeSeconds), setCrossfade = useSettingsStore(s => s.setCrossfadeSeconds);
  return <div className="space-y-5">
    <label className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <span><strong className="text-sm">Выравнивание громкости</strong><span className="block text-xs text-zinc-400 mt-2">Сглаживает разницу громкости между песнями, сохраняя динамику. Для новых записей измерение появится после загрузки.</span></span>
      <input type="checkbox" className="mt-1 accent-green-500" aria-label="Выравнивание громкости" checked={enabled} onChange={e => set(e.target.checked)} />
    </label>
    <div className="space-y-3"><h3 className="text-sm font-bold">Кроссфейд — {crossfade ? `${crossfade} сек` : 'выключен'}</h3>
      <div className="grid grid-cols-5 gap-2">{[0,3,5,8,12].map(value => <button key={value} disabled={telegram && value !== 0} aria-pressed={crossfade === value} onClick={() => setCrossfade(value)} className={`rounded-xl py-3 text-sm border ${crossfade === value ? 'border-green-500 bg-green-500/15' : 'border-white/10 bg-white/5'} disabled:opacity-40`}>{value ? `${value}с` : 'Выкл'}</button>)}</div>
      <p className="text-xs text-zinc-400">{telegram ? 'В Telegram сохраняется стандартное фоновое воспроизведение. Сведение доступно на сайте и в приложениях.' : 'Плавно накладывает конец песни на начало следующей, когда она подготовлена. При повторе одной песни и случайном порядке без подготовленного трека используется обычный переход.'}</p>
    </div>
  </div>;
}

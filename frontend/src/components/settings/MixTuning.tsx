import { useMixTuning } from '../../store/mixTuning';
export function MixTuning() {
  const state = useMixTuning();
  return <section className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4" aria-label="Характер миксов">
    <h3 className="font-bold">Характер миксов</h3>
    {([{ field: 'novelty', title: 'Новые песни', left: 'Знакомое', right: 'Новое' }, { field: 'diversity', title: 'Разнообразие исполнителей', left: 'Ближе к исполнителю', right: 'Больше похожих артистов' }] as const).map(item => <label key={item.field} className="block space-y-2 text-sm">
      <span className="flex justify-between">{item.title}<span>{state[item.field]}%</span></span>
      <input className="w-full accent-green-500" type="range" min="0" max="100" step="10" aria-label={item.title} value={state[item.field]} onChange={e => state.set(item.field, Number(e.target.value))} />
      <span className="flex justify-between gap-3 text-xs text-zinc-400"><span>{item.left}</span><span>{item.right}</span></span>
    </label>)}
    <p className="text-xs text-zinc-400">Применяется при следующей загрузке микса. Доля новых песен зависит от доступных подходящих треков.</p>
  </section>;
}

import { setVisualMode, useVisualMode, VisualMode } from '../../platform/visualPerformance';

export function PerformanceSettings() {
  const mode = useVisualMode();
  const choices: { id: VisualMode; title: string; description: string }[] = [
    { id: 'economy', title: 'Экономный', description: 'Видео как изображение, лёгкие анимации, без размытия.' },
    { id: 'balanced', title: 'Сбалансированный', description: 'Живые фоны, умеренное размытие и ограниченная нагрузка.' },
    { id: 'quality', title: 'Максимальное качество', description: 'Полное разрешение эффектов и выбранное размытие.' },
  ];
  return <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4 space-y-3">
    <div><h3 className="text-sm font-semibold">Нагрузка на систему</h3><p className="text-xs text-zinc-400 mt-1">Только для этого устройства. Музыка играет одинаково во всех режимах.</p></div>
    <div className="grid sm:grid-cols-3 gap-2">{choices.map(choice => <button key={choice.id} aria-pressed={mode === choice.id}
      onClick={() => setVisualMode(choice.id)} className={`min-h-24 p-3 rounded-xl border text-left transition-colors ${mode === choice.id ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/10 bg-black/10 hover:bg-white/5'}`}>
      <strong className="block text-xs text-zinc-100">{choice.title}</strong><span className="block mt-2 text-xs leading-relaxed text-zinc-400">{choice.description}</span>
    </button>)}</div>
    <p className="text-xs text-zinc-500">При сворачивании фоны и анимации приостанавливаются. Музыка продолжает играть.</p>
  </section>;
}

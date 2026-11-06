import React, { useState } from 'react';
import { useCustomizationStore } from '../../store/customizationStore';

export const AppearancePresets: React.FC = () => {
  const [previous, setPrevious] = useState<ReturnType<typeof useCustomizationStore.getState> | null>(null);
  const apply = (kind: 'calm' | 'glass' | 'light') => {
    const state = useCustomizationStore.getState();
    setPrevious(state);
    state.setTheme(kind === 'light' ? 'amoled' : 'neutral');
    state.setGlassMode(kind === 'glass' ? 'glass' : 'normal');
    state.setGlassOpacity(kind === 'glass' ? 65 : 95);
    state.setGlassBlur(kind === 'glass' ? 18 : 0);
    if (kind !== 'glass') { state.setBgType('none'); state.setBgMobileEffect('none'); }
  };
  return <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <h3 className="font-semibold text-sm">Быстрое оформление</h3>
    <p className="mt-1 text-xs text-zinc-400">Готовая основа — затем настройте детали ниже.</p>
    <div className="mt-3 flex flex-wrap gap-2">{([['calm','Спокойный'],['glass','Стекло'],['light','Меньше эффектов']] as const).map(([id,label]) => <button key={id} onClick={() => apply(id)} className="min-h-11 rounded-xl bg-white/10 px-3 text-xs font-semibold hover:bg-white/20">{label}</button>)}</div>
    {previous && <button className="mt-2 min-h-11 text-xs text-emerald-400" onClick={() => { const s=useCustomizationStore.getState(); s.setTheme(previous.theme);s.setGlassMode(previous.glassMode);s.setGlassOpacity(previous.glassOpacity);s.setGlassBlur(previous.glassBlur);s.setBgType(previous.bgType);s.setBgMobileEffect(previous.bgMobileEffect);setPrevious(null); }}>Отменить последнее оформление</button>}
  </section>;
};

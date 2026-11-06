import React, { useEffect, useRef, useState } from 'react';
import { mobileMiniAppPlatform } from '../../hooks/playbackDiagnostics';

const SEEN_KEY = 'spoty_background_help_v1';
export function openBackgroundPlaybackHelp() {
  window.dispatchEvent(new Event('spoty:background-help'));
}

export const BackgroundPlaybackHelp: React.FC<{ hasError: boolean }> = ({ hasError }) => {
  const [intro, setIntro] = useState(false);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios'>(() => mobileMiniAppPlatform() || 'android');
  const dialog = useRef<HTMLDivElement>(null);
  const dismiss = () => {
    setIntro(false);
    try { localStorage.setItem(SEEN_KEY, 'seen'); } catch { /* Help still works without storage. */ }
  };
  useEffect(() => {
    try { setIntro(Boolean(mobileMiniAppPlatform()) && !localStorage.getItem(SEEN_KEY)); } catch { setIntro(Boolean(mobileMiniAppPlatform())); }
    const show = () => { dismiss(); setOpen(true); };
    window.addEventListener('spoty:background-help', show);
    return () => window.removeEventListener('spoty:background-help', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const items = dialog.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); previous?.focus(); };
  }, [open]);

  return <>
    {intro && !hasError && !open && <aside aria-label="Музыка в фоне" className="fixed left-4 right-4 bottom-36 z-40 mx-auto max-w-md rounded-2xl border border-white/15 bg-[#202522] p-4 shadow-xl text-sm text-white">
      <p className="font-semibold">Музыка с выключенным экраном</p>
      <p className="mt-1 text-zinc-300">Если песни останавливаются при блокировке, посмотрите рекомендации для {platform === 'ios' ? 'iPhone' : 'Android'}.</p>
      <div className="mt-2 flex gap-2">
        <button onClick={openBackgroundPlaybackHelp} className="min-h-11 rounded-full bg-[#1DB954] px-4 font-semibold text-black">Как настроить</button>
        <button onClick={dismiss} className="min-h-11 px-3 text-zinc-300">Понятно</button>
      </div>
    </aside>}
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" onClick={() => setOpen(false)}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="background-help-title" onClick={e => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#202020] p-5 text-white shadow-2xl outline-none">
        <h2 id="background-help-title" className="text-lg font-bold">Музыка в фоне</h2>
        <p className="mt-2 text-sm text-zinc-300">При блокировке экрана телефон или Telegram могут ограничивать загрузку следующей песни. Выберите свой телефон.</p>
        <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Инструкция для телефона">
          <button aria-pressed={platform === 'android'} onClick={() => setPlatform('android')} className={`min-h-11 rounded-full px-3 ${platform === 'android' ? 'bg-white text-black' : 'bg-white/10'}`}>Android</button>
          <button aria-pressed={platform === 'ios'} onClick={() => setPlatform('ios')} className={`min-h-11 rounded-full px-3 ${platform === 'ios' ? 'bg-white text-black' : 'bg-white/10'}`}>iPhone</button>
        </div>
        {platform === 'android' ? <><ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>Откройте настройки телефона → Приложения → Telegram.</li>
          <li>Откройте «Батарея», «Питание» или «Работа в фоне». Выберите «Без ограничений» / «Нет ограничений» или разрешите фоновую работу.</li>
          <li>Вернитесь в мини-приложение, запустите музыку и проверьте переключение песен с заблокированным экраном.</li>
        </ol>
        <p className="mt-3 text-sm text-zinc-300">На Xiaomi / Redmi / POCO: «Питание» → «Контроль активности» → «Нет ограничений».</p>
        <p className="mt-4 text-xs text-zinc-400">Названия пунктов зависят от телефона. Приложение не может изменить эту настройку само. Разрешение фоновой работы может увеличить расход батареи.</p></> : <>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>Запустите песню в открытом мини-приложении и дождитесь начала воспроизведения. Затем заблокируйте экран. Не закрывайте Telegram смахиванием из списка приложений.</li>
            <li>Для проверки откройте настройки iPhone → «Аккумулятор» и временно выключите «Режим энергосбережения», если он включён.</li>
            <li>Если музыка продолжает останавливаться, откройте сайт в браузере, например Safari, и сравните работу с заблокированным экраном.</li>
          </ol>
          <button className="mt-4 min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold" onClick={() => {
            const url = window.location.origin;
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.openLink) tg.openLink(url);
            else window.open(url, '_blank', 'noopener,noreferrer');
          }}>Открыть сайт в браузере</button>
          <p className="mt-4 text-xs text-zinc-400">На iPhone нет режима «Без ограничений» для Telegram. «Обновление контента» не разрешает фоновый звук. Эти шаги помогают проверить причину, но не гарантируют работу в фоне на всех версиях iOS и Telegram.</p>
        </>}
        <p className="mt-3 text-xs text-zinc-400">Если конкретная песня не играет и с открытым экраном, возможна проблема с записью или соединением — эта настройка не гарантирует её исправление.</p>
        <button onClick={() => setOpen(false)} className="mt-5 min-h-11 w-full rounded-full bg-[#1DB954] font-semibold text-black">Понятно, закрыть</button>
      </div>
    </div>}
  </>;
};

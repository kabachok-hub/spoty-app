import { useEffect } from 'react';
import { Download } from 'lucide-react';
import { isNativeClient, isHostHidden } from '../../platform/nativeBridge';
import { useAppUpdates, openAppUpdate } from '../../platform/appUpdates';
import { useSettingsStore } from '../../store/settingsStore';

export function AppUpdateButton() {
  const release = useAppUpdates(s => s.release), check = useAppUpdates(s => s.check);
  useEffect(() => {
    if (!isNativeClient()) return;
    const visible = () => { if (document.visibilityState === 'visible' && !isHostHidden()) void check(); };
    const startup = setTimeout(visible, 8000), interval = setInterval(visible, 6 * 60 * 60 * 1000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('spoty-host-visibility', visible);
    return () => { clearTimeout(startup); clearInterval(interval); document.removeEventListener('visibilitychange', visible); window.removeEventListener('spoty-host-visibility', visible); };
  }, [check]);
  if (!isNativeClient() || !release) return null;
  return <button className="spoty-update-button" title={`Доступна версия ${release.version}. Скачать обновление`} aria-label={`Скачать обновление ${release.version}`} onClick={() => { useSettingsStore.getState().setSettingsOpen(true); window.dispatchEvent(new Event('spoty-open-updates')); }}>
    <Download size={18} /><span className="hidden lg:inline">Обновить</span><i aria-hidden="true" />
  </button>;
}

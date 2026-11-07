import { Download, RefreshCw, Sparkles, BarChart3 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useNavigationStore } from '../../store/navigationStore';
import { openTasteSetup } from '../onboarding/TasteSetup';
import { APP_VERSION, openAppUpdate, useAppUpdates } from '../../platform/appUpdates';
import { isNativeClient } from '../../platform/nativeBridge';

export function GeneralSettings() {
  const user = useUserStore(s => s.user), language = useSettingsStore(s => s.language);
  const release = useAppUpdates(s => s.release), status = useAppUpdates(s => s.status), check = useAppUpdates(s => s.check);
  const close = () => useSettingsStore.getState().setSettingsOpen(false);
  return <div className="spoty-settings-general space-y-6">
    <section className="spoty-setting-section"><h3>Аккаунт</h3><p>{user?.first_name || 'Войдите через Telegram, чтобы сохранить свою библиотеку.'}</p>
      {user && <><button className="spoty-setting-row" onClick={() => { close(); openTasteSetup(); }}><Sparkles size={18}/><span>Музыкальные предпочтения<small>Артисты и рекомендации под ваш вкус</small></span><span>→</span></button>
      <button className="spoty-setting-row" onClick={() => { close(); useNavigationStore.getState().openStats(); }}><BarChart3 size={18}/><span>Статистика прослушиваний</span><span>→</span></button></>}
    </section>
    <section className="spoty-setting-section"><h3>Язык</h3><label className="spoty-setting-row"><span>Язык интерфейса</span><select aria-label="Язык интерфейса" value={language} onChange={e => useSettingsStore.getState().setLanguage(e.target.value as 'ru' | 'en')}><option value="ru">Русский</option><option value="en">English</option></select></label></section>
    {isNativeClient() && <section className="spoty-setting-section"><h3>Обновления</h3><div className="spoty-setting-row"><span>Spoty <small>Установлена версия {APP_VERSION}</small></span><button disabled={status === 'checking'} onClick={() => void check(true)} className="spoty-setting-action"><RefreshCw size={16} className={status === 'checking' ? 'animate-spin' : ''}/>Проверить</button></div>
      <p role="status">{release ? `Доступна версия ${release.version}` : status === 'checking' ? 'Проверяем обновления…' : status === 'error' ? 'Не удалось связаться с GitHub. Попробуйте позже.' : status === 'ready' ? 'Установлена актуальная версия.' : 'Приложение сообщит, когда появится новая версия.'}</p>
      {release && <button className="spoty-setting-action" onClick={() => void openAppUpdate().catch(() => {})}><Download size={16}/>Скачать {release.version}</button>}
    </section>}
  </div>;
}

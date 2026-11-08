import { openAppUpdate, useUpdateTransfer } from '../../platform/appUpdates';
export function UpdateAction() {
  const { phase, progress, permissionRequired } = useUpdateTransfer();
  return <div className="space-y-2">
    <button className="spoty-setting-action" disabled={phase === 'downloading' || phase === 'installing'} onClick={() => void openAppUpdate()}>
      {phase === 'downloading' ? `Скачивание ${progress}%` : phase === 'downloaded' ? 'Установить обновление' : phase === 'installing' ? 'Открываем установщик…' : phase === 'error' ? 'Повторить скачивание' : 'Скачать обновление'}
    </button>
    {phase === 'downloading' && <progress className="w-full accent-green-500" aria-label="Скачивание обновления" value={progress} max={100} />}
    <p role="status" className="text-sm text-zinc-400">{phase === 'error' ? 'Не удалось скачать или проверить обновление. Попробуйте ещё раз.' : permissionRequired ? 'Разрешите установку из Spoty в системных настройках, затем снова нажмите «Установить обновление».' : phase === 'downloaded' ? 'Файл проверен. Установка обновит приложение и сохранит настройки.' : 'Обновление скачивается из GitHub внутри приложения. Установка может прервать воспроизведение.'}</p>
  </div>;
}

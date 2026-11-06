import React, { useState, useEffect } from 'react';
import { isNativeClient, nativeCall } from '../../platform/nativeBridge';
import { X, Laptop, Smartphone, Copy, Check, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useTelegram } from '../../hooks/useTelegram';
import { api } from '../../api/client';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose }) => {
  const user = useUserStore((state) => state.user);
  const loginWithToken = useUserStore((state) => state.loginWithToken);
  const { haptic } = useTelegram();

  const [retry, setRetry] = useState(0);
  const [loginError, setLoginError] = useState('');
  const [copied, setCopied] = useState(false);
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isRealUser = user && user.telegram_id !== 999999999;
  const token = localStorage.getItem('spotify_auth_token') || user?.auth_token || '';
  const personalWebUrl = `${window.location.origin}/?auth_token=${encodeURIComponent(token)}`;

  // Generate 6-digit code if user is not logged in on PC
  useEffect(() => {
    if (!isOpen || isRealUser) return;

    setLoginError(''); setSyncCode(null); setDeepLink(null); setIsSuccess(false);
    let pollInterval: any = null;
    let checking = false;
    let cancelled = false;

    api.requestSyncCode().then((data) => {
      if (cancelled) return;
      setSyncCode(data.code);
      setDeepLink(data.deep_link);
      setIsPolling(true);

      // Start polling for bot confirmation
      pollInterval = setInterval(async () => {
        if (checking || cancelled) return;
        checking = true;
        try {
          const res = await api.checkSyncCode(data.code, data.poll_token);
          if (cancelled) return;
          if (res.status === 'confirmed' && res.auth_token) {
            clearInterval(pollInterval);
            setIsPolling(false);
            await loginWithToken(res.auth_token);
            if (cancelled) return;
            setIsSuccess(true);
            haptic.notification('success');
            setTimeout(() => {
              onClose();
            }, 1200);
          } else if (res.status === 'expired') {
            setLoginError('Код истёк или сервер был перезапущен. Получите новый код.');
            clearInterval(pollInterval);
            setIsPolling(false);
          }
        } catch (e) {
          if (!cancelled) setLoginError('Не удалось завершить вход. Попробуйте ещё раз.');
        } finally { checking = false; }
      }, 2000);
    }).catch(() => { if (!cancelled) setLoginError('Не удалось создать код. Проверьте подключение.'); });

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, isRealUser, retry]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    haptic.selection();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(personalWebUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#1e1e1e] border border-white/10 rounded-3xl p-5 shadow-2xl text-white animate-slide-up space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Laptop size={20} className="text-[#1DB954]" />
            <h2 className="text-base font-bold">Вход через Telegram</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {loginError && <div role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
          <p>{loginError}</p>
          <button className="min-h-11 mt-2 px-4 rounded-full bg-white/10" onClick={() => setRetry(value => value + 1)}>Получить новый код</button>
        </div>}
        {/* Case 1: Already logged in with Telegram account */}
        {isRealUser && isNativeClient() ? <p className="text-sm text-zinc-300">Выполнен вход в ваш аккаунт Telegram. Медиатека и плейлисты общие с сайтом и ботом.</p> : isRealUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 border border-[#1DB954] flex items-center justify-center text-[#1DB954] font-extrabold flex-shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-xs font-semibold text-zinc-400">Текущий аккаунт Telegram</div>
                <div className="text-sm font-bold text-white truncate">
                  {user.first_name} {user.username ? `(@${user.username})` : ''}
                </div>
              </div>
            </div>

            <div className="text-xs text-zinc-300 leading-relaxed text-left space-y-2">
              <p>
                Чтобы открыть этот же аккаунт на компьютере (со всеми твоими лайками и плейлистами):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px]">
                <li>Скопируй персональную ссылку ниже</li>
                <li>Отправь себе в «Избранное» (Saved Messages) в Telegram</li>
                <li>Открой её на компьютере в любом браузере</li>
              </ol>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyLink}
              className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition active:scale-95 shadow-lg ${
                copied
                  ? 'bg-emerald-500 text-black'
                  : 'bg-[#1DB954] hover:bg-[#1ed760] text-black'
              }`}
            >
              {copied ? (
                <>
                  <Check size={18} strokeWidth={3} />
                  <span>Ссылка скопирована!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Скопировать ссылку для ПК</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Case 2: In browser without Telegram account (Guest/PC) */
          <div className="space-y-4 text-center">
            {isSuccess ? (
              <div className="py-6 space-y-2 text-center">
                <div className="w-14 h-14 rounded-full bg-[#1DB954]/20 border-2 border-[#1DB954] flex items-center justify-center mx-auto text-[#1DB954]">
                  <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-base font-bold text-white">Вход выполнен!</h3>
                <p className="text-xs text-zinc-400">Твой профиль и треки загружаются...</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-300 text-left">
                  Откройте бота, нажмите «Старт», затем вернитесь сюда — вход завершится автоматически.
                </p>

                {/* Option A: Telegram Bot Deep Link */}
                {deepLink && (
                  <a
                    href={deepLink}
                    onClick={event => { if (isNativeClient()) { event.preventDefault(); void nativeCall('openExternal', { url: deepLink }); } }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1f8fc4] text-white flex items-center justify-center gap-2 text-sm font-bold transition active:scale-95 shadow-lg"
                  >
                    <Smartphone size={18} />
                    <span>Войти через Telegram</span>
                    <ExternalLink size={14} />
                  </a>
                )}

                {/* Option B: 6-Digit Sync Code */}
                {syncCode && (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                      Или отправь боту код:
                    </div>
                    <div className="text-2xl font-mono font-extrabold tracking-widest text-[#1DB954] py-1 bg-black/30 rounded-xl border border-white/5">
                      {syncCode}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Отправь в чат с ботом команду:{' '}
                      <span className="font-mono text-zinc-200 select-all font-bold">
                        /sync {syncCode}
                      </span>
                    </div>
                  </div>
                )}

                {isPolling && (
                  <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 pt-1">
                    <RefreshCw size={12} className="animate-spin text-[#1DB954]" />
                    <span>Ждём подтверждение. Нажмите «Старт» в боте.</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

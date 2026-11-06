import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

export const PreferenceNotice: React.FC = () => {
  const notice = useUserStore(s => s.preferenceNotice);
  const dismiss = useUserStore(s => s.dismissPreferenceNotice);
  const toggle = useUserStore(s => s.toggleDislike);
  const [pending, setPending] = useState(false);
  if (!notice) return null;
  return <div role="status" className="fixed z-[100] bottom-40 md:bottom-28 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-white/15 bg-[#242424] shadow-2xl px-4 py-3 text-sm flex items-center gap-3">
    <span className="flex-1 text-zinc-100">{notice.message}</span>
    {notice.undoTrack && <button className="min-h-11 text-[#1DB954] font-semibold disabled:opacity-50" disabled={pending}
      onClick={async () => { setPending(true); try { await toggle(notice.undoTrack!); } finally { setPending(false); } }}>Отменить</button>}
    <button className="min-w-9 min-h-11 text-zinc-400 hover:text-white" aria-label="Закрыть сообщение" onClick={dismiss}><X size={18} /></button>
  </div>;
};

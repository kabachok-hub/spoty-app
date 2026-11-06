import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, visible, onHide }) => {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 2200);
      return () => clearTimeout(t);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] pointer-events-none animate-slide-up">
      <div className="flex items-center gap-2 bg-[#1DB954] text-black text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl shadow-black/40">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {message}
      </div>
    </div>
  );
};

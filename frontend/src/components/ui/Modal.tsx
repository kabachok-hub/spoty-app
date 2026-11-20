import React from 'react';
import { DialogSurface } from './DialogSurface';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <DialogSurface title={title} onClose={onClose} className="max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#202020] p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#333]">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            aria-label="Закрыть" onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-[#333] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
    </DialogSurface>
  );
};

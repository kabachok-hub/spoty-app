import React, { useLayoutEffect, useRef } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className: string;
}

export function DialogSurface({ title, onClose, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-label={title} className={'spoty-dialog ' + className}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    {children}
  </dialog>;
}

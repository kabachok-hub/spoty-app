import { useLayoutEffect } from 'react';
export function NativeLayoutMetrics() {
  useLayoutEffect(() => {
    const header = document.querySelector('.spoty-header');
    if (!header) return;
    const update = () => document.documentElement.style.setProperty('--client-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(update); observer.observe(header); update();
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  });
  return null;
}

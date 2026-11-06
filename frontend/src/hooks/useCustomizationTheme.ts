import { useEffect } from 'react';
import { useCustomizationStore, THEME_PRESETS } from '../store/customizationStore';
import { usePlayerStore } from '../store/playerStore';
import { api } from '../api/client';
import { isHostHidden } from '../platform/nativeBridge';

// Simple fast hex to rgb helper
function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function useCustomizationTheme() {
  const theme = useCustomizationStore((state) => state.theme);
  const adaptiveAccent = useCustomizationStore((state) => state.adaptiveAccent);
  const adaptiveGlow = useCustomizationStore((state) => state.adaptiveGlow);
  const setAdaptiveColors = useCustomizationStore((state) => state.setAdaptiveColors);

  const glassMode = useCustomizationStore((state) => state.glassMode);
  const glassOpacity = useCustomizationStore((state) => state.glassOpacity);
  const glassBlur = useCustomizationStore((state) => state.glassBlur);
  const bgType = useCustomizationStore((state) => state.bgType);

  const currentTrack = usePlayerStore((state) => state.currentTrack);

  // Extract adaptive color from current playing track's cover using canvas
  useEffect(() => {
    if (theme !== 'adaptive' || !currentTrack?.cover_url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentTrack.cover_url;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 30;
        canvas.height = 30;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 30, 30);
        const data = ctx.getImageData(0, 0, 30, 30).data;

        let r = 0, g = 0, b = 0, count = 0;
        // Sample pixels with vibrant saturation
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          // Skip too dark or too white pixels for vivid accent extraction
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
          if (brightness > 40 && brightness < 225) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }

        if (count > 0) {
          const avgR = Math.round(r / count);
          const avgG = Math.round(g / count);
          const avgB = Math.round(b / count);
          const hex = `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1)}`;
          const glow = `rgba(${avgR}, ${avgG}, ${avgB}, 0.4)`;
          setAdaptiveColors(hex, glow);
        }
      } catch (e) {
        // Fallback if CORS restricts canvas reading
      }
    };
  }, [theme, currentTrack?.cover_url, setAdaptiveColors]);

  // Apply CSS variables to root
  useEffect(() => {
    const root = document.documentElement;
    const config = THEME_PRESETS[theme] || THEME_PRESETS.neutral;

    const accent = theme === 'adaptive' ? adaptiveAccent : config.accent;
    const glow = theme === 'adaptive' ? adaptiveGlow : config.accentGlow;

    const baseBgRgb = hexToRgb(config.bgDark);
    const cardBgRgb = hexToRgb(config.cardBg);

    let effectiveGlassBg: string;
    let effectiveCardBg: string;
    let effectiveBlur = `${glassBlur}px`;

    if (glassMode === 'off') {
      effectiveGlassBg = config.bgDark;
      effectiveCardBg = config.cardBg;
      effectiveBlur = '0px';
    } else if (glassMode === 'normal') {
      effectiveGlassBg = `rgba(${baseBgRgb[0]}, ${baseBgRgb[1]}, ${baseBgRgb[2]}, 0.95)`;
      effectiveCardBg = `rgba(${cardBgRgb[0]}, ${cardBgRgb[1]}, ${cardBgRgb[2]}, 0.92)`;
      effectiveBlur = '8px';
    } else {
      // Glassmorphism mode
      const alpha = Math.max(0.25, Math.min(1, glassOpacity / 100));
      effectiveGlassBg = `rgba(${baseBgRgb[0]}, ${baseBgRgb[1]}, ${baseBgRgb[2]}, ${alpha})`;
      effectiveCardBg = `rgba(${cardBgRgb[0]}, ${cardBgRgb[1]}, ${cardBgRgb[2]}, ${Math.min(0.92, alpha + 0.08)})`;
      effectiveBlur = `${glassBlur}px`;
    }

    root.style.setProperty('--accent-color', accent);
    root.style.setProperty('--accent-glow', glow);
    root.style.setProperty('--glass-bg', effectiveGlassBg);
    root.style.setProperty('--glass-blur', effectiveBlur);
    root.style.setProperty('--card-bg', effectiveCardBg);

    root.setAttribute('data-theme', theme);

    // Always keep body background solid dark so WebKit backdrop-filter never crashes to white/black
    document.body.style.backgroundColor = config.bgDark || '#121212';
  }, [theme, adaptiveAccent, adaptiveGlow, glassMode, glassOpacity, glassBlur, bgType]);

  // ── Real-Time Cloud Sync across Browser and Mobile ──
  useEffect(() => {
    let isMounted = true;
    let pollInterval: any = null;

    const checkSync = async () => {
      try {
        const lastSynced = useCustomizationStore.getState().lastSyncedAt;
        const res = await api.checkCustomization(lastSynced);
        if (!isMounted) return;
        if (res && res.changed && res.customization && res.updated_at > lastSynced) {
          useCustomizationStore.getState().applyRemoteCustomization(res.customization, res.updated_at);
        }
      } catch (e) {
        // Silently ignore if offline or unauthenticated
      }
    };

    // 1. Initial fetch on mount
    api.getCustomization()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.updated_at > 0 && res.customization && Object.keys(res.customization).length > 0) {
          useCustomizationStore.getState().applyRemoteCustomization(res.customization, res.updated_at);
        }
      })
      .catch(() => {});

    // 2. Gentle polling: only when document is visible, every 12 seconds
    pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isHostHidden()) {
        checkSync();
      }
    }, 12000);

    // 3. Immediate check when switching to app or tab gains focus
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isHostHidden()) {
        checkSync();
      }
    };
    const onFocus = () => checkSync();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('spoty-host-visibility', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('spoty-host-visibility', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}

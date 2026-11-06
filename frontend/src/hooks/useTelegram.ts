import { useEffect, useCallback } from 'react';

export function useTelegram() {
  const tg = (window as any).Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      // Enable closing confirmation and prevent accidental close swipes
      try {
        tg.enableClosingConfirmation?.();
        tg.disableVerticalSwipes?.();
      } catch (e) {
        // ignore on older tg clients
      }
    }
  }, [tg]);

  const haptic = {
    impact: useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
      try {
        tg?.HapticFeedback?.impactOccurred(style);
      } catch (e) {
        // Haptics not supported
      }
    }, [tg]),

    notification: useCallback((type: 'error' | 'success' | 'warning' = 'success') => {
      try {
        tg?.HapticFeedback?.notificationOccurred(type);
      } catch (e) {
        // Haptics not supported
      }
    }, [tg]),

    selection: useCallback(() => {
      try {
        tg?.HapticFeedback?.selectionChanged();
      } catch (e) {
        // Haptics not supported
      }
    }, [tg]),
  };

  const setupBackButton = useCallback((visible: boolean, onClick?: () => void) => {
    if (!tg?.BackButton) return;

    if (visible) {
      tg.BackButton.show();
      if (onClick) {
        tg.BackButton.onClick(onClick);
      }
    } else {
      tg.BackButton.hide();
    }

    return () => {
      if (onClick && tg?.BackButton) {
        tg.BackButton.offClick(onClick);
      }
    };
  }, [tg]);

  return {
    tg,
    user: tg?.initDataUnsafe?.user,
    initData: tg?.initData,
    colorScheme: tg?.colorScheme || 'dark',
    haptic,
    setupBackButton,
    isExpanded: tg?.isExpanded,
    close: () => tg?.close(),
  };
}

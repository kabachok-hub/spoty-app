import { create } from 'zustand';
import { Language, translations } from '../i18n/translations';

export type ThemeType = 'spotify' | 'oled' | 'midnight';

export const EQUALIZER_PRESETS: Record<
  string,
  { label: string; bands: [number, number, number, number, number] }
> = {
  flat: { label: 'Обычный (Flat)', bands: [0, 0, 0, 0, 0] },
  bass_boost: { label: 'Усиление басов (Bass Boost)', bands: [7, 5, 0, -1, -2] },
  bass_reducer: { label: 'Снижение басов', bands: [-7, -5, 0, 1, 2] },
  vocal: { label: 'Усиление вокала', bands: [-2, 1, 4, 3, 1] },
  electronic: { label: 'Электроника / EDM', bands: [5, 3, 0, 2, 5] },
  hiphop: { label: 'Хип-хоп / Рэп', bands: [6, 4, 0, 2, 3] },
  rock: { label: 'Рок', bands: [5, 3, -1, 3, 5] },
  pop: { label: 'Поп', bands: [-1, 2, 4, 2, -1] },
  acoustic: { label: 'Акустика', bands: [3, 2, 1, 2, 3] },
};

interface SettingsState {
  language: Language;
  theme: ThemeType;
  audioQuality: 'high' | 'normal';
  showTopCloud: boolean;
  isNotificationsOpen: boolean;
  isSettingsOpen: boolean;
  isAdminOpen: boolean;
  unreadCount: number;

  // Crossfade (плавное сведение)
  crossfadeSeconds: number; // 0, 3, 5, 8, 12

  // Equalizer
  equalizerEnabled: boolean;
  equalizerPreset: string;
  equalizerBands: [number, number, number, number, number]; // 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz

  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeType) => void;
  setShowTopCloud: (show: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAdminOpen: (open: boolean) => void;
  setUnreadCount: (count: number) => void;
  setCrossfadeSeconds: (sec: number) => void;
  setEqualizerEnabled: (enabled: boolean) => void;
  setEqualizerPreset: (presetKey: string) => void;
  setEqualizerBand: (bandIndex: number, value: number) => void;
  resetEqualizer: () => void;
  t: (key: keyof typeof translations.ru) => string;
}

const getInitialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('spotify_lang') as Language;
    if (saved === 'ru' || saved === 'en') return saved;
  } catch (e) {}
  return 'ru';
};

const getInitialTheme = (): ThemeType => {
  try {
    const saved = localStorage.getItem('spotify_theme') as ThemeType;
    if (saved === 'spotify' || saved === 'oled' || saved === 'midnight') return saved;
  } catch (e) {}
  return 'spotify';
};

const getInitialTopCloud = (): boolean => {
  try {
    const saved = localStorage.getItem('spotify_top_cloud');
    if (saved !== null) return saved === 'true';
  } catch (e) {}
  return true;
};

const getInitialCrossfade = (): number => {
  try {
    const saved = localStorage.getItem('spotify_crossfade');
    if (saved !== null) return [0, 3, 5, 8, 12].includes(Number(saved)) ? Number(saved) : 0;
  } catch (e) {}
  return 5; // Default 5 seconds for smooth DJ style transitions
};

const getInitialEqEnabled = (): boolean => {
  try {
    const saved = localStorage.getItem('spotify_eq_enabled');
    if (saved !== null) return saved === 'true';
  } catch (e) {}
  return false;
};

const getInitialEqPreset = (): string => {
  try {
    const saved = localStorage.getItem('spotify_eq_preset');
    if (saved && (saved === 'custom' || EQUALIZER_PRESETS[saved])) return saved;
  } catch (e) {}
  return 'flat';
};

const getInitialEqBands = (): [number, number, number, number, number] => {
  try {
    const saved = localStorage.getItem('spotify_eq_bands');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 5 && parsed.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -12 && n <= 12)) {
        return parsed as [number, number, number, number, number];
      }
    }
  } catch (e) {}
  return [0, 0, 0, 0, 0];
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: getInitialLanguage(),
  theme: getInitialTheme(),
  audioQuality: 'high',
  showTopCloud: getInitialTopCloud(),
  isNotificationsOpen: false,
  isSettingsOpen: false,
  isAdminOpen: typeof window !== 'undefined' && window.location.search.includes('admin=1'),
  unreadCount: 0,

  crossfadeSeconds: getInitialCrossfade(),
  equalizerEnabled: getInitialEqEnabled(),
  equalizerPreset: getInitialEqPreset(),
  equalizerBands: getInitialEqBands(),

  setAdminOpen: (open: boolean) => set({ isAdminOpen: open }),

  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem('spotify_lang', lang);
    } catch (e) {}
    set({ language: lang });
  },

  setTheme: (theme: ThemeType) => {
    try {
      localStorage.setItem('spotify_theme', theme);
    } catch (e) {}
    set({ theme });
  },

  setShowTopCloud: (show: boolean) => {
    try {
      localStorage.setItem('spotify_top_cloud', String(show));
    } catch (e) {}
    set({ showTopCloud: show });
  },

  setNotificationsOpen: (open: boolean) =>
    set({ isNotificationsOpen: open, unreadCount: open ? 0 : get().unreadCount }),

  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setUnreadCount: (count: number) => set({ unreadCount: count }),

  setCrossfadeSeconds: (sec: number) => {
    try {
      localStorage.setItem('spotify_crossfade', String(sec));
    } catch (e) {}
    set({ crossfadeSeconds: sec });
  },

  setEqualizerEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem('spotify_eq_enabled', String(enabled));
    } catch (e) {}
    set({ equalizerEnabled: enabled });
  },

  setEqualizerPreset: (presetKey: string) => {
    const preset = EQUALIZER_PRESETS[presetKey];
    if (preset) {
      try {
        localStorage.setItem('spotify_eq_preset', presetKey);
        localStorage.setItem('spotify_eq_bands', JSON.stringify(preset.bands));
      } catch (e) {}
      set({ equalizerPreset: presetKey, equalizerBands: [...preset.bands] });
    }
  },

  setEqualizerBand: (bandIndex: number, value: number) => {
    if (!Number.isInteger(bandIndex) || bandIndex < 0 || bandIndex >= 5 || !Number.isFinite(value)) return;
    const clamped = Math.max(-12, Math.min(12, Math.round(value)));
    const current = [...get().equalizerBands] as [number, number, number, number, number];
    current[bandIndex] = clamped;
    try {
      localStorage.setItem('spotify_eq_bands', JSON.stringify(current));
      localStorage.setItem('spotify_eq_preset', 'custom');
    } catch (e) {}
    set({ equalizerBands: current, equalizerPreset: 'custom' });
  },

  resetEqualizer: () => {
    const flat = EQUALIZER_PRESETS.flat.bands;
    try {
      localStorage.setItem('spotify_eq_preset', 'flat');
      localStorage.setItem('spotify_eq_bands', JSON.stringify(flat));
    } catch (e) {}
    set({ equalizerPreset: 'flat', equalizerBands: [...flat] });
  },

  t: (key: keyof typeof translations.ru) => {
    const lang = get().language;
    return (translations[lang] && translations[lang][key]) || translations.ru[key] || key;
  },
}));

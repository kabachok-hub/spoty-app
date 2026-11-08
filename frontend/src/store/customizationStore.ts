import { DEFAULT_CUSTOMIZATION } from './defaultCustomization';
import { create } from 'zustand';
import { api } from '../api/client';

export type ThemeId =
  | 'neutral'
  | 'amoled'
  | 'crimson'
  | 'nord'
  | 'sky'
  | 'mint'
  | 'violet'
  | 'sakura'
  | 'sunset'
  | 'terminal'
  | 'aqua'
  | 'slate'
  | 'adaptive';

export type GlassMode = 'off' | 'normal' | 'glass';
export type PlayerStyle = 'classic' | 'vinyl' | 'large';
export type SliderStyle = 'classic' | 'thin' | 'smooth' | 'wave' | 'waveform';
export type SeekbarThumbType =
  | 'classic'
  | 'worm'
  | 'custom'
  | 'artist'
  | 'vinyl'
  | 'fire'
  | 'heart';
export type TitleAlign = 'left' | 'center' | 'right';
export type NavStyle = 'default' | 'compact' | 'floating';
export type CoverFilter = 'none' | 'blur' | 'grayscale' | 'sepia' | 'contrast' | 'invert';

export type BgType =
  | 'none'
  | 'canvas_stars'
  | 'canvas_rain'
  | 'canvas_aurora'
  | 'canvas_waves'
  | 'video_preset'
  | 'custom_url';

export type BgFitMode = 'ambient' | 'cover' | 'contain';
export type BgMobileEffect = 'none' | 'pan' | 'tilt' | 'particles' | 'vignette';
export type BgPosition = 'center' | 'left' | 'right' | 'top' | 'bottom';

export interface SavedBgItem {
  id: string;
  url: string;
  title: string;
  type?: 'steam' | 'youtube' | 'video' | 'image';
  previewUrl?: string;
  createdAt: number;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  emoji: string;
  accent: string;
  accentGlow: string;
  bgDark: string;
  cardBg: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemeConfig> = {
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    emoji: '🌑',
    accent: '#1DB954',
    accentGlow: 'rgba(29, 185, 84, 0.35)',
    bgDark: '#121212',
    cardBg: '#181818',
  },
  amoled: {
    id: 'amoled',
    name: 'AMOLED',
    emoji: '🖤',
    accent: '#ffffff',
    accentGlow: 'rgba(255, 255, 255, 0.25)',
    bgDark: '#000000',
    cardBg: '#080808',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    emoji: '🔴',
    accent: '#ff2a4b',
    accentGlow: 'rgba(255, 42, 75, 0.4)',
    bgDark: '#14080a',
    cardBg: '#1f0d11',
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    emoji: '❄️',
    accent: '#88c0d0',
    accentGlow: 'rgba(136, 192, 208, 0.35)',
    bgDark: '#2e3440',
    cardBg: '#3b4252',
  },
  sky: {
    id: 'sky',
    name: 'Sky',
    emoji: '🌌',
    accent: '#38bdf8',
    accentGlow: 'rgba(56, 189, 248, 0.4)',
    bgDark: '#071626',
    cardBg: '#0c2238',
  },
  mint: {
    id: 'mint',
    name: 'Mint',
    emoji: '🍃',
    accent: '#2dd4bf',
    accentGlow: 'rgba(45, 212, 191, 0.4)',
    bgDark: '#071917',
    cardBg: '#0e2b27',
  },
  violet: {
    id: 'violet',
    name: 'Violet',
    emoji: '🔮',
    accent: '#a855f7',
    accentGlow: 'rgba(168, 85, 247, 0.4)',
    bgDark: '#140a24',
    cardBg: '#201138',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    emoji: '🌸',
    accent: '#f472b6',
    accentGlow: 'rgba(244, 114, 182, 0.4)',
    bgDark: '#1f0d18',
    cardBg: '#2e1424',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    accent: '#fb923c',
    accentGlow: 'rgba(251, 146, 60, 0.4)',
    bgDark: '#1c0f07',
    cardBg: '#2d180b',
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    emoji: '📟',
    accent: '#22c55e',
    accentGlow: 'rgba(34, 197, 94, 0.45)',
    bgDark: '#051208',
    cardBg: '#0a1f0f',
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua',
    emoji: '🌊',
    accent: '#06b6d4',
    accentGlow: 'rgba(6, 182, 212, 0.4)',
    bgDark: '#08171f',
    cardBg: '#0d2533',
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    emoji: '🪨',
    accent: '#94a3b8',
    accentGlow: 'rgba(148, 163, 184, 0.35)',
    bgDark: '#0f172a',
    cardBg: '#1e293b',
  },
  adaptive: {
    id: 'adaptive',
    name: 'Под обложку',
    emoji: '🎨',
    accent: '#1DB954',
    accentGlow: 'rgba(29, 185, 84, 0.35)',
    bgDark: '#101014',
    cardBg: '#18181f',
  },
};

export interface VideoPreset {
  id: string;
  name: string;
  desc: string;
  previewUrl: string;
  videoUrl: string;
}

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'fishing_frogs',
    name: '🐸 Рыбачащие лягушки',
    desc: 'Уютный вечер на пруду, ловля светлячков и кваканье',
    previewUrl: '/videos/fishing_frogs_thumb.jpg',
    videoUrl: '/videos/fishing_frogs.mp4',
  },
  {
    id: 'bliss_minecraft',
    name: '🟩 Minecraft Bliss (XP)',
    desc: 'Легендарные зеленые холмы Windows XP в блоках Minecraft',
    previewUrl: '/videos/bliss_minecraft_thumb.jpg',
    videoUrl: '/videos/bliss_minecraft.mp4',
  },
  {
    id: 'cat_sakura_pixel',
    name: '🐱 Кот на улице сакуры',
    desc: 'Пиксельный японский переулок, кот и падающие лепестки',
    previewUrl: '/videos/cat_sakura_pixel_thumb.jpg',
    videoUrl: '/videos/cat_sakura_pixel.mp4',
  },
  {
    id: 'rainy_gta5',
    name: '🌧️ Дождь в Лос-Сантосе',
    desc: 'Ночные неоновые огни GTA V и мокрый асфальт',
    previewUrl: '/videos/rainy_gta5_thumb.jpg',
    videoUrl: '/videos/rainy_gta5.mp4',
  },
  {
    id: 'night_sakura',
    name: '🌙 Ночная сакура',
    desc: 'Волшебная сакура под серебряным сиянием полной луны',
    previewUrl: '/videos/night_sakura_thumb.jpg',
    videoUrl: '/videos/night_sakura.mp4',
  },
  {
    id: 'mushling_dance',
    name: '🍄 Танец лесных грибочков',
    desc: 'Забавные светящиеся грибы танцуют под музыку',
    previewUrl: '/videos/mushling_dance_thumb.jpg',
    videoUrl: '/videos/mushling_dance.mp4',
  },
  {
    id: 'pepe_meditation',
    name: '🧘 Пепе в нирване',
    desc: 'Медитация на закате, полный дзен, гармония и спокойствие',
    previewUrl: '/videos/pepe_meditation_thumb.jpg',
    videoUrl: '/videos/pepe_meditation.mp4',
  },
  {
    id: 'sad_pepe_bus',
    name: '🚌 Пепе на остановке',
    desc: 'Ностальгический вечер в ожидании ночного автобуса',
    previewUrl: '/videos/sad_pepe_bus_thumb.jpg',
    videoUrl: '/videos/sad_pepe_bus.mp4',
  },
  {
    id: 'dark_gothic_castle',
    name: '🏰 Темный готический замок',
    desc: 'Мрачная цитадель в тумане, молнии и парящие вороны',
    previewUrl: '/videos/dark_gothic_castle_thumb.jpg',
    videoUrl: '/videos/dark_gothic_castle.mp4',
  },
  {
    id: 'silver_surfer',
    name: '🏄 Скелет на волнах космоса',
    desc: 'Серебряный серфер скользит сквозь сияющие туманности',
    previewUrl: '/videos/silver_surfer_thumb.jpg',
    videoUrl: '/videos/silver_surfer.mp4',
  },
  {
    id: 'starlit_ocean',
    name: '🌊 Звездный океан',
    desc: 'Мерцающие лазурные волны под куполом звездного неба',
    previewUrl: '/videos/starlit_ocean_thumb.jpg',
    videoUrl: '/videos/starlit_ocean.mp4',
  },
  {
    id: 'winter_city_pixel',
    name: '❄️ Зимний пиксельный город',
    desc: 'Тихий снегопад над ночным городом и теплые окна',
    previewUrl: '/videos/winter_city_pixel_thumb.jpg',
    videoUrl: '/videos/winter_city_pixel.mp4',
  },
  {
    id: 'begonia_flower',
    name: '🌺 Цветок бегония',
    desc: 'Нежные лепестки, колышущиеся на ветру, и релакс',
    previewUrl: '/videos/begonia_flower_thumb.jpg',
    videoUrl: '/videos/begonia_flower.mp4',
  },
  {
    id: 'loading_pixel',
    name: '⏳ Пиксельный лоадер',
    desc: 'Лоу-фай ретро пиксельная загрузка в бесконечном цикле',
    previewUrl: '/videos/loading_pixel_thumb.jpg',
    videoUrl: '/videos/loading_pixel.mp4',
  },
  {
    id: 'lonely_tree_cosmic',
    name: '🌌 Дерево под космическим небом',
    desc: 'Одинокое дерево на фоне вращающегося Млечного Пути',
    previewUrl: '/videos/lonely_tree_cosmic_thumb.jpg',
    videoUrl: '/videos/lonely_tree_cosmic.mp4',
  },
  {
    id: 'cyber_pixel_city',
    name: '🏙️ Киберпанк мегаполис',
    desc: 'Неоновые небоскребы и ретровейв закат будущего',
    previewUrl: '/videos/cyber_pixel_city_thumb.jpg',
    videoUrl: '/videos/cyber_pixel_city.mp4',
  },
];

interface CustomizationState {
  // Theme & Color
  theme: ThemeId;
  adaptiveAccent: string;
  adaptiveGlow: string;
  coverFilter: CoverFilter;

  // Glassmorphism & Transparency
  glassMode: GlassMode;
  glassOpacity: number; // 30 - 100
  glassBlur: number;    // 0 - 32

  // Background & Live Video
  bgType: BgType;
  videoPresetId: string;
  customBgUrl: string;
  bgDim: number; // 0 - 90
  bgScale: number; // 40 - 140 (% scale / distance)
  bgFit: BgFitMode; // 'ambient' | 'cover' | 'contain'
  bgMobileEffect: BgMobileEffect; // 'none' | 'pan' | 'tilt' | 'particles' | 'vignette'
  bgPosition: BgPosition; // 'center' | 'left' | 'right' | 'top' | 'bottom'
  bgBlur: number; // 0 - 24 px
  savedBgUrls: SavedBgItem[];

  // Player Settings
  playerStyle: PlayerStyle;
  sliderStyle: SliderStyle;
  seekbarThumb: SeekbarThumbType;
  customThumbUrl: string;
  titleAlign: TitleAlign;
  showArtistAvatar: boolean;
  showQueueInPlayer: boolean;

  // Navigation Style
  navStyle: NavStyle;

  // Sync State
  lastSyncedAt: number;

  // Actions
  applyRemoteCustomization: (remote: Partial<CustomizationState>, updatedAt: number) => void;
  setTheme: (theme: ThemeId) => void;
  setAdaptiveColors: (accent: string, glow: string) => void;
  setCoverFilter: (filter: CoverFilter) => void;
  setGlassMode: (mode: GlassMode) => void;
  setGlassOpacity: (opacity: number) => void;
  setGlassBlur: (blur: number) => void;
  setBgType: (bgType: BgType) => void;
  setVideoPresetId: (presetId: string) => void;
  setCustomBgUrl: (url: string) => void;
  setBgDim: (dim: number) => void;
  setBgScale: (scale: number) => void;
  setBgFit: (fit: BgFitMode) => void;
  setBgMobileEffect: (effect: BgMobileEffect) => void;
  setBgPosition: (position: BgPosition) => void;
  setBgBlur: (blur: number) => void;
  addSavedBgUrl: (item: { url: string; title?: string; type?: SavedBgItem['type']; previewUrl?: string; id?: string }) => void;
  removeSavedBgUrl: (id: string) => void;
  setPlayerStyle: (style: PlayerStyle) => void;
  setSliderStyle: (style: SliderStyle) => void;
  setSeekbarThumb: (thumb: SeekbarThumbType) => void;
  setCustomThumbUrl: (url: string) => void;
  setTitleAlign: (align: TitleAlign) => void;
  setShowArtistAvatar: (show: boolean) => void;
  setShowQueueInPlayer: (show: boolean) => void;
  setNavStyle: (style: NavStyle) => void;
  resetAll: () => void;
}

const normalizeSeekbarThumb = (value: unknown): SeekbarThumbType => ['classic', 'worm', 'custom', 'artist', 'vinyl', 'fire', 'heart'].includes(String(value)) ? value as SeekbarThumbType : 'classic';

const STORAGE_KEY = 'spoty_customization_v1';

const getInitialState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
};

const saved = { ...DEFAULT_CUSTOMIZATION, ...getInitialState() };

let saveTimer: any = null;
let isApplyingRemote = false;

export const useCustomizationStore = create<CustomizationState>((set, get) => {
  const persist = (partial: Partial<CustomizationState>) => {
    try {
      const current = {
        theme: get().theme,
        coverFilter: get().coverFilter,
        glassMode: get().glassMode,
        glassOpacity: get().glassOpacity,
        glassBlur: get().glassBlur,
        bgType: get().bgType,
        videoPresetId: get().videoPresetId,
        customBgUrl: get().customBgUrl,
        bgDim: get().bgDim,
        bgScale: get().bgScale,
        bgFit: get().bgFit,
        savedBgUrls: get().savedBgUrls,
        playerStyle: get().playerStyle,
        sliderStyle: get().sliderStyle,
        seekbarThumb: get().seekbarThumb,
        customThumbUrl: get().customThumbUrl,
        titleAlign: get().titleAlign,
        showArtistAvatar: get().showArtistAvatar,
        showQueueInPlayer: get().showQueueInPlayer,
        navStyle: get().navStyle,
        ...partial,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

      // Auto-sync changes to backend so other connected devices (mobile/browser) receive them
      if (!isApplyingRemote) {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          api.saveCustomization(current)
            .then((res) => {
              if (res && res.updated_at) {
                set({ lastSyncedAt: res.updated_at });
              }
            })
            .catch(() => {});
        }, 250);
      }
    } catch (e) {}
  };

  return {
    lastSyncedAt: 0,
    theme: saved.theme || 'neutral',
    adaptiveAccent: '#1DB954',
    adaptiveGlow: 'rgba(29, 185, 84, 0.35)',
    coverFilter: saved.coverFilter || 'none',

    glassMode: saved.glassMode || 'glass',
    glassOpacity: typeof saved.glassOpacity === 'number' ? saved.glassOpacity : 82,
    glassBlur: typeof saved.glassBlur === 'number' ? saved.glassBlur : 18,

    bgType: saved.bgType || 'none',
    videoPresetId: saved.videoPresetId || 'cat_sakura_pixel',
    customBgUrl: saved.customBgUrl || '',
    bgDim: typeof saved.bgDim === 'number' ? saved.bgDim : 0,
    bgScale: typeof saved.bgScale === 'number' ? saved.bgScale : 80,
    bgFit: saved.bgFit === 'ambient' ? 'cover' : (saved.bgFit || 'cover'),
    bgMobileEffect: saved.bgMobileEffect || 'none',
    bgPosition: saved.bgPosition || 'center',
    bgBlur: typeof saved.bgBlur === 'number' ? Math.max(0, Math.min(24, saved.bgBlur)) : 0,
    savedBgUrls: Array.isArray(saved.savedBgUrls) && saved.savedBgUrls.length > 0 ? saved.savedBgUrls : [
      {
        id: 'frogs_default',
        url: 'https://images.steamusercontent.com/ugc/15710700078111171397/8EA94A77D4518E087CAD9E2C7A56AB770739261E/',
        title: 'Fishing Frogs by Abi Toads',
        type: 'steam' as const,
        previewUrl: 'https://images.steamusercontent.com/ugc/15710700078111171397/8EA94A77D4518E087CAD9E2C7A56AB770739261E/',
        createdAt: Date.now(),
      }
    ],

    playerStyle: saved.playerStyle || 'classic',
    sliderStyle: saved.sliderStyle || 'classic',
    seekbarThumb: normalizeSeekbarThumb(saved.seekbarThumb),
    customThumbUrl: saved.customThumbUrl || '',
    titleAlign: saved.titleAlign || 'center',
    showArtistAvatar: saved.showArtistAvatar !== undefined ? saved.showArtistAvatar : true,
    showQueueInPlayer: saved.showQueueInPlayer !== undefined ? saved.showQueueInPlayer : false,

    navStyle: saved.navStyle || 'floating',

    applyRemoteCustomization: (remote: Partial<CustomizationState>, updatedAt: number) => {
      isApplyingRemote = true;
      try {
        set((state) => ({
          ...state,
          ...remote,
          seekbarThumb: normalizeSeekbarThumb(remote.seekbarThumb ?? state.seekbarThumb),
          lastSyncedAt: updatedAt,
        }));
        const current = {
          theme: get().theme,
          coverFilter: get().coverFilter,
          glassMode: get().glassMode,
          glassOpacity: get().glassOpacity,
          glassBlur: get().glassBlur,
          bgType: get().bgType,
          videoPresetId: get().videoPresetId,
          customBgUrl: get().customBgUrl,
          bgDim: get().bgDim,
          bgScale: get().bgScale,
          bgFit: get().bgFit,
          bgMobileEffect: get().bgMobileEffect,
          bgPosition: get().bgPosition,
          bgBlur: get().bgBlur,
          savedBgUrls: get().savedBgUrls,
          playerStyle: get().playerStyle,
          sliderStyle: get().sliderStyle,
          seekbarThumb: get().seekbarThumb,
          customThumbUrl: get().customThumbUrl,
          titleAlign: get().titleAlign,
          showArtistAvatar: get().showArtistAvatar,
          showQueueInPlayer: get().showQueueInPlayer,
          navStyle: get().navStyle,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } finally {
        setTimeout(() => {
          isApplyingRemote = false;
        }, 150);
      }
    },

    setTheme: (theme) => {
      persist({ theme });
      set({ theme });
    },

    setAdaptiveColors: (accent, glow) => {
      set({ adaptiveAccent: accent, adaptiveGlow: glow });
    },

    setCoverFilter: (coverFilter) => {
      persist({ coverFilter });
      set({ coverFilter });
    },

    setGlassMode: (glassMode) => {
      persist({ glassMode });
      set({ glassMode });
    },

    setGlassOpacity: (glassOpacity) => {
      persist({ glassOpacity });
      set({ glassOpacity });
    },

    setGlassBlur: (glassBlur) => {
      persist({ glassBlur });
      set({ glassBlur });
    },

    setBgType: (bgType) => {
      persist({ bgType });
      set({ bgType });
    },

    setVideoPresetId: (videoPresetId) => {
      persist({ videoPresetId });
      set({ videoPresetId });
    },

    setCustomBgUrl: (customBgUrl) => {
      persist({ customBgUrl });
      set({ customBgUrl });
    },

    setBgDim: (bgDim) => {
      persist({ bgDim });
      set({ bgDim });
    },

    setBgScale: (bgScale) => {
      persist({ bgScale });
      set({ bgScale });
    },

    setBgFit: (bgFit) => {
      persist({ bgFit });
      set({ bgFit });
    },

    setBgMobileEffect: (bgMobileEffect) => {
      persist({ bgMobileEffect });
      set({ bgMobileEffect });
    },

    setBgPosition: (bgPosition) => {
      persist({ bgPosition });
      set({ bgPosition });
    },

    setBgBlur: (bgBlur) => {
      persist({ bgBlur });
      set({ bgBlur });
    },

    addSavedBgUrl: (item) => {
      const list = get().savedBgUrls || [];
      const cleanUrl = item.url.trim();
      if (!cleanUrl) return;
      const existingIndex = list.findIndex((x) => x.url.trim() === cleanUrl);
      let nextList: SavedBgItem[];
      const newItem: SavedBgItem = {
        id: item.id || `bg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: cleanUrl,
        title: item.title?.trim() || (item.type === 'steam' ? 'Steam Workshop' : 'Пользовательский фон'),
        type: item.type,
        previewUrl: item.previewUrl || (item.type === 'steam' || item.type === 'image' ? cleanUrl : undefined),
        createdAt: Date.now(),
      };

      if (existingIndex >= 0) {
        nextList = [...list];
        nextList[existingIndex] = { ...nextList[existingIndex], ...newItem };
      } else {
        nextList = [newItem, ...list];
      }
      persist({ savedBgUrls: nextList });
      set({ savedBgUrls: nextList });
    },

    removeSavedBgUrl: (id) => {
      const list = (get().savedBgUrls || []).filter((x) => x.id !== id);
      persist({ savedBgUrls: list });
      set({ savedBgUrls: list });
    },

    setPlayerStyle: (playerStyle) => {
      persist({ playerStyle });
      set({ playerStyle });
    },

    setSliderStyle: (sliderStyle) => {
      persist({ sliderStyle });
      set({ sliderStyle });
    },

    setSeekbarThumb: (seekbarThumb) => {
      seekbarThumb = normalizeSeekbarThumb(seekbarThumb);
      persist({ seekbarThumb });
      set({ seekbarThumb });
    },

    setCustomThumbUrl: (customThumbUrl) => {
      persist({ customThumbUrl });
      set({ customThumbUrl });
    },

    setTitleAlign: (titleAlign) => {
      persist({ titleAlign });
      set({ titleAlign });
    },

    setShowArtistAvatar: (showArtistAvatar) => {
      persist({ showArtistAvatar });
      set({ showArtistAvatar });
    },

    setShowQueueInPlayer: (showQueueInPlayer) => {
      persist({ showQueueInPlayer });
      set({ showQueueInPlayer });
    },

    setNavStyle: (navStyle) => {
      persist({ navStyle });
      set({ navStyle });
    },

    resetAll: () => {
      const defaults: Partial<CustomizationState> = {
        coverFilter: 'none',
        customBgUrl: '',
        seekbarThumb: 'classic',
        customThumbUrl: '',
        ...DEFAULT_CUSTOMIZATION,
      };
      persist(defaults);
      set(defaults as CustomizationState);
    },
  };
});

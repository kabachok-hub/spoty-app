import { SoundOptions } from './SoundOptions';
import { CanvasSettings } from './CanvasSettings';
import { GeneralSettings } from './GeneralSettings';
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Globe,
  Check,
  Shield,
  Sliders,
  BarChart3,
  Sparkles,
  Palette,
  Layers,
  Disc,
  Layout,
  Tv,
  Eye,
  SlidersHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sun,
  Video,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Search,
  Loader2,
  Trash2,
  Key,
  Gamepad2,
  FolderOpen,
  BookmarkPlus,
  Star,
  ChevronLeft,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { api } from '../../api/client';
import { useSettingsStore, EQUALIZER_PRESETS } from '../../store/settingsStore';
import { openBackgroundPlaybackHelp } from '../player/BackgroundPlaybackHelp';
import { mobileMiniAppPlatform } from '../../hooks/playbackDiagnostics';
import { AppearancePresets } from './AppearancePresets';
import { openTasteSetup } from '../onboarding/TasteSetup';
import {
  useCustomizationStore,
  THEME_PRESETS,
  VIDEO_PRESETS,
  ThemeId,
  CoverFilter,
  PlayerStyle,
  SliderStyle,
  SeekbarThumbType,
  TitleAlign,
  NavStyle,
  BgType,
} from '../../store/customizationStore';
import { useUserStore } from '../../store/userStore';
import { useNavigationStore } from '../../store/navigationStore';
import { Language } from '../../i18n/translations';
import { useTelegram } from '../../hooks/useTelegram';
import { EqualizerModal } from './EqualizerModal';
import { PerformanceSettings } from './PerformanceSettings';
import { extractYouTubeId } from '../layout/LiveBackground';

type SettingsTab = 'general' | 'appearance' | 'background' | 'player' | 'tabs' | 'audio';

const CustomSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '', onChange }) => {
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
        <span>{label}</span>
        <span className="font-mono text-white bg-white/10 border border-white/10 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-sm">
          {value}{unit}
        </span>
      </div>
      <div className="relative flex items-center h-6">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="spoty-slider"
          style={{
            background: `linear-gradient(to right, var(--accent-color, #1DB954) 0%, var(--accent-color, #1DB954) ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%, rgba(255, 255, 255, 0.2) 100%)`,
          }}
        />
      </div>
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const isOpen = useSettingsStore((state) => state.isSettingsOpen);
  const setOpen = useSettingsStore((state) => state.setSettingsOpen);
  const setAdminOpen = useSettingsStore((state) => state.setAdminOpen);
  const user = useUserStore((state) => state.user);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const t = useSettingsStore((state) => state.t);
  const { haptic, setupBackButton } = useTelegram();

  // Customization Store State
  const theme = useCustomizationStore((state) => state.theme);
  const setTheme = useCustomizationStore((state) => state.setTheme);
  const coverFilter = useCustomizationStore((state) => state.coverFilter);
  const setCoverFilter = useCustomizationStore((state) => state.setCoverFilter);

  const glassMode = useCustomizationStore((state) => state.glassMode);
  const setGlassMode = useCustomizationStore((state) => state.setGlassMode);
  const glassOpacity = useCustomizationStore((state) => state.glassOpacity);
  const setGlassOpacity = useCustomizationStore((state) => state.setGlassOpacity);
  const glassBlur = useCustomizationStore((state) => state.glassBlur);
  const setGlassBlur = useCustomizationStore((state) => state.setGlassBlur);

  const bgType = useCustomizationStore((state) => state.bgType);
  const setBgType = useCustomizationStore((state) => state.setBgType);
  const videoPresetId = useCustomizationStore((state) => state.videoPresetId);
  const setVideoPresetId = useCustomizationStore((state) => state.setVideoPresetId);
  const customBgUrl = useCustomizationStore((state) => state.customBgUrl);
  const setCustomBgUrl = useCustomizationStore((state) => state.setCustomBgUrl);
  const bgDim = useCustomizationStore((state) => state.bgDim);
  const setBgDim = useCustomizationStore((state) => state.setBgDim);
  const bgFit = useCustomizationStore((state) => state.bgFit);
  const setBgFit = useCustomizationStore((state) => state.setBgFit);
  const savedBgUrls = useCustomizationStore((state) => state.savedBgUrls);
  const addSavedBgUrl = useCustomizationStore((state) => state.addSavedBgUrl);
  const removeSavedBgUrl = useCustomizationStore((state) => state.removeSavedBgUrl);
  const bgMobileEffect = useCustomizationStore((state) => state.bgMobileEffect);
  const setBgMobileEffect = useCustomizationStore((state) => state.setBgMobileEffect);
  const bgPosition = useCustomizationStore((state) => state.bgPosition);
  const setBgPosition = useCustomizationStore((state) => state.setBgPosition);
  const bgBlur = useCustomizationStore((state) => state.bgBlur);
  const setBgBlur = useCustomizationStore((state) => state.setBgBlur);

  const playerStyle = useCustomizationStore((state) => state.playerStyle);
  const setPlayerStyle = useCustomizationStore((state) => state.setPlayerStyle);
  const sliderStyle = useCustomizationStore((state) => state.sliderStyle);
  const setSliderStyle = useCustomizationStore((state) => state.setSliderStyle);
  const seekbarThumb = useCustomizationStore((state) => state.seekbarThumb);
  const setSeekbarThumb = useCustomizationStore((state) => state.setSeekbarThumb);
  const customThumbUrl = useCustomizationStore((state) => state.customThumbUrl);
  const setCustomThumbUrl = useCustomizationStore((state) => state.setCustomThumbUrl);
  const thumbFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setCustomThumbUrl(dataUrl);
          setSeekbarThumb('custom');
          haptic.notification('success');
        }
      };
      img.src = loadEvt.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const titleAlign = useCustomizationStore((state) => state.titleAlign);
  const setTitleAlign = useCustomizationStore((state) => state.setTitleAlign);
  const showArtistAvatar = useCustomizationStore((state) => state.showArtistAvatar);
  const setShowArtistAvatar = useCustomizationStore((state) => state.setShowArtistAvatar);

  const navStyle = useCustomizationStore((state) => state.navStyle);
  const setNavStyle = useCustomizationStore((state) => state.setNavStyle);

  const bgCatNavRef = useRef<HTMLDivElement | null>(null);

  const scrollCatNav = (direction: 'left' | 'right') => {
    haptic.selection();
    if (bgCatNavRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      bgCatNavRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  useEffect(() => {
    const showUpdates = () => setActiveTab('general');
    window.addEventListener('spoty-open-updates', showUpdates);
    return () => window.removeEventListener('spoty-open-updates', showUpdates);
  }, []);
  const [isEqModalOpen, setIsEqModalOpen] = useState(false);
  const openStats = useNavigationStore((state) => state.openStats);
  const crossfadeSeconds = useSettingsStore((state) => state.crossfadeSeconds);
  const setCrossfadeSeconds = useSettingsStore((state) => state.setCrossfadeSeconds);
  const equalizerPreset = useSettingsStore((state) => state.equalizerPreset);

  // Background & Wallpaper Subtabs & Search
  const [bgCategory, setBgCategory] = useState<'video' | 'wallpapers' | 'upload' | 'canvas' | 'custom_url' | 'none'>('video');
  const [wallpaperQuery, setWallpaperQuery] = useState('');
  const [wallpapers, setWallpapers] = useState<Array<{ id: string; url: string; thumb: string; resolution: string }>>([]);
  const [isLoadingWallpapers, setIsLoadingWallpapers] = useState(false);
  const [wallhavenApiKey, setWallhavenApiKey] = useState(() => {
    try {
      return localStorage.getItem('wallhaven_api_key') || '';
    } catch {
      return '';
    }
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadWallpapers = async (query: string = '') => {
    setIsLoadingWallpapers(true);
    try {
      const res = await api.searchWallpapers(query || 'winter night', 1, 'toplist', wallhavenApiKey || undefined);
      setWallpapers(res.wallpapers || []);
    } catch (e) {
      console.error('Failed to load wallpapers:', e);
    } finally {
      setIsLoadingWallpapers(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024 * 1024) {
      setUploadError('Файл слишком большой. Максимальный размер 250 МБ');
      return;
    }

    setIsUploadingBg(true);
    setUploadError(null);
    haptic.impact('medium');

    try {
      const res = await api.uploadCustomBackground(file);
      if (res && res.url) {
        setCustomBgUrl(res.url);
        setBgType('custom_url');
        const cleanTitle = res.title || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        addSavedBgUrl({
          url: res.url,
          title: cleanTitle,
          type: res.is_video ? 'video' : 'image',
          previewUrl: res.preview_url || res.url,
        });
        haptic.notification('success');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err?.response?.data?.detail || 'Ошибка загрузки файла на сервер');
      haptic.notification('error');
    } finally {
      setIsUploadingBg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveApiKey = (key: string) => {
    setWallhavenApiKey(key);
    try {
      localStorage.setItem('wallhaven_api_key', key);
    } catch {}
  };

  const [isConvertingYt, setIsConvertingYt] = useState(false);
  const [convertYtError, setConvertYtError] = useState<string | null>(null);
  const [isResolvingYt, setIsResolvingYt] = useState(false);
  const [ytSuccessInfo, setYtSuccessInfo] = useState<{
    video_id: string;
    title: string;
    preview_url: string;
    is_cached: boolean;
    url: string | null;
  } | null>(null);

  const handleResolveYouTube = async (urlToResolve?: string) => {
    const targetUrl = (urlToResolve || customBgUrl).trim();
    if (!targetUrl || !targetUrl.includes('youtu')) return;
    setIsResolvingYt(true);
    setConvertYtError(null);
    try {
      const res = await api.resolveYouTube(targetUrl);
      if (res) {
        setYtSuccessInfo({
          video_id: res.video_id,
          title: res.title,
          preview_url: res.preview_url,
          is_cached: res.is_cached,
          url: res.url,
        });
        // If already cached on server, switch to the MP4 immediately
        if (res.is_cached && res.url) {
          setCustomBgUrl(res.url);
          setBgType('custom_url');
        }
      }
    } catch (e) {
      console.warn('YT resolve failed:', e);
    } finally {
      setIsResolvingYt(false);
    }
  };

  const handleConvertYoutube = async () => {
    const ytUrl = customBgUrl.trim();
    if (!ytUrl || !ytUrl.includes('youtu')) return;
    setIsConvertingYt(true);
    setConvertYtError(null);
    haptic.impact('medium');

    try {
      const res = await api.convertYoutubeBackground(ytUrl);
      if (res && res.url) {
        setCustomBgUrl(res.url);
        setBgType('custom_url');
        if (res.title || res.preview_url) {
          setYtSuccessInfo((prev) => prev
            ? { ...prev, is_cached: true, url: res.url }
            : { video_id: '', title: res.title || 'YouTube видео', preview_url: res.preview_url || '', is_cached: true, url: res.url }
          );
        }
        haptic.notification('success');
      }
    } catch (err: any) {
      console.error('Convert YouTube failed:', err);
      setConvertYtError(err?.response?.data?.detail || 'Не удалось скачать видео. Проверьте ссылку.');
      haptic.notification('error');
    } finally {
      setIsConvertingYt(false);
    }
  };

  const [isResolvingSteam, setIsResolvingSteam] = useState(false);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [steamSuccessInfo, setSteamSuccessInfo] = useState<{
    title: string;
    workshop_id: string;
    url: string;
    preview_url?: string;
    is_animated: boolean;
    local_path: string;
  } | null>(null);

  const handleResolveSteam = async (urlToResolve?: string) => {
    const targetUrl = (urlToResolve || customBgUrl).trim();
    if (!targetUrl || !targetUrl.includes('steamcommunity.com')) return;
    setIsResolvingSteam(true);
    setSteamError(null);
    haptic.impact('medium');

    try {
      const res = await api.resolveSteamWorkshop(targetUrl);
      if (res && res.url) {
        setCustomBgUrl(res.url);
        setBgType('custom_url');
        setSteamSuccessInfo({
          title: res.title,
          workshop_id: res.workshop_id,
          url: res.url,
          preview_url: res.preview_url,
          is_animated: res.is_animated,
          local_path: res.local_path,
        });
        haptic.notification('success');
      }
    } catch (err: any) {
      console.error('Steam resolve failed:', err);
      setSteamError(err?.response?.data?.detail || 'Не удалось распознать элемент Steam Workshop. Проверьте ссылку.');
      haptic.notification('error');
    } finally {
      setIsResolvingSteam(false);
    }
  };

  const isCurrentBgSaved = savedBgUrls.some(
    (item) => item.url.trim().toLowerCase() === customBgUrl.trim().toLowerCase()
  );

  const handleSaveBgLink = () => {
    const trimmed = customBgUrl.trim();
    if (!trimmed) return;
    haptic.impact('medium');

    let title = 'Пользовательский фон';
    let type: 'steam' | 'youtube' | 'video' | 'image' = 'video';

    if (steamSuccessInfo && steamSuccessInfo.title) {
      title = steamSuccessInfo.title;
      type = 'steam';
    } else if (trimmed.includes('steamcommunity.com') || trimmed.includes('steamusercontent.com')) {
      title = 'Steam Workshop фон';
      type = 'steam';
    } else if (trimmed.includes('youtu')) {
      title = 'YouTube видео';
      type = 'youtube';
    } else if (trimmed.match(/\.(png|jpg|jpeg|webp|gif)/i)) {
      title = 'Изображение';
      type = 'image';
    } else if (trimmed.includes('/videos/')) {
      const match = trimmed.match(/\/([^\/?#]+)\.mp4/);
      if (match) title = match[1].replace(/_/g, ' ');
    }

    // Use resolved YouTube info if available
    let previewUrl: string | undefined =
      steamSuccessInfo?.preview_url || (type === 'steam' || type === 'image' ? trimmed : undefined);

    if (type === 'youtube' && ytSuccessInfo) {
      title = ytSuccessInfo.title || title;
      previewUrl = ytSuccessInfo.preview_url || undefined;
    }

    addSavedBgUrl({
      url: trimmed,
      title,
      type,
      previewUrl,
    });

    haptic.notification('success');
  };

  useEffect(() => {
    if (isOpen) {
      const cleanup = setupBackButton(true, () => {
        haptic.impact('light');
        setOpen(false);
      });
      return cleanup;
    }
  }, [isOpen, setupBackButton, setOpen, haptic]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('.spoty-settings-panel');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,a[href]') || []).filter(e => e.getClientRects().length > 0);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (isEqModalOpen) setIsEqModalOpen(false); else setOpen(false); event.stopPropagation(); }
      if (event.key !== 'Tab' || isEqModalOpen) return;
      const list = controls(), first = list[0], last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [isOpen, isEqModalOpen, setOpen]);

  if (!isOpen) return null;

  const handleLangSelect = (lang: Language) => {
    haptic.selection();
    setLanguage(lang);
  };

  const handleOpenBrowser = () => {
    haptic.impact('medium');
    const url = window.location.origin;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const tabsConfig = [
    { id: 'general' as SettingsTab, label: 'Основные', icon: Sliders, description: 'Аккаунт, язык и обновления' },
    { id: 'appearance' as SettingsTab, label: 'Внешний вид', description: 'Темы, эффекты и нагрузка на систему', icon: Palette },
    { id: 'background' as SettingsTab, label: 'Фон и прозрачность', description: 'Обои, видео и стеклянные поверхности', icon: Layers },
    { id: 'player' as SettingsTab, label: 'Плеер', description: 'Обложки и элементы управления', icon: Disc },
    { id: 'tabs' as SettingsTab, label: 'Навигация', description: 'Расположение и стиль вкладок', icon: Layout },
    { id: 'audio' as SettingsTab, label: 'Звук', description: 'Эквалайзер и переходы между треками', icon: Sliders },
  ];

  return (
    <div
      onClick={() => {
        haptic.impact('light');
        setOpen(false);
      }}
      className="spoty-settings-backdrop fixed inset-0 z-50 flex items-stretch justify-start bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="spoty-settings-title"
        className="spoty-settings-panel w-full sm:w-[500px] md:w-[540px] max-w-[92vw] h-full h-[100dvh] glass-surface border-r border-white/15 sm:rounded-r-3xl shadow-2xl shadow-black/90 text-white animate-slide-in-left flex flex-col overflow-hidden select-none safe-top safe-bottom"
      >
        {/* Sticky Header with Title and Close Button */}
        <div className="spoty-settings-header flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--accent-color, #1DB954)' }} />
            <h2 id="spoty-settings-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
              Настройки
            </h2>
          </div>
          <button
            onClick={() => {
              haptic.impact('light');
              setOpen(false);
            }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="spoty-settings-layout flex flex-col min-h-0 flex-1">
        <label className="spoty-settings-mobile-nav">Раздел
          <select value={activeTab} onChange={e => setActiveTab(e.target.value as SettingsTab)} aria-label="Раздел настроек">
            {tabsConfig.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div aria-label="Разделы настроек" className="spoty-settings-tabs flex items-center gap-1 px-4 py-2 bg-black/30 border-b border-white/10 overflow-x-auto no-scrollbar flex-shrink-0">
          {tabsConfig.map((tItem) => {
            const Icon = tItem.icon;
            const isActive = activeTab === tItem.id;
            return (
              <button
                key={tItem.id}
                aria-pressed={isActive}
                onClick={() => {
                  haptic.selection();
                  setActiveTab(tItem.id);
                  document.querySelector('.spoty-settings-content')?.scrollTo(0, 0);
                }}
                className={`min-h-11 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm border border-white/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
                style={{
                  color: isActive ? 'var(--accent-color, #ffffff)' : undefined,
                }}
              >
                <Icon size={14} />
                <span>{tItem.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Container */}
        <div className="spoty-settings-content flex-1 overflow-y-auto overscroll-contain p-5 space-y-6 no-scrollbar touch-pan-y">
          <div className="spoty-settings-section-heading"><h3>{tabsConfig.find(item => item.id === activeTab)?.label}</h3><p>{tabsConfig.find(item => item.id === activeTab)?.description}</p></div>
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'general' && mobileMiniAppPlatform() && <button onClick={openBackgroundPlaybackHelp} className="min-h-11 text-sm text-emerald-400">Музыка с выключенным экраном — инструкция</button>}

          {activeTab === 'appearance' && <><PerformanceSettings /><AppearancePresets /></>}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: ВИД И ТЕМЫ (Appearance & Themes)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Preset Themes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <Palette size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                    <span>Цветовая схема (Тема)</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">13 стилей</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {(Object.keys(THEME_PRESETS) as ThemeId[]).map((tid) => {
                    const cfg = THEME_PRESETS[tid];
                    const isSelected = theme === tid;
                    return (
                      <button
                        key={tid}
                        onClick={() => {
                          haptic.selection();
                          setTheme(tid);
                        }}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all active:scale-95 ${
                          isSelected
                            ? 'border-white bg-white/15 shadow-md shadow-white/10 scale-[1.02]'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 w-full">
                          <span className="text-base">{cfg.emoji}</span>
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm"
                            style={{ backgroundColor: cfg.accent }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-white/90 truncate max-w-full">
                          {cfg.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cover Filter Effects */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  <Eye size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Эффект обложки трека</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'none', label: 'Оригинал' },
                      { id: 'blur', label: 'Размытие' },
                      { id: 'grayscale', label: 'Черно-белый' },
                      { id: 'sepia', label: 'Сепия' },
                      { id: 'contrast', label: 'Контраст' },
                      { id: 'invert', label: 'Инверсия' },
                    ] as { id: CoverFilter; label: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        haptic.selection();
                        setCoverFilter(f.id);
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition active:scale-95 ${
                        coverFilter === f.id
                          ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: ФОН И СТЕКЛО (Glassmorphism & Live Backgrounds)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'background' && (
            <div className="space-y-6">
              {/* Glassmorphism Mode */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <Layers size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                    <span>Эффект стекла (Glassmorphism)</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { id: 'off', label: 'Выключено' },
                    { id: 'normal', label: 'Обычная' },
                    { id: 'glass', label: 'Матовое стекло' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        haptic.selection();
                        setGlassMode(m.id as any);
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition active:scale-95 ${
                        glassMode === m.id
                          ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {glassMode === 'glass' && (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <CustomSlider
                      label="Непрозрачность подложки"
                      value={glassOpacity}
                      min={35}
                      max={100}
                      unit="%"
                      onChange={setGlassOpacity}
                    />

                    <CustomSlider
                      label="Сила размытия (Blur)"
                      value={glassBlur}
                      min={0}
                      max={32}
                      unit="px"
                      onChange={setGlassBlur}
                    />
                  </div>
                )}
              </div>

              {/* Background Selection Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <Video size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                    <span>Фон приложения (Wallpaper Engine / HD)</span>
                  </div>
                </div>

                {/* Subcategory Pill Navigation with Carousel Arrows and Mouse Wheel */}
                <div className="relative flex items-center mb-4">
                  <button
                    type="button"
                    onClick={() => scrollCatNav('left')}
                    aria-label="Прокрутить влево"
                    className="absolute -left-2 z-10 w-7 h-7 rounded-full bg-black/85 hover:bg-black border border-white/20 text-white flex items-center justify-center shadow-lg transition active:scale-90"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div
                    ref={bgCatNavRef}
                    onWheel={(e) => {
                      if (bgCatNavRef.current) {
                        bgCatNavRef.current.scrollLeft += e.deltaY;
                      }
                    }}
                    className="flex items-center gap-1.5 p-1 px-7 bg-white/5 rounded-xl border border-white/10 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x overscroll-contain w-full"
                  >
                    {[
                      { id: 'video', label: '🎬 HD Видео' },
                      { id: 'wallpapers', label: '🖼️ 4K Обои' },
                      { id: 'upload', label: '📁 Загрузить с ПК' },
                      { id: 'canvas', label: '✨ Canvas' },
                      { id: 'custom_url', label: '🔗 Ссылка' },
                      { id: 'none', label: '🚫 Без фона' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={(e) => {
                          haptic.selection();
                          e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          if (cat.id === 'none') {
                            setBgType('none');
                          } else if (cat.id === 'wallpapers') {
                            if (wallpapers.length === 0) loadWallpapers('winter night');
                          }
                          setBgCategory(cat.id as any);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                          (cat.id === 'none' && bgType === 'none') || (cat.id !== 'none' && bgCategory === cat.id && bgType !== 'none')
                            ? 'bg-[var(--accent-color,#1DB954)] text-black shadow font-bold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollCatNav('right')}
                    aria-label="Прокрутить вправо"
                    className="absolute -right-2 z-10 w-7 h-7 rounded-full bg-black/85 hover:bg-black border border-white/20 text-white flex items-center justify-center shadow-lg transition active:scale-90"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* ── 0. NONE (Default Dark Spotify Background) ── */}
                {bgCategory === 'none' && (
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto flex items-center justify-center text-zinc-400">
                      <Sparkles size={22} className="text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white">Стандартный тёмный фон Spotify</h3>
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                        Видео и обои отключены. Используется классический минималистичный тёмный интерфейс с максимальной производительностью.
                      </p>
                    </div>
                    <div className="pt-2 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          setBgCategory('video');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-zinc-300 font-medium transition active:scale-95"
                      >
                        🎬 Выбрать видео
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          setBgCategory('custom_url');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--accent-color,#1DB954)] text-black text-xs font-bold transition active:scale-95 shadow"
                      >
                        🔗 Вставить ссылку
                      </button>
                    </div>
                  </div>
                )}

                {/* ── 1. HD VIDEO PRESETS ── */}
                {bgCategory === 'video' && (
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Full HD видео-петли (60 FPS):</span>
                      <span className="text-[10px] text-zinc-500 font-normal">без сжатия и значков</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {VIDEO_PRESETS.map((vp) => {
                        const isSelected = bgType === 'video_preset' && videoPresetId === vp.id;
                        return (
                          <button
                            key={vp.id}
                            onClick={() => {
                              haptic.selection();
                              setBgType('video_preset');
                              setVideoPresetId(vp.id);
                            }}
                            className={`relative rounded-2xl overflow-hidden border text-left p-2.5 flex flex-col justify-end aspect-video transition active:scale-95 group ${
                              isSelected
                                ? 'border-[var(--accent-color,#1DB954)] ring-2 ring-[var(--accent-color,#1DB954)]/40 shadow-lg'
                                : 'border-white/15 hover:border-white/30'
                            }`}
                          >
                            <img
                              src={vp.previewUrl}
                              alt={vp.name}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                            <div className="relative z-10">
                              <span className="text-xs font-bold text-white block">{vp.name}</span>
                              <span className="text-[10px] text-zinc-300 line-clamp-1">{vp.desc}</span>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--accent-color,#1DB954)] flex items-center justify-center text-black shadow">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── 2. 4K WALLHAVEN WALLPAPERS CATALOG ── */}
                {bgCategory === 'wallpapers' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={wallpaperQuery}
                          onChange={(e) => setWallpaperQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && loadWallpapers(wallpaperQuery)}
                          placeholder="Поиск 4K обоев (зима, киберпанк, аниме...)"
                          className="w-full bg-black/40 border border-white/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent-color,#1DB954)]"
                        />
                        <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                      </div>
                      <button
                        onClick={() => {
                          haptic.selection();
                          loadWallpapers(wallpaperQuery);
                        }}
                        disabled={isLoadingWallpapers}
                        className="px-3.5 py-2 rounded-xl bg-[var(--accent-color,#1DB954)] text-black font-bold text-xs hover:brightness-110 transition active:scale-95 disabled:opacity-50"
                      >
                        {isLoadingWallpapers ? <Loader2 size={14} className="animate-spin" /> : 'Найти'}
                      </button>
                    </div>

                    {/* Quick Tag Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { label: '🔥 Топ 4K', q: '' },
                        { label: '❄️ Зимняя ночь', q: 'winter night snow' },
                        { label: '🏙️ Киберпанк', q: 'cyberpunk neon' },
                        { label: '🌸 Аниме', q: 'anime aesthetic' },
                        { label: '🌌 Космос', q: 'space galaxy stars' },
                        { label: '🏎️ Авто', q: 'supercar drift' },
                        { label: '🌿 Природа', q: 'landscape nature' },
                        { label: '☕ Lo-Fi', q: 'lo-fi chill' },
                        { label: '🎧 Музыка', q: 'music synthwave' },
                      ].map((tag) => (
                        <button
                          key={tag.label}
                          onClick={() => {
                            haptic.selection();
                            setWallpaperQuery(tag.q);
                            loadWallpapers(tag.q);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-300 hover:text-white whitespace-nowrap transition active:scale-95 border border-white/10"
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>

                    {/* Wallpapers Grid */}
                    {isLoadingWallpapers ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                        <Loader2 size={24} className="animate-spin text-[var(--accent-color,#1DB954)]" />
                        <span className="text-xs">Загрузка 4K каталога...</span>
                      </div>
                    ) : wallpapers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {wallpapers.map((w) => {
                          const isSelected = bgType === 'custom_url' && customBgUrl === w.url;
                          return (
                            <button
                              key={w.id}
                              onClick={() => {
                                haptic.notification('success');
                                setCustomBgUrl(w.url);
                                setBgType('custom_url');
                              }}
                              className={`relative rounded-xl overflow-hidden border aspect-video text-left group transition active:scale-95 ${
                                isSelected
                                  ? 'border-[var(--accent-color,#1DB954)] ring-2 ring-[var(--accent-color,#1DB954)]/40 shadow-lg'
                                  : 'border-white/10 hover:border-white/30'
                              }`}
                            >
                              <img
                                src={w.thumb}
                                alt="wallpaper"
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono text-white/90">
                                {w.resolution}
                              </div>
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--accent-color,#1DB954)] flex items-center justify-center text-black shadow">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-zinc-400">
                        Обои не найдены. Попробуйте другой запрос или выберите тег сверху.
                      </div>
                    )}

                    {/* API Key Toggle for Wallhaven */}
                    <div className="pt-1">
                      <button
                        onClick={() => setShowApiKeyInput((prev) => !prev)}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1.5 transition"
                      >
                        <Key size={12} />
                        <span>{showApiKeyInput ? 'Скрыть настройки ключа' : 'Ввести свой ключ Wallhaven API (необязательно)'}</span>
                      </button>
                      {showApiKeyInput && (
                        <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="Ваш Wallhaven API ключ..."
                            value={wallhavenApiKey}
                            onChange={(e) => handleSaveApiKey(e.target.value)}
                            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-zinc-400">Сохранено</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── 3. UPLOAD FROM PC / STEAM WALLPAPER ENGINE ── */}
                {bgCategory === 'upload' && (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mp4,.webm,.mov,.gif,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-[var(--accent-color,#1DB954)] bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer transition text-center group"
                    >
                      <div className="w-12 h-12 rounded-full bg-[var(--accent-color,#1DB954)]/15 text-[var(--accent-color,#1DB954)] flex items-center justify-center group-hover:scale-110 transition">
                        {isUploadingBg ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">
                          {isUploadingBg ? 'Загрузка и оптимизация на сервере...' : 'Нажмите, чтобы выбрать файл с ПК'}
                        </span>
                        <span className="text-xs text-zinc-400 mt-1 block">
                          Поддерживаются MP4, WebM, GIF, PNG, JPG (до 250 МБ — включая MoeWalls и Wallpaper Engine)
                        </span>
                      </div>
                    </div>

                    {uploadError && (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        {uploadError}
                      </div>
                    )}

                    {customBgUrl.includes('/uploads/backgrounds/') && bgType === 'custom_url' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--accent-color,#1DB954)]/10 border border-[var(--accent-color,#1DB954)]/30">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white">
                          <Check size={16} className="text-[var(--accent-color,#1DB954)]" />
                          <span>Ваш персональный фон активен</span>
                        </div>
                        <button
                          onClick={() => {
                            haptic.selection();
                            setBgType('none');
                            setCustomBgUrl('');
                          }}
                          className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition"
                        >
                          <Trash2 size={12} />
                          <span>Сбросить</span>
                        </button>
                      </div>
                    )}

                    {/* Saved Uploaded PC Files Grid */}
                    {savedBgUrls.some((item) => item.url.includes('/uploads/backgrounds/')) && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <FolderOpen size={13} className="text-[var(--accent-color,#1DB954)]" />
                            <span>
                              Мои сохранённые видео с ПК ({savedBgUrls.filter((i) => i.url.includes('/uploads/backgrounds/')).length}):
                            </span>
                          </span>
                          <span className="text-[10px] text-zinc-400">Нажмите для переключения</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                          {savedBgUrls
                            .filter((item) => item.url.includes('/uploads/backgrounds/'))
                            .map((item) => {
                              const isSelected =
                                customBgUrl.trim().toLowerCase() === item.url.trim().toLowerCase() &&
                                bgType === 'custom_url';
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    haptic.selection();
                                    setCustomBgUrl(item.url);
                                    setBgType('custom_url');
                                  }}
                                  className={`p-2.5 rounded-xl border cursor-pointer transition active:scale-95 flex items-center justify-between gap-2.5 group ${
                                    isSelected
                                      ? 'bg-[var(--accent-color,#1DB954)]/15 border-[var(--accent-color,#1DB954)] shadow-md shadow-[var(--accent-color,#1DB954)]/10 ring-1 ring-[var(--accent-color,#1DB954)]/30'
                                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {item.previewUrl ? (
                                      <img
                                        src={item.previewUrl}
                                        alt={item.title}
                                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10 shadow-sm"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-zinc-300">
                                        <Video size={18} className="text-[var(--accent-color,#1DB954)]" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-semibold text-white block truncate">
                                        {item.title}
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block truncate font-mono">
                                        {item.type === 'video' ? '🎬 Видео' : '🖼️ Изображение'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {isSelected && (
                                      <div className="w-5 h-5 rounded-full bg-[var(--accent-color,#1DB954)] text-black flex items-center justify-center shadow">
                                        <Check size={12} strokeWidth={3} />
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        haptic.impact('light');
                                        removeSavedBgUrl(item.id);
                                        if (isSelected) {
                                          setBgType('none');
                                          setCustomBgUrl('');
                                        }
                                      }}
                                      className="w-7 h-7 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition"
                                      title="Удалить из сохранённых"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Steam Wallpaper Engine Guide */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 space-y-1.5 leading-relaxed">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Как взять видео из Steam Wallpaper Engine:</span>
                      </div>
                      <p className="text-zinc-400 text-[11px]">
                        1. Откройте проводник Windows и перейдите в папку мастерской Steam:
                      </p>
                      <code className="block p-1.5 rounded bg-black/50 text-[10px] text-emerald-400 select-all font-mono break-all border border-white/5">
                        C:\Program Files (x86)\Steam\steamapps\workshop\content\431960\
                      </code>
                      <p className="text-zinc-400 text-[11px]">
                        2. Внутри каждой папки лежит видеофайл <strong className="text-white">.mp4</strong> или <strong className="text-white">.webm</strong>. Выберите его и загрузите сюда!
                      </p>
                      <p className="text-zinc-400 text-[11px]">
                        3. Видео будет зациклено в фоне через аппаратный HTML5 плеер в 60 FPS без сжатия, без логотипов и без значков паузы!
                      </p>
                    </div>
                  </div>
                )}

                {/* ── 4. CANVAS GENERATIVE ANIMATIONS ── */}
                {bgCategory === 'canvas' && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Генеративные частицы и шейдеры:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'canvas_stars', label: 'Звездное небо', desc: 'Звезды и падающие кометы' },
                        { id: 'canvas_rain', label: 'Дождь (Canvas)', desc: 'Капли и мокрый асфальт' },
                        { id: 'canvas_aurora', label: 'Северное сияние', desc: 'Градиентные переливы' },
                        { id: 'canvas_waves', label: 'Неоновые волны', desc: 'Звуковые синусоиды' },
                      ].map((c) => {
                        const isSelected = bgType === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              haptic.selection();
                              setBgType(c.id as BgType);
                            }}
                            className={`p-3 rounded-xl border text-left transition active:scale-95 ${
                              isSelected
                                ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white shadow'
                                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                            }`}
                          >
                            <span className="text-xs font-bold block">{c.label}</span>
                            <span className="text-[10px] text-zinc-400 block mt-0.5">{c.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── 5. CUSTOM URL / STEAM WORKSHOP / YOUTUBE ── */}
                {bgCategory === 'custom_url' && (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-zinc-200 block">
                          Ссылка на Steam Workshop, YouTube, MP4 или GIF:
                        </label>
                        <span className="text-[10px] text-[var(--accent-color,#1DB954)] font-medium flex items-center gap-1">
                          <Gamepad2 size={12} />
                          <span>Поддержка Steam</span>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="url"
                            placeholder="https://steamcommunity.com/sharedfiles/... или https://youtube.com/..."
                            value={customBgUrl}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomBgUrl(val);
                              setBgType('custom_url');
                              setYtSuccessInfo(null);
                              setSteamSuccessInfo(null);
                              if (val.includes('steamcommunity.com') && (val.includes('id=') || val.includes('/sharedfiles/'))) {
                                handleResolveSteam(val);
                              } else if (val.includes('youtu') && val.length > 20) {
                                handleResolveYouTube(val);
                              }
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData('text');
                              if (pasted.includes('steamcommunity.com') && (pasted.includes('id=') || pasted.includes('/sharedfiles/'))) {
                                setTimeout(() => handleResolveSteam(pasted), 60);
                              } else if (pasted.includes('youtu')) {
                                setTimeout(() => handleResolveYouTube(pasted), 60);
                              }
                            }}
                            className="w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent-color,#1DB954)]"
                          />
                          {(isResolvingSteam || isResolvingYt) && (
                            <div className="absolute right-3 top-2.5 text-[var(--accent-color,#1DB954)] animate-spin">
                              <Loader2 size={15} />
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveBgLink}
                          disabled={!customBgUrl.trim()}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shadow ${
                            isCurrentBgSaved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-[var(--accent-color,#1DB954)] text-black hover:brightness-110'
                          }`}
                        >
                          {isCurrentBgSaved ? (
                            <>
                              <Check size={14} strokeWidth={3} />
                              <span>Сохранено</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus size={14} />
                              <span>Сохранить</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Steam Workshop Action & Card */}
                    {customBgUrl.includes('steamcommunity.com') && !isResolvingSteam && !steamSuccessInfo && (
                      <button
                        type="button"
                        onClick={() => handleResolveSteam(customBgUrl)}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                      >
                        <Gamepad2 size={16} />
                        <span>🎮 Распознать и применить фон из Steam Workshop</span>
                      </button>
                    )}

                    {isResolvingSteam && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-2.5 text-xs text-blue-200">
                        <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />
                        <span>Связываемся со Steam Community и извлекаем живой фон...</span>
                      </div>
                    )}

                    {steamError && (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        {steamError}
                      </div>
                    )}

                    {/* Steam Resolved Success Banner */}
                    {(steamSuccessInfo || (customBgUrl.includes('steamusercontent.com') && bgType === 'custom_url')) && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-950/60 to-black/80 border border-blue-500/30 space-y-2.5 shadow-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                              <Gamepad2 size={14} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block">
                                {steamSuccessInfo?.title || 'Фон из Steam Workshop'}
                              </span>
                              <span className="text-[10px] text-blue-300">
                                {steamSuccessInfo?.is_animated !== false ? '✨ Живой анимированный фон (Steam CDN)' : '🖼️ HD Обои'}
                              </span>
                            </div>
                          </div>
                          <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
                            <Check size={11} strokeWidth={3} />
                            <span>Применён</span>
                          </div>
                        </div>

                        {/* Local 4K MP4 Tip */}
                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-zinc-300 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <Sparkles size={12} className="text-amber-400" />
                            <span>Хотите оригинальный 4K/60 FPS видеофайл?</span>
                          </div>
                          <p className="text-zinc-400 text-[10px] leading-relaxed">
                            Wallpaper Engine сохранил оригинальное видео на вашем диске в папке:
                          </p>
                          <code className="block p-1.5 rounded bg-black/60 text-[10px] text-cyan-300 font-mono break-all select-all border border-white/5">
                            {steamSuccessInfo?.local_path ||
                              `C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\431960\\${customBgUrl.match(/\d{8,12}/)?.[0] || '...'}`}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setBgCategory('upload');
                              setTimeout(() => fileInputRef.current?.click(), 100);
                            }}
                            className="mt-1 w-full py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/10"
                          >
                            <FolderOpen size={13} className="text-[var(--accent-color,#1DB954)]" />
                            <span>📁 Загрузить 4K видеофайл с диска ПК</span>
                          </button>
                        </div>
                      </div>
                    )}


                    {/* YouTube Resolved Info Card */}
                    {customBgUrl.includes('youtu') && !isResolvingYt && ytSuccessInfo && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-red-950/60 to-black/80 border border-red-500/30 space-y-2.5 shadow-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                              <Video size={14} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">{ytSuccessInfo.title}</span>
                              <span className="text-[10px] text-red-300">
                                {ytSuccessInfo.is_cached ? '✅ Загружен как чистый MP4' : '🎬 YouTube видео (есть значки)'}
                              </span>
                            </div>
                          </div>
                          {ytSuccessInfo.is_cached && (
                            <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30 flex-shrink-0">
                              <Check size={11} strokeWidth={3} />
                              <span>MP4</span>
                            </div>
                          )}
                        </div>

                        {ytSuccessInfo.preview_url && (
                          <img
                            src={ytSuccessInfo.preview_url}
                            alt={ytSuccessInfo.title}
                            className="w-full h-24 object-cover rounded-xl border border-white/10"
                          />
                        )}

                        {!ytSuccessInfo.is_cached && (
                          <button
                            type="button"
                            onClick={handleConvertYoutube}
                            disabled={isConvertingYt}
                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50"
                          >
                            {isConvertingYt ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Скачивание и очистка от значков YouTube...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={16} className="text-yellow-300" />
                                <span>⚡ Скачать как чистый MP4 (без значков и паузы)</span>
                              </>
                            )}
                          </button>
                        )}
                        {convertYtError && (
                          <div className="text-xs text-red-400 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            {convertYtError}
                          </div>
                        )}
                      </div>
                    )}

                    {/* YouTube loading spinner (before info resolved) */}
                    {customBgUrl.includes('youtu') && isResolvingYt && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-200">
                        <Loader2 size={16} className="animate-spin text-red-400 flex-shrink-0" />
                        <span>Получаем информацию о YouTube видео...</span>
                      </div>
                    )}

                    {/* YouTube convert button when no resolved info yet */}
                    {customBgUrl.includes('youtu') && !isResolvingYt && !ytSuccessInfo && (
                      <div className="space-y-1.5 pt-1">
                        <button
                          type="button"
                          onClick={handleConvertYoutube}
                          disabled={isConvertingYt}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50"
                        >
                          {isConvertingYt ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Скачивание и очистка от значков YouTube...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} className="text-yellow-300" />
                              <span>⚡ Преобразовать в чистый 60 FPS MP4 (уберёт паузу и значки)</span>
                            </>
                          )}
                        </button>
                        {convertYtError && (
                          <div className="text-xs text-red-400 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            {convertYtError}
                          </div>
                        )}
                      </div>
                    )}


                    {/* ── SAVED BACKGROUND LINKS COLLECTION ── */}
                    {savedBgUrls.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <Star size={13} className="text-amber-400 fill-amber-400" />
                            <span>Мои сохранённые ссылки ({savedBgUrls.length}):</span>
                          </span>
                          <span className="text-[10px] text-zinc-400">Нажмите, чтобы включить</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                          {savedBgUrls.map((item) => {
                            const isSelected =
                              customBgUrl.trim().toLowerCase() === item.url.trim().toLowerCase() &&
                              bgType === 'custom_url';
                            const ytId = extractYouTubeId(item.url);
                            const effectivePreview =
                              item.previewUrl ||
                              (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : undefined) ||
                              (item.type === 'steam' || item.url.includes('steamusercontent') ? item.url : undefined);

                            const displayTitle =
                              item.title && item.title !== 'YouTube видео' && item.title !== 'YouTube ?'
                                ? item.title
                                : ytId
                                ? `YouTube видео (${ytId})`
                                : item.title || 'Пользовательский фон';

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  haptic.selection();
                                  const targetUrl = (item as any).convertedUrl || item.url;
                                  setCustomBgUrl(targetUrl);
                                  setBgType('custom_url');
                                  if (item.url.includes('steamcommunity.com')) {
                                    handleResolveSteam(item.url);
                                  } else if (item.url.includes('youtu') && !(item as any).convertedUrl) {
                                    handleResolveYouTube(item.url);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border cursor-pointer transition active:scale-95 flex items-center justify-between gap-2.5 group ${
                                  isSelected
                                    ? 'bg-[var(--accent-color,#1DB954)]/15 border-[var(--accent-color,#1DB954)] shadow-md shadow-[var(--accent-color,#1DB954)]/10 ring-1 ring-[var(--accent-color,#1DB954)]/30'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {effectivePreview ? (
                                    <img
                                      src={effectivePreview}
                                      alt={displayTitle}
                                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10 shadow-sm"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-zinc-300">
                                      {item.type === 'steam' ? (
                                        <Gamepad2 size={18} className="text-blue-400" />
                                      ) : item.type === 'youtube' ? (
                                        <Video size={18} className="text-red-400" />
                                      ) : (
                                        <Sparkles size={18} className="text-amber-400" />
                                      )}
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-semibold text-white block truncate">
                                      {displayTitle}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 block truncate font-mono">
                                      {item.url.replace(/^https?:\/\//, '')}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-[var(--accent-color,#1DB954)] text-black flex items-center justify-center shadow">
                                      <Check size={12} strokeWidth={3} />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      haptic.impact('light');
                                      removeSavedBgUrl(item.id);
                                    }}
                                    className="w-7 h-7 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition"
                                    title="Удалить из сохранённых"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-zinc-400 leading-relaxed">
                      💡 Совет: Вы можете вставить ссылку на любой предмет из <strong className="text-white">Steam Workshop</strong> (Wallpaper Engine) или видео <strong className="text-white">MP4 / WebM</strong>.
                    </div>

                    <div className="pt-1">
                      <span className="text-[10px] text-zinc-400 font-semibold block mb-1.5 uppercase tracking-wider">
                        Быстрые примеры и HD петли:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            haptic.selection();
                            const url = 'https://steamcommunity.com/sharedfiles/filedetails/?id=3737237256';
                            setCustomBgUrl(url);
                            setBgType('custom_url');
                            handleResolveSteam(url);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-[11px] text-blue-300 hover:text-white transition active:scale-95 border border-blue-500/30 flex items-center gap-1"
                        >
                          <Gamepad2 size={12} />
                          <span>🐸 Steam: Рыбачащие лягушки</span>
                        </button>
                        {[
                          { label: '🐱 Кот на улице сакуры (HD)', url: '/videos/cat_sakura_pixel.mp4' },
                          { label: '🐸 Рыбачащие лягушки (HD)', url: '/videos/fishing_frogs.mp4' },
                          { label: '🟩 Minecraft Bliss (HD)', url: '/videos/bliss_minecraft.mp4' },
                          { label: '🌧️ Дождь в GTA V (HD)', url: '/videos/rainy_gta5.mp4' },
                          { label: '🌙 Ночная сакура (HD)', url: '/videos/night_sakura.mp4' },
                          { label: '🍄 Танец грибочков (HD)', url: '/videos/mushling_dance.mp4' },
                          { label: '🏄 Серебряный сёрфер (HD)', url: '/videos/silver_surfer.mp4' },
                          { label: '🏙️ Киберпанк город (HD)', url: '/videos/cyber_pixel_city.mp4' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setCustomBgUrl(chip.url);
                              setBgType('custom_url');
                              setSteamSuccessInfo(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-300 hover:text-white transition active:scale-95 border border-white/10"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 6. BACKGROUND DIMMER & FIT CONTROLS (Always visible when background is active) ── */}
                {bgType !== 'none' && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3.5">
                    <div>
                      <CustomSlider
                        label="Затемнение фона (Контраст интерфейса)"
                        value={bgDim}
                        min={0}
                        max={90}
                        unit="%"
                        onChange={setBgDim}
                      />
                      <div className="flex items-center gap-1.5 mt-2">
                        {[
                          { val: 0, label: '0% (Без затемнения)' },
                          { val: 15, label: '15%' },
                          { val: 30, label: '30%' },
                          { val: 50, label: '50%' },
                        ].map((chip) => (
                          <button
                            key={chip.val}
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setBgDim(chip.val);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border transition active:scale-95 ${
                              bgDim === chip.val
                                ? 'bg-[var(--accent-color,#1DB954)]/20 border-[var(--accent-color,#1DB954)] text-white shadow'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Quality / Screen Fit Selector */}
                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Масштабирование и качество
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {bgFit === 'cover' ? 'На весь экран 1080p' : bgFit === 'contain' ? '1:1 Без обрезки' : 'Ambient'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'cover', label: '🖼️ Заполнить', desc: 'На весь экран (1080p чётко)' },
                          { id: 'contain', label: '📐 100% В кадре', desc: 'Оригинал без обрезки' },
                          { id: 'ambient', label: '🌌 Ambient', desc: 'Чёткий центр + мягкий фон' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setBgFit(f.id as any);
                            }}
                            className={`p-2 rounded-xl border text-center transition active:scale-95 ${
                              bgFit === f.id
                                ? 'bg-[var(--accent-color,#1DB954)]/20 border-[var(--accent-color,#1DB954)] text-white shadow ring-1 ring-[var(--accent-color,#1DB954)]/30'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span className="text-xs font-bold block">{f.label}</span>
                            <span className="text-[9px] text-zinc-400 block mt-0.5 leading-tight">{f.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 📱 Mobile Dynamic Background Mode & Kinematics */}
                    <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <Smartphone size={13} className="text-[var(--accent-color,#1DB954)]" />
                          <span>Адаптация под экран телефона</span>
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {bgMobileEffect === 'none'
                            ? '🔒 1:1 Без зума (Чётко)'
                            : bgMobileEffect === 'pan'
                            ? '🌊 Панорамный дрейф'
                            : bgMobileEffect === 'tilt'
                            ? '📱 3D Гироскоп'
                            : bgMobileEffect === 'particles'
                            ? '✨ Эфирные искры'
                            : '🎬 Кино-виньетка'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {[
                          { id: 'none', label: '🔒 1:1 Оригинал', desc: 'Максимальная чёткость, без зума' },
                          { id: 'pan', label: '🌊 Панорама', desc: 'Плавное покачивание (виден весь кадр)' },
                          { id: 'tilt', label: '📱 3D Гироскоп', desc: 'Реагирует на наклон смартфона' },
                          { id: 'particles', label: '✨ Эфирные искры', desc: 'Парящие частицы света поверх видео' },
                          { id: 'vignette', label: '🎬 Кино-виньетка', desc: 'Мягкое затемнение по углам экрана' },
                        ].map((eff) => (
                          <button
                            key={eff.id}
                            type="button"
                            onClick={() => {
                              haptic.selection();
                              setBgMobileEffect(eff.id as any);
                            }}
                            className={`p-2 rounded-xl border text-left transition active:scale-95 ${
                              bgMobileEffect === eff.id
                                ? 'bg-[var(--accent-color,#1DB954)]/20 border-[var(--accent-color,#1DB954)] text-white shadow ring-1 ring-[var(--accent-color,#1DB954)]/30'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <span className="text-xs font-bold block">{eff.label}</span>
                            <span className="text-[9px] text-zinc-400 block mt-0.5 leading-tight">{eff.desc}</span>
                          </button>
                        ))}
                      </div>

                      {/* Position Focus on mobile */}
                      <div className="pt-2 border-t border-white/5">
                        <span className="text-[10px] text-zinc-400 font-semibold block mb-1.5 uppercase tracking-wider">
                          Фокус кадра (где главный объект / персонаж):
                        </span>
                        <div className="flex gap-1.5">
                          {[
                            { id: 'center', label: 'По центру' },
                            { id: 'left', label: 'Слева' },
                            { id: 'right', label: 'Справа' },
                            { id: 'top', label: 'Сверху' },
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => {
                                haptic.selection();
                                setBgPosition(pos.id as any);
                              }}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition active:scale-95 ${
                                bgPosition === pos.id
                                  ? 'bg-white/20 border-white text-white font-bold'
                                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Soft Glass Blur Slider */}
                      <div className="pt-2 border-t border-white/5">
                        <CustomSlider
                          label="Мягкое размытие видео (Эффект матового стекла)"
                          value={bgBlur}
                          min={0}
                          max={20}
                          unit="px"
                          onChange={setBgBlur}
                        />
                        <div className="flex items-center gap-1.5 mt-2">
                          {[
                            { val: 0, label: '0px (100% Чётко)' },
                            { val: 4, label: '4px' },
                            { val: 8, label: '8px' },
                            { val: 14, label: '14px' },
                          ].map((chip) => (
                            <button
                              key={chip.val}
                              type="button"
                              onClick={() => {
                                haptic.selection();
                                setBgBlur(chip.val);
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border transition active:scale-95 ${
                                bgBlur === chip.val
                                  ? 'bg-[var(--accent-color,#1DB954)]/20 border-[var(--accent-color,#1DB954)] text-white shadow'
                                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: ПЛЕЕР (Player Styles & Controls)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'player' && (
            <div className="space-y-6">
              <CanvasSettings />
              {/* Player Visual Style */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  <Disc size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Стиль плеера</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'classic', label: 'Обычный', desc: 'Квадратная обложка' },
                    { id: 'vinyl', label: 'Пластинка', desc: 'Виниловый диск' },
                    { id: 'large', label: 'Большой', desc: 'Масштабный фокус' },
                  ].map((ps) => (
                    <button
                      key={ps.id}
                      onClick={() => {
                        haptic.selection();
                        setPlayerStyle(ps.id as PlayerStyle);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border text-center transition active:scale-95 ${
                        playerStyle === ps.id
                          ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white shadow-md'
                          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs font-bold">{ps.label}</span>
                      <span className="text-[10px] text-zinc-400">{ps.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider / Seekbar Type */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  <SlidersHorizontal size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Тип слайдера (Полоса прогресса)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'waveform', label: 'Волновой', desc: 'Аудиодорожка (бары)' },
                    { id: 'wave', label: 'Волнистый', desc: 'SVG синусоида' },
                    { id: 'thin', label: 'Тонкий', desc: '2px минимализм' },
                    { id: 'smooth', label: 'Плавный', desc: 'Градиентный' },
                    { id: 'classic', label: 'Обычный', desc: 'Стандартный Spotify' },
                  ].map((ss) => (
                    <button
                      key={ss.id}
                      onClick={() => {
                        haptic.selection();
                        setSliderStyle(ss.id as SliderStyle);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition active:scale-95 ${
                        sliderStyle === ss.id
                          ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-xs font-bold block">{ss.label}</span>
                      <span className="text-[10px] text-zinc-400 line-clamp-1">{ss.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seekbar Thumb Selector (Custom Heads & Icons) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <Sparkles size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                    <span>Бегунок на полосе перемотки</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Кастомные головы и значки</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'worm',
                      label: 'Червячок',
                      icon: '🐛',
                      desc: 'Мультяшный червячок',
                    },
                    {
                      id: 'artist',
                      label: 'Исполнитель',
                      icon: '🎨',
                      desc: 'Обложка играющего трека',
                    },
                    {
                      id: 'vinyl',
                      label: 'Винил',
                      icon: '💿',
                      desc: 'Крутящаяся мини-пластинка',
                    },
                    {
                      id: 'fire',
                      label: 'Огонь',
                      icon: '🔥',
                      desc: 'Пылающее пламя',
                    },
                    {
                      id: 'heart',
                      label: 'Сердце',
                      icon: '❤️',
                      desc: 'Пульсирующее сердечко',
                    },
                    {
                      id: 'classic',
                      label: 'Обычный',
                      icon: '⚪',
                      desc: 'Белая точка',
                    },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        haptic.selection();
                        setSeekbarThumb(st.id as SeekbarThumbType);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition active:scale-95 flex flex-col gap-1 ${
                        seekbarThumb === st.id
                          ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white shadow ring-1 ring-[var(--accent-color,#1DB954)]/30'
                          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{st.icon}</span>
                        <span className="text-xs font-bold leading-tight line-clamp-1">{st.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 line-clamp-1">{st.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Upload Your Own Face / Photo Section */}
                <div className="mt-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      onClick={() => {
                        if (customThumbUrl) {
                          haptic.selection();
                          setSeekbarThumb('custom');
                        } else {
                          thumbFileInputRef.current?.click();
                        }
                      }}
                      className={`w-11 h-11 rounded-full border-2 cursor-pointer flex-shrink-0 overflow-hidden flex items-center justify-center transition active:scale-95 ${
                        seekbarThumb === 'custom'
                          ? 'border-[var(--accent-color,#1DB954)] ring-2 ring-[var(--accent-color,#1DB954)]/40 shadow-lg'
                          : 'border-white/20 bg-black/40 hover:border-white/40'
                      }`}
                    >
                      {customThumbUrl ? (
                        <img src={customThumbUrl} alt="Custom face" className="w-full h-full object-cover select-none pointer-events-none" />
                      ) : (
                        <Upload size={18} className="text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white block truncate">
                          {customThumbUrl ? 'Ваше личное фото' : 'Загрузить своё фото / лицо'}
                        </span>
                        {seekbarThumb === 'custom' && (
                          <span className="px-1.5 py-0.2 rounded bg-[var(--accent-color,#1DB954)]/20 text-[var(--accent-color,#1DB954)] text-[9px] font-bold">
                            АКТИВНО
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        {customThumbUrl ? 'Нажмите, чтобы включить или заменить' : 'Любое фото из галереи в круглом бейдже'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      ref={thumbFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleThumbUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => thumbFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent-color,#1DB954)] hover:brightness-110 text-black font-bold text-xs transition active:scale-95 shadow flex items-center gap-1"
                    >
                      <Upload size={12} strokeWidth={2.5} />
                      <span>{customThumbUrl ? 'Заменить' : 'Выбрать'}</span>
                    </button>
                    {customThumbUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          setCustomThumbUrl('');
                          if (seekbarThumb === 'custom') setSeekbarThumb('classic');
                        }}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition active:scale-95"
                        title="Удалить фото"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Title Alignment */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  <AlignCenter size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Выравнивание заголовка</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'left', label: 'Слева', icon: AlignLeft },
                    { id: 'center', label: 'По центру', icon: AlignCenter },
                    { id: 'right', label: 'Справа', icon: AlignRight },
                  ].map((ta) => {
                    const Icon = ta.icon;
                    return (
                      <button
                        key={ta.id}
                        onClick={() => {
                          haptic.selection();
                          setTitleAlign(ta.id as TitleAlign);
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                          titleAlign === ta.id
                            ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                            : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{ta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show Artist Avatar Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <span className="text-xs font-bold text-white block">Аватарки артистов</span>
                  <span className="text-[11px] text-zinc-400">
                    Отображать круглый аватар исполнителя рядом с его именем
                  </span>
                </div>
                <button
                  onClick={() => {
                    haptic.selection();
                    setShowArtistAvatar(!showArtistAvatar);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative p-0.5 ${
                    showArtistAvatar ? 'bg-[var(--accent-color,#1DB954)]' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                      showArtistAvatar ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4: ВКЛАДКИ И НАВИГАЦИЯ (Tabs & Dock)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'tabs' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                  <Layout size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Стиль панели навигации</span>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      id: 'floating',
                      name: 'Плавающий островок (Floating Dock)',
                      desc: 'Парящая стеклянная панель с закругленными углами и тенью',
                    },
                    {
                      id: 'compact',
                      name: 'Компактный (Compact)',
                      desc: 'Узкая нижняя панель с акцентом только на иконки',
                    },
                    {
                      id: 'default',
                      name: 'Классический (По умолчанию)',
                      desc: 'Стандартная нижняя полоса во всю ширину экрана',
                    },
                  ].map((ns) => {
                    const isSelected = navStyle === ns.id;
                    return (
                      <button
                        key={ns.id}
                        onClick={() => {
                          haptic.selection();
                          setNavStyle(ns.id as NavStyle);
                        }}
                        className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-95 ${
                          isSelected
                            ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                            : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold block">{ns.name}</span>
                          <span className="text-[11px] text-zinc-400">{ns.desc}</span>
                        </div>
                        {isSelected && <Check size={18} className="text-[var(--accent-color,#1DB954)] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 5: ЗВУК И СИСТЕМА (Audio & System)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              {/* Equalizer */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  <Sliders size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Эквалайзер</span>
                </div>
                <button
                  onClick={() => {
                    haptic.selection();
                    setIsEqModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-color,#1DB954)]/20 flex items-center justify-center text-[var(--accent-color,#1DB954)]">
                      <Sliders size={16} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white">5-полосный эквалайзер</div>
                      <div className="text-[11px] text-zinc-400">
                        {EQUALIZER_PRESETS[equalizerPreset]?.label || equalizerPreset}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[var(--accent-color,#1DB954)]">Настроить →</span>
                </button>
              </div>

              <SoundOptions />

              {/* Language Selection */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  <Globe size={14} style={{ color: 'var(--accent-color, #1DB954)' }} />
                  <span>Язык (Language)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleLangSelect('ru')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition ${
                      language === 'ru'
                        ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span>🇷🇺 Русский</span>
                    {language === 'ru' && <Check size={16} className="text-[var(--accent-color,#1DB954)]" />}
                  </button>
                  <button
                    onClick={() => handleLangSelect('en')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition ${
                      language === 'en'
                        ? 'border-[var(--accent-color,#1DB954)] bg-[var(--accent-color,#1DB954)]/15 text-white'
                        : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span>🇬🇧 English</span>
                    {language === 'en' && <Check size={16} className="text-[var(--accent-color,#1DB954)]" />}
                  </button>
                </div>
              </div>

              {/* Stats button */}
              <button
                onClick={() => {
                  haptic.impact('light');
                  setOpen(false);
                  openStats();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-amber-400" />
                  <span className="text-xs font-bold text-white">Моя статистика прослушиваний</span>
                </div>
                <span className="text-xs text-zinc-400">Открыть →</span>
              </button>

              {/* Open in Safari / External Browser */}
              {mobileMiniAppPlatform() && <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1DB954]/20 via-emerald-950/30 to-blue-950/30 border border-[#1DB954]/30 hover:border-[#1DB954] transition text-left">
                <button
                  onClick={handleOpenBrowser}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954]">
                      <ExternalLink size={16} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white">Открыть в браузере (Safari / Chrome)</div>
                      <div className="text-[11px] text-zinc-400">
                        Сравнить воспроизведение вне Telegram
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[#1DB954] font-semibold">Перейти →</span>
                </button>
              </div>}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Equalizer Sub-modal */}
      <EqualizerModal isOpen={isEqModalOpen} onClose={() => setIsEqModalOpen(false)} />
    </div>
  );
};

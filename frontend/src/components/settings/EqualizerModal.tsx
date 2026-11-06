import React, { useRef, useState } from 'react';
import { X, Sliders, RotateCcw, Volume2 } from 'lucide-react';
import { useSettingsStore, EQUALIZER_PRESETS } from '../../store/settingsStore';
import { useTelegram } from '../../hooks/useTelegram';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BAND_LABELS = [
  { freq: '60 Гц', desc: 'Саб-бас' },
  { freq: '230 Гц', desc: 'Бас' },
  { freq: '910 Гц', desc: 'Вокал' },
  { freq: '3.6 кГц', desc: 'Детали' },
  { freq: '14 кГц', desc: 'Высокие' },
];

interface EqualizerBandProps {
  val: number;
  labelFreq: string;
  labelDesc: string;
  onChange: (val: number) => void;
  onReset: () => void;
}

const EqualizerBand: React.FC<EqualizerBandProps> = ({
  val,
  labelFreq,
  labelDesc,
  onChange,
  onReset,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Range: -12 to +12 dB (span = 24)
  // 0% at -12 dB, 50% at 0 dB, 100% at +12 dB
  const percent = Math.min(100, Math.max(0, ((val - (-12)) / 24) * 100));

  const updateFromPointer = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.height <= 0) return;
    const offsetY = clientY - rect.top;
    const clampedY = Math.max(0, Math.min(rect.height, offsetY));
    // 1 at top (clientY = rect.top), 0 at bottom (clientY = rect.bottom)
    const ratio = 1 - clampedY / rect.height;
    const rawValue = -12 + ratio * 24;
    const rounded = Math.round(rawValue);
    const clamped = Math.max(-12, Math.min(12, rounded));
    onChange(clamped);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    updateFromPointer(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    updateFromPointer(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  return (
    <div className="flex flex-col items-center select-none">
      {/* Current dB badge (tap to reset to 0) */}
      <button
        type="button"
        onClick={onReset}
        title="Нажмите для сброса на 0 dB"
        className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md transition mb-2 active:scale-95 ${
          val > 0
            ? 'text-[#1DB954] bg-[#1DB954]/15 ring-1 ring-[#1DB954]/30'
            : val < 0
            ? 'text-amber-400 bg-amber-400/15 ring-1 ring-amber-400/30'
            : 'text-zinc-400 bg-white/5 hover:text-white'
        }`}
      >
        {val > 0 ? `+${val}` : `${val}`} dB
      </button>

      {/* Interactive Vertical Slider Area */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={onReset}
        className="w-12 h-44 flex items-center justify-center touch-none cursor-pointer relative py-2 group"
      >
        {/* Track Groove */}
        <div className="w-2.5 h-full bg-[#262626] rounded-full relative shadow-inner border border-white/5">
          {/* Center 0 dB Reference Notch */}
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-zinc-500 rounded-full pointer-events-none" />

          {/* Active Fill Level */}
          {val > 0 ? (
            <div
              className="absolute left-0 right-0 bg-gradient-to-t from-[#1DB954] to-[#22e066] rounded-t-full shadow-[0_0_8px_rgba(29,185,84,0.5)] pointer-events-none"
              style={{
                bottom: '50%',
                height: `${percent - 50}%`,
              }}
            />
          ) : val < 0 ? (
            <div
              className="absolute left-0 right-0 bg-gradient-to-b from-amber-500/80 to-amber-400 rounded-b-full shadow-[0_0_8px_rgba(245,158,11,0.4)] pointer-events-none"
              style={{
                top: '50%',
                height: `${50 - percent}%`,
              }}
            />
          ) : null}

          {/* Draggable Knob (Thumb) */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl shadow-black flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform z-20 ${
              isDragging ? 'scale-125 ring-4 ring-[#1DB954]/50' : 'group-hover:scale-110'
            }`}
            style={{
              bottom: `${percent}%`,
            }}
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                val > 0
                  ? 'bg-[#1DB954]'
                  : val < 0
                  ? 'bg-amber-500'
                  : 'bg-zinc-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Frequency & Description Label */}
      <div className="text-center mt-2">
        <div className="text-xs font-bold text-white leading-tight">
          {labelFreq}
        </div>
        <div className="text-[10px] text-zinc-400 mt-0.5">
          {labelDesc}
        </div>
      </div>
    </div>
  );
};

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const enabled = useSettingsStore((state) => state.equalizerEnabled);
  const setEnabled = useSettingsStore((state) => state.setEqualizerEnabled);
  const currentPreset = useSettingsStore((state) => state.equalizerPreset);
  const setPreset = useSettingsStore((state) => state.setEqualizerPreset);
  const bands = useSettingsStore((state) => state.equalizerBands);
  const setBand = useSettingsStore((state) => state.setEqualizerBand);
  const resetEqualizer = useSettingsStore((state) => state.resetEqualizer);
  const { haptic } = useTelegram();

  if (!isOpen) return null;

  const handleToggle = () => {
    haptic.impact('medium');
    setEnabled(!enabled);
  };

  const handlePresetClick = (key: string) => {
    haptic.selection();
    if (!enabled) setEnabled(true);
    setPreset(key);
  };

  const handleSliderChange = (idx: number, val: number) => {
    if (!enabled) setEnabled(true);
    setBand(idx, val);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl text-white animate-scale-up space-y-5 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954]">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Эквалайзер Spoty</h2>
              <p className="text-[11px] text-zinc-400">Настройка частот и усиление басов</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Master Enable Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition ${enabled ? 'bg-[#1DB954] text-black' : 'bg-zinc-800 text-zinc-400'}`}>
              <Volume2 size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Включить эквалайзер</div>
              <div className="text-[11px] text-zinc-400">
                {enabled ? 'Обработка звука активна' : 'Звук воспроизводится без изменений'}
              </div>
            </div>
          </div>

          <button
            onClick={handleToggle}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
              enabled ? 'bg-[#1DB954]' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Presets Chips */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Готовые пресеты
            </span>
            <button
              onClick={() => {
                haptic.impact('light');
                resetEqualizer();
              }}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              <span>Сбросить</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(EQUALIZER_PRESETS).map(([key, p]) => {
              const isSelected = enabled && currentPreset === key;
              return (
                <button
                  key={key}
                  onClick={() => handlePresetClick(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[#1DB954] text-black font-bold shadow-md'
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5-Band Vertical Frequency Sliders */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-white/5 relative overflow-hidden">
          {/* Reference dB labels */}
          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono font-bold px-2 mb-2">
            <span>+12 dB</span>
            <span className="text-zinc-400">0 dB (Flat)</span>
            <span>-12 dB</span>
          </div>

          {/* Equalizer Sliders Row */}
          <div className="grid grid-cols-5 gap-1 pt-1 pb-1 relative z-10">
            {bands.map((val, idx) => (
              <EqualizerBand
                key={idx}
                val={val}
                labelFreq={BAND_LABELS[idx].freq}
                labelDesc={BAND_LABELS[idx].desc}
                onChange={(newVal) => handleSliderChange(idx, newVal)}
                onReset={() => handleSliderChange(idx, 0)}
              />
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-bold text-white transition"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

import { create } from 'zustand';
const key = 'spoty_mix_tuning_v1'; // gitleaks:allow -- public localStorage namespace, not a credential
export const clampPercent = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
let saved: any = {};
try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* Defaults for unavailable storage. */ }
export const useMixTuning = create<{ novelty: number; diversity: number; set: (field: 'novelty' | 'diversity', value: number) => void }>((set, get) => ({
  novelty: clampPercent(saved?.novelty, 70), diversity: clampPercent(saved?.diversity, 50),
  set(field, value) {
    const next = { novelty: get().novelty, diversity: get().diversity, [field]: clampPercent(value, field === 'novelty' ? 70 : 50) };
    set(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Session choice still applies. */ }
  },
}));

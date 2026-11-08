import React, { useMemo, useRef } from 'react';

const frequencies = [60, 230, 910, 3600, 14000];
const x = (hz: number) => 44 + Math.log(hz / 20) / Math.log(1000) * 712;
const y = (db: number) => 120 - db * 6;

/** Uses the same biquads as playback; no running audio context or animation loop. */
export function EqualizerCurve({ bands, enabled, onChange }: { bands: number[]; enabled: boolean; onChange: (index: number, gain: number) => void }) {
  const dragging = useRef<number | null>(null);
  const path = useMemo(() => {
    const context = new OfflineAudioContext(1, 1, 48000);
    const points = Float32Array.from({ length: 240 }, (_, i) => 20 * 1000 ** (i / 239));
    const db = new Float32Array(points.length);
    frequencies.forEach((hz, i) => {
      const filter = context.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
      filter.frequency.value = hz; filter.Q.value = 1; filter.gain.value = enabled ? bands[i] : 0;
      const magnitude = new Float32Array(points.length), phase = new Float32Array(points.length);
      filter.getFrequencyResponse(points, magnitude, phase);
      magnitude.forEach((m, j) => { db[j] += 20 * Math.log10(Math.max(m, 1e-8)); });
    });
    return Array.from(points, (hz, i) => `${i ? 'L' : 'M'}${x(hz).toFixed(2)},${y(Math.max(-18, Math.min(18, db[i]))).toFixed(2)}`).join(' ');
  }, [bands, enabled]);
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(dragging.current, Math.max(-12, Math.min(12, Math.round((120 - (event.clientY - rect.top) / rect.height * 260) / 6))));
  };
  return <svg className="w-full touch-none select-none" viewBox="0 0 800 260" aria-label="Частотная характеристика эквалайзера"
    onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); const px = (event.clientX - rect.left) / rect.width * 800; dragging.current = frequencies.reduce((best, hz, i) => Math.abs(x(hz) - px) < Math.abs(x(frequencies[best]) - px) ? i : best, 0); event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
    onPointerMove={move} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
    {[-12, -6, 0, 6, 12].map(db => <g key={db}><line x1="44" x2="756" y1={y(db)} y2={y(db)} stroke={db === 0 ? '#ffffff40' : '#ffffff12'} /><text x="4" y={y(db) + 4} fill="#a1a1aa" fontSize="12">{db > 0 ? '+' : ''}{db}</text></g>)}
    {frequencies.map(hz => <g key={hz}><line x1={x(hz)} x2={x(hz)} y1="24" y2="220" stroke="#ffffff12" /><text x={x(hz)} y="250" textAnchor="middle" fill="#a1a1aa" fontSize="13">{hz >= 1000 ? `${hz / 1000}k` : hz} Гц</text></g>)}
    <path d={path} fill="none" stroke={enabled ? '#1DB954' : '#71717a'} strokeWidth="3" />
    {frequencies.map((hz, i) => <circle key={hz} cx={x(hz)} cy={y(bands[i])} r="9" fill={enabled ? '#1DB954' : '#71717a'} stroke="#fff" strokeWidth="2" />)}
  </svg>;
}

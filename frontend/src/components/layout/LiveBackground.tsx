import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useCustomizationStore, VIDEO_PRESETS } from '../../store/customizationStore';
import { isNativeClient } from '../../platform/nativeBridge';
import { decorativeHidden, decorativeSize, startDecorativeLoop, useDecorativeHidden, useVisualMode, visualBudget } from '../../platform/visualPerformance';

export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  return match ? match[1] : null;
}

export const LiveBackground: React.FC = () => {
  const visualMode = useVisualMode();
  const hidden = useDecorativeHidden();
  const budget = visualBudget();
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const bgType = useCustomizationStore((state) => state.bgType);
  const videoPresetId = useCustomizationStore((state) => state.videoPresetId);
  const customBgUrl = useCustomizationStore((state) => state.customBgUrl);
  const bgDim = useCustomizationStore((state) => state.bgDim);
  const bgFit = useCustomizationStore((state) => state.bgFit);
  const bgMobileEffect = useCustomizationStore((state) => state.bgMobileEffect);
  const bgPosition = useCustomizationStore((state) => state.bgPosition);
  const bgBlur = useCustomizationStore((state) => state.bgBlur);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<HTMLCanvasElement | null>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas animations for offline/built-in particle presets
  useEffect(() => {
    if (!bgType.startsWith('canvas_')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stopAnimation = () => {};
    const initialSize = decorativeSize(window.innerWidth, window.innerHeight);
    let width = (canvas.width = initialSize.width);
    let height = (canvas.height = initialSize.height);

    const handleResize = () => {
      if (!canvas) return;
      const size = decorativeSize(window.innerWidth, window.innerHeight);
      width = canvas.width = size.width;
      height = canvas.height = size.height;
    };
    window.addEventListener('resize', handleResize);

    if (bgType === 'canvas_stars') {
      // ── STARFIELD WITH GLOWING STARS & METEORS (Shooting Stars) ──
      interface Star {
        x: number;
        y: number;
        size: number;
        alpha: number;
        speed: number;
        twinkleSpeed: number;
        color: string;
      }

      interface Meteor {
        x: number;
        y: number;
        length: number;
        speed: number;
        angle: number;
        alpha: number;
        thickness: number;
      }

      const stars: Star[] = [];
      const starColors = ['#ffffff', '#e0f2fe', '#bae6fd', '#fef08a', '#ede9fe'];
      for (let i = 0; i < budget.stars; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2.2 + 0.6,
          alpha: Math.random() * 0.8 + 0.2,
          speed: Math.random() * 0.03 + 0.01,
          twinkleSpeed: Math.random() * 0.02 + 0.008,
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }

      const meteors: Meteor[] = [];
      const spawnMeteor = () => {
        if (meteors.length < 3 && Math.random() < 0.025) {
          meteors.push({
            x: Math.random() * width * 0.8 + width * 0.1,
            y: Math.random() * height * 0.4,
            length: Math.random() * 120 + 80,
            speed: Math.random() * 14 + 18,
            angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2, // ~45 degrees diagonal
            alpha: 1.0,
            thickness: Math.random() * 2 + 1.2,
          });
        }
      };

      const drawStars = () => {
        ctx.clearRect(0, 0, width, height);

        // Deep galactic cosmic backdrop
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#04050d');
        grad.addColorStop(0.5, '#09081a');
        grad.addColorStop(1, '#030409');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Twinkling stars
        for (const star of stars) {
          star.alpha += star.twinkleSpeed;
          if (star.alpha > 1 || star.alpha < 0.15) {
            star.twinkleSpeed = -star.twinkleSpeed;
          }

          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.globalAlpha = Math.max(0.1, Math.min(1, Math.abs(star.alpha)));

          if (star.size > 1.8) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#38bdf8';
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Meteors / shooting stars
        spawnMeteor();
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          const tailX = m.x - Math.cos(m.angle) * m.length;
          const tailY = m.y - Math.sin(m.angle) * m.length;

          const meteorGrad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
          meteorGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          meteorGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.6)');
          meteorGrad.addColorStop(1, `rgba(255, 255, 255, ${m.alpha})`);

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(m.x, m.y);
          ctx.strokeStyle = meteorGrad;
          ctx.lineWidth = m.thickness;
          ctx.lineCap = 'round';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffffff';
          ctx.stroke();
          ctx.shadowBlur = 0;

          m.x += Math.cos(m.angle) * m.speed;
          m.y += Math.sin(m.angle) * m.speed;
          m.alpha -= 0.02;

          if (m.alpha <= 0 || m.x > width + 100 || m.y > height + 100) {
            meteors.splice(i, 1);
          }
        }

      };
      stopAnimation = startDecorativeLoop(drawStars);

    } else if (bgType === 'canvas_rain') {
      // ── RAIN STREAKS WITH FLOOR SPLASH RIPPLES ──
      interface Drop {
        x: number;
        y: number;
        len: number;
        speed: number;
        alpha: number;
        thickness: number;
      }
      interface Ripple {
        x: number;
        y: number;
        r: number;
        maxR: number;
        alpha: number;
      }

      const drops: Drop[] = [];
      const ripples: Ripple[] = [];

      for (let i = 0; i < 140; i++) {
        drops.push({
          x: Math.random() * (width + 100) - 50,
          y: Math.random() * height,
          len: Math.random() * 26 + 14,
          speed: Math.random() * 16 + 18,
          alpha: Math.random() * 0.5 + 0.3,
          thickness: Math.random() * 1.5 + 0.8,
        });
      }

      const drawRain = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#06080e';
        ctx.fillRect(0, 0, width, height);

        // Falling rain lines
        for (const d of drops) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 3, d.y + d.len);
          ctx.strokeStyle = `rgba(180, 210, 255, ${d.alpha})`;
          ctx.lineWidth = d.thickness;
          ctx.lineCap = 'round';
          ctx.stroke();

          d.y += d.speed;
          d.x -= 2;

          if (d.y > height - 10) {
            // Splash ripple on ground
            if (ripples.length < 25 && Math.random() < 0.4) {
              ripples.push({
                x: d.x,
                y: height - Math.random() * 30,
                r: 1,
                maxR: Math.random() * 12 + 6,
                alpha: 0.6,
              });
            }
            d.y = -d.len;
            d.x = Math.random() * (width + 100);
          }
        }

        // Draw splashing ground ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, rp.r * 2, rp.r, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(180, 220, 255, ${rp.alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          rp.r += 0.8;
          rp.alpha -= 0.035;

          if (rp.alpha <= 0 || rp.r >= rp.maxR) {
            ripples.splice(i, 1);
          }
        }

      };
      stopAnimation = startDecorativeLoop(drawRain);

    } else if (bgType === 'canvas_aurora') {
      // ── GLOWING AURORA BOREALIS WAVES ──
      let t = 0;
      const drawAurora = () => {
        t += 0.008;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#03070d';
        ctx.fillRect(0, 0, width, height);

        // Wave 1: Teal / Green
        const grad1 = ctx.createRadialGradient(
          width * (0.35 + 0.25 * Math.sin(t)),
          height * (0.35 + 0.15 * Math.cos(t * 0.7)),
          20,
          width * 0.4,
          height * 0.4,
          width * 0.7
        );
        grad1.addColorStop(0, 'rgba(45, 212, 191, 0.45)');
        grad1.addColorStop(0.4, 'rgba(16, 185, 129, 0.25)');
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);

        // Wave 2: Cyan / Blue
        const grad2 = ctx.createRadialGradient(
          width * (0.7 + 0.2 * Math.cos(t * 0.6)),
          height * (0.55 + 0.2 * Math.sin(t * 0.8)),
          20,
          width * 0.65,
          height * 0.5,
          width * 0.65
        );
        grad2.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
        grad2.addColorStop(0.5, 'rgba(147, 51, 234, 0.28)');
        grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);

        // Wave 3: Magenta / Violet
        const grad3 = ctx.createRadialGradient(
          width * (0.5 + 0.3 * Math.sin(t * 0.5)),
          height * (0.2 + 0.15 * Math.sin(t * 0.9)),
          20,
          width * 0.5,
          height * 0.3,
          width * 0.6
        );
        grad3.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
        grad3.addColorStop(0.6, 'rgba(139, 92, 246, 0.2)');
        grad3.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad3;
        ctx.fillRect(0, 0, width, height);

      };
      stopAnimation = startDecorativeLoop(drawAurora);

    } else if (bgType === 'canvas_waves') {
      // ── CYBERPUNK SINE SPECTRUM WAVES ──
      let step = 0;
      const drawWaves = () => {
        step += 0.025;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#06060c';
        ctx.fillRect(0, 0, width, height);

        const waveConfigs = [
          { color: 'rgba(29, 185, 84, 0.65)', glow: '#1DB954', freq: 0.004, speed: step, amp: 80, yOff: 0.48 },
          { color: 'rgba(56, 189, 248, 0.55)', glow: '#38bdf8', freq: 0.006, speed: -step * 1.2, amp: 65, yOff: 0.52 },
          { color: 'rgba(168, 85, 247, 0.5)', glow: '#a855f7', freq: 0.005, speed: step * 0.8, amp: 90, yOff: 0.55 },
          { color: 'rgba(244, 114, 182, 0.45)', glow: '#f472b6', freq: 0.007, speed: -step * 0.7, amp: 60, yOff: 0.45 },
        ];

        for (const w of waveConfigs) {
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.strokeStyle = w.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = w.glow;

          for (let x = 0; x <= width; x += 8) {
            const y = height * w.yOff +
              Math.sin(x * w.freq + w.speed) * w.amp +
              Math.cos(x * (w.freq * 1.5) - w.speed * 0.5) * (w.amp * 0.4);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

      };
      stopAnimation = startDecorativeLoop(drawWaves);
    }

    return () => {
      stopAnimation();
      window.removeEventListener('resize', handleResize);
    };
  }, [bgType, visualMode]);

  const selectedPreset = VIDEO_PRESETS.find((p) => p.id === videoPresetId) || VIDEO_PRESETS[0];
  const videoSrc = bgType === 'video_preset' ? selectedPreset.videoUrl : customBgUrl;
  const ytId = bgType === 'custom_url' ? extractYouTubeId(customBgUrl) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!ytId) return;

    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        // YouTube PlayerState: 0 is ENDED
        if (data?.event === 'onStateChange' && data?.info === 0) {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
              '*'
            );
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            );
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ytId]);

  // Auto-heal: If user has a raw steamcommunity link saved, auto-resolve it to the direct Steam CDN media
  useEffect(() => {
    if (bgType === 'custom_url' && customBgUrl && customBgUrl.includes('steamcommunity.com')) {
      api
        .resolveSteamWorkshop(customBgUrl)
        .then((res) => {
          if (res && res.url) {
            useCustomizationStore.getState().setCustomBgUrl(res.url);
          }
        })
        .catch((e) => console.warn('Steam auto-resolve in LiveBackground:', e));
    }
  }, [bgType, customBgUrl]);

  // Auto-heal YouTube: If user has a raw youtube link, auto-resolve/check if clean MP4 is cached on server
  useEffect(() => {
    const yId = extractYouTubeId(customBgUrl);
    if (bgType === 'custom_url' && yId) {
      api
        .resolveYouTube(customBgUrl)
        .then((res) => {
          if (res && res.is_cached && res.url) {
            useCustomizationStore.getState().setCustomBgUrl(res.url);
          }
        })
        .catch((e) => console.warn('YouTube auto-resolve in LiveBackground:', e));
    }
  }, [bgType, customBgUrl]);

  // Pause all background video elements when screen is locked or tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      const isHidden = decorativeHidden() || visualBudget().freezeVideo;
      const videos = (isNativeClient() ? backgroundRef.current : document)?.querySelectorAll('video') || [];
      videos.forEach((v) => {
        if (v.id !== 'spotify-native-audio') {
          if (isHidden) {
            v.pause();
          } else {
            v.play().catch(() => {});
          }
        }
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('spoty-host-visibility', handleVisibility);
    handleVisibility();
    return () => { document.removeEventListener('visibilitychange', handleVisibility); window.removeEventListener('spoty-host-visibility', handleVisibility); };
  }, [visualMode]);

  // Gyroscope 3D Tilt Effect on mobile phones
  useEffect(() => {
    if (bgMobileEffect !== 'tilt' || bgType === 'none' || visualMode === 'economy') {
      setTilt({ x: 0, y: 0 });
      return;
    }
    let lastUpdate = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (decorativeHidden() || now - lastUpdate < 1000 / visualBudget().fps) return;
      lastUpdate = now;
      if (e.gamma !== null && e.beta !== null) {
        const x = Math.max(-25, Math.min(25, (e.gamma || 0) / 1.7));
        const y = Math.max(-18, Math.min(18, ((e.beta || 0) - 35) / 2.2));
        setTilt({ x, y });
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [bgMobileEffect, bgType, visualMode]);

  // Floating Ethereal Particles Overlay (Live Embers / Golden Dust)
  useEffect(() => {
    if (bgMobileEffect !== 'particles' || bgType === 'none') return;
    const canvas = particlesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const initialSize = decorativeSize(window.innerWidth, window.innerHeight);
    let w = (canvas.width = initialSize.width);
    let h = (canvas.height = initialSize.height);

    const onResize = () => {
      if (!canvas) return;
      const size = decorativeSize(window.innerWidth, window.innerHeight);
      w = canvas.width = size.width;
      h = canvas.height = size.height;
    };
    window.addEventListener('resize', onResize);

    const pts = Array.from({ length: budget.particles }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 2 + 1,
      speedY: Math.random() * 0.4 + 0.15,
      speedX: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.7 + 0.3,
      alphaSpeed: Math.random() * 0.01 + 0.005,
    }));

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.alpha += p.alphaSpeed;
        if (p.alpha > 0.95 || p.alpha < 0.2) p.alphaSpeed = -p.alphaSpeed;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 230, 180, ${Math.max(0, p.alpha)})`;
        ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
        ctx.shadowBlur = visualMode === 'economy' ? 0 : visualMode === 'balanced' ? 4 : 6;
        ctx.fill();
      }
    };
    const stopAnimation = startDecorativeLoop(render);

    return () => {
      stopAnimation();
      window.removeEventListener('resize', onResize);
    };
  }, [bgMobileEffect, bgType, visualMode]);

  const isDirectVideo =
    bgType === 'video_preset' ||
    (bgType === 'custom_url' &&
      !ytId &&
      Boolean(
        videoSrc.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i) ||
          videoSrc.includes('.mp4') ||
          videoSrc.includes('.webm') ||
          videoSrc.includes('/uploads/backgrounds/')
      ));

  const positionClass =
    bgPosition === 'left'
      ? 'object-left'
      : bgPosition === 'right'
      ? 'object-right'
      : bgPosition === 'top'
      ? 'object-top'
      : bgPosition === 'bottom'
      ? 'object-bottom'
      : 'object-center';

  const panClass = bgMobileEffect === 'pan' ? 'animate-bg-pan' : '';

  const dynamicTransform =
    bgMobileEffect === 'tilt'
      ? `translate3d(${tilt.x}px, ${tilt.y}px, 0) scale(1.12)`
      : undefined;

  const dynamicFilter = bgBlur > 0 ? `blur(${Math.min(bgBlur, budget.blur)}px)` : undefined;

  return (
    <div ref={backgroundRef} className="spoty-live-background fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#121212]">
      {/* 0. Clean Default Background (When bgType is 'none') */}
      {bgType === 'none' && (
        <div
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, #1e1e1e 0%, #121212 55%, #080808 100%)',
          }}
        />
      )}

      {/* 1. Canvas Layer (for generative particle / shader backgrounds) */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          bgType.startsWith('canvas_') ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 2. YouTube Background Video Layer (with instant HQ backdrop) */}
      {bgType === 'custom_url' && ytId && (
        <div
          className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${panClass}`}
          style={{
            transform: dynamicTransform,
            filter: dynamicFilter,
            transition: bgMobileEffect === 'tilt' ? 'transform 0.15s ease-out' : undefined,
          }}
        >
          {/* Atmospheric HQ thumbnail backdrop while player initializes */}
          <img
            src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
            alt="YouTube backdrop"
            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-70 pointer-events-none"
          />
          <div
            className="pointer-events-none"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'max(100vw, 177.78vh)',
              height: 'max(100vh, 56.25vw)',
              minWidth: '100vw',
              minHeight: '100vh',
            }}
          >
            {(!isNativeClient() || (!hidden && !budget.freezeVideo)) && <iframe
              ref={iframeRef}
              key={ytId}
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
              className="w-full h-full pointer-events-none border-0"
              allow="autoplay; encrypted-media"
              title="YouTube Live Background"
            />}
          </div>
        </div>
      )}

      {/* 3. Direct Video Layer (Preset or custom MP4/WebM/Steam Video) */}
      {((bgType === 'video_preset' && videoSrc) || (bgType === 'custom_url' && isDirectVideo && videoSrc)) && (
        <div
          className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${panClass}`}
          style={{
            transform: dynamicTransform,
            filter: dynamicFilter,
            transition: bgMobileEffect === 'tilt' ? 'transform 0.15s ease-out' : undefined,
          }}
        >
          <video
            key={videoSrc}
            autoPlay={!hidden && !budget.freezeVideo}
            preload={budget.freezeVideo && bgType === 'video_preset' ? 'none' : 'auto'}
            poster={bgType === 'video_preset' ? selectedPreset.previewUrl : undefined}
            onLoadedData={event => {
              const video = event.currentTarget;
              if (decorativeHidden() || visualBudget().freezeVideo) video.pause();
              else void video.play().catch(() => {});
            }}
            loop
            muted
            playsInline
            className={`absolute inset-0 w-full h-full pointer-events-none ${positionClass} ${
              bgFit === 'contain' ? 'object-contain' : 'object-cover'
            }`}
            style={{
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            src={videoSrc}
          />
        </div>
      )}

      {/* 4. Image/GIF Layer (Steam GIF, Wallhaven 4K, custom image URLs) */}
      {bgType === 'custom_url' && !ytId && !isDirectVideo && customBgUrl && !customBgUrl.includes('steamcommunity.com') && (
        <div
          className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${panClass}`}
          style={{
            transform: dynamicTransform,
            filter: dynamicFilter,
            transition: bgMobileEffect === 'tilt' ? 'transform 0.15s ease-out' : undefined,
          }}
        >
          {/* Ambient blurred backdrop: fills any narrow gaps with matching rich color glow */}
          {bgFit === 'ambient' && !budget.freezeVideo && (
            <img
              src={customBgUrl}
              alt="ambient background backdrop"
              className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-65 pointer-events-none"
            />
          )}
          {/* Foreground crisp image: full quality without destructive zoom! */}
          <img
            src={customBgUrl}
            alt="custom background"
            className={`absolute inset-0 w-full h-full pointer-events-none ${positionClass} ${
              bgFit === 'cover' ? 'object-cover' : bgFit === 'ambient' ? 'object-cover' : 'object-contain'
            }`}
            style={{
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translateZ(0)',
            }}
          />
        </div>
      )}

      {/* 5. Mobile Dynamic Particles Overlay (Ethereal Floating Embers) */}
      {bgType !== 'none' && bgMobileEffect === 'particles' && (
        <canvas
          ref={particlesRef}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-85 z-[1]"
        />
      )}

      {/* 6. Subtle Vignette Overlay (Darkened cinematic edges for readability) */}
      {bgType !== 'none' && bgMobileEffect === 'vignette' && (
        <div className="absolute inset-0 bg-vignette pointer-events-none z-[1]" />
      )}

      {/* 7. Adaptive Dark Dimmer Overlay (Controls contrast and text legibility) */}
      {bgType !== 'none' && bgDim > 0 && (
        <div
          className="absolute inset-0 transition-opacity duration-300 pointer-events-none z-[2]"
          style={{
            backgroundColor: '#000000',
            opacity: bgDim / 100,
          }}
        />
      )}
    </div>
  );
};

'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftX: number;
  driftY: number;
}

const STAR_COUNT = 120;

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize stars
    if (starsRef.current.length === 0) {
      const stars: Star[] = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.6 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2,
          driftX: (Math.random() - 0.5) * 0.15,
          driftY: (Math.random() - 0.5) * 0.08,
        });
      }
      starsRef.current = stars;
    }

    let time = 0;

    const animate = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Slow drift
        s.x += s.driftX;
        s.y += s.driftY;

        // Wrap around edges
        if (s.x < -5) s.x = canvas.width + 5;
        if (s.x > canvas.width + 5) s.x = -5;
        if (s.y < -5) s.y = canvas.height + 5;
        if (s.y > canvas.height + 5) s.y = -5;

        // Twinkle
        const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase);
        const alpha = s.opacity + twinkle * 0.25;
        const clampedAlpha = Math.max(0.05, Math.min(0.85, alpha));

        if (isDark) {
          // Warm white stars in dark mode
          ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
        } else {
          // Subtle dark specks in light mode
          ctx.fillStyle = `rgba(0, 0, 0, ${clampedAlpha * 0.12})`;
        }

        // Draw star with a tiny glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow for bigger stars in dark mode
        if (isDark && s.size > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha * 0.08})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

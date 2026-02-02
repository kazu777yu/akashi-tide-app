"use client";

import { useRef, useEffect, useCallback } from "react";

// ===== Akashi Strait coastline data (simplified polygons) =====
// Coordinate system: canvas-relative, designed for 800x600 base resolution
// The strait runs roughly east-west between Akashi (north) and Awaji Island (south)

// Northern coastline (Akashi / Kobe side) - left to right
const NORTH_COAST: [number, number][] = [
  [0, 145], [40, 140], [80, 130], [110, 122], [140, 118],
  [170, 120], [200, 128], [230, 135], [260, 130], [290, 125],
  [310, 118], [330, 110], [350, 105], [380, 108], [410, 115],
  [440, 120], [470, 118], [500, 112], [530, 108], [560, 110],
  [590, 115], [620, 120], [650, 125], [680, 130], [720, 138],
  [760, 145], [800, 150],
];

// Southern coastline (Awaji Island side) - left to right
const SOUTH_COAST: [number, number][] = [
  [0, 420], [40, 430], [80, 445], [110, 455], [140, 458],
  [170, 455], [200, 448], [230, 440], [260, 445], [290, 452],
  [310, 460], [330, 468], [350, 472], [380, 468], [410, 460],
  [440, 455], [470, 458], [500, 465], [530, 470], [560, 468],
  [590, 462], [620, 455], [650, 450], [680, 445], [720, 438],
  [760, 430], [800, 425],
];

// Akashi-Kaikyo Bridge approximate position
const BRIDGE_NORTH: [number, number] = [370, 108];
const BRIDGE_SOUTH: [number, number] = [390, 468];

type FlowDirection = "south" | "north" | "slack";
type FlowStrength = "strong" | "medium" | "weak";

interface Particle {
  x: number;
  y: number;
  speed: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface Props {
  direction: FlowDirection;
  strength: FlowStrength;
  directionLabel: string;
  strengthLabel: string;
}

export default function AkashiStraitMap({
  direction,
  strength,
  directionLabel,
  strengthLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const sizeRef = useRef({ w: 800, h: 600, scale: 1 });

  const getBaseSpeed = useCallback(() => {
    switch (strength) {
      case "strong": return 2.5;
      case "medium": return 1.5;
      case "weak": return 0.7;
    }
  }, [strength]);

  const getParticleCount = useCallback(() => {
    switch (strength) {
      case "strong": return 300;
      case "medium": return 180;
      case "weak": return 80;
    }
  }, [strength]);

  // Check if a point is in the water (between north and south coasts)
  const isInWater = useCallback((x: number, y: number): boolean => {
    const baseW = 800;
    // Interpolate north coast y at this x
    const nx = (x / sizeRef.current.w) * baseW;
    let northY = 145, southY = 420;

    for (let i = 0; i < NORTH_COAST.length - 1; i++) {
      if (nx >= NORTH_COAST[i][0] && nx <= NORTH_COAST[i + 1][0]) {
        const t = (nx - NORTH_COAST[i][0]) / (NORTH_COAST[i + 1][0] - NORTH_COAST[i][0]);
        northY = NORTH_COAST[i][1] + t * (NORTH_COAST[i + 1][1] - NORTH_COAST[i][1]);
        break;
      }
    }
    for (let i = 0; i < SOUTH_COAST.length - 1; i++) {
      if (nx >= SOUTH_COAST[i][0] && nx <= SOUTH_COAST[i + 1][0]) {
        const t = (nx - SOUTH_COAST[i][0]) / (SOUTH_COAST[i + 1][0] - SOUTH_COAST[i][0]);
        southY = SOUTH_COAST[i][1] + t * (SOUTH_COAST[i + 1][1] - SOUTH_COAST[i][1]);
        break;
      }
    }

    const scale = sizeRef.current.scale;
    const margin = 15 * scale;
    return y > northY * scale + margin && y < southY * scale - margin;
  }, []);

  const createParticle = useCallback((): Particle => {
    const { w, h, scale } = sizeRef.current;
    let x: number, y: number;
    let attempts = 0;
    do {
      x = Math.random() * w;
      y = (150 * scale) + Math.random() * (270 * scale);
      attempts++;
    } while (!isInWater(x, y) && attempts < 20);

    const baseSpeed = getBaseSpeed();
    const maxLife = 100 + Math.random() * 200;
    return {
      x,
      y,
      speed: baseSpeed * (0.5 + Math.random() * 1.0) * scale,
      opacity: 0,
      life: Math.random() * maxLife, // stagger initial life
      maxLife,
    };
  }, [getBaseSpeed, isInWater]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect?.width || 800;
      const h = Math.min(w * 0.75, window.innerHeight * 0.6);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, scale: w / 800 };
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    particlesRef.current = [];
    const count = getParticleCount();
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle());
    }

    const drawCoastline = (points: [number, number][], fillDir: "north" | "south") => {
      const { w, scale } = sizeRef.current;
      ctx.beginPath();
      const scaled = points.map(([px, py]) => [(px / 800) * w, py * scale] as [number, number]);
      ctx.moveTo(scaled[0][0], scaled[0][1]);
      for (let i = 1; i < scaled.length; i++) {
        const prev = scaled[i - 1];
        const curr = scaled[i];
        const cpx = (prev[0] + curr[0]) / 2;
        const cpy = (prev[1] + curr[1]) / 2;
        ctx.quadraticCurveTo(prev[0], prev[1], cpx, cpy);
      }
      ctx.lineTo(scaled[scaled.length - 1][0], scaled[scaled.length - 1][1]);

      if (fillDir === "north") {
        ctx.lineTo(w, 0);
        ctx.lineTo(0, 0);
      } else {
        const h = sizeRef.current.h;
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
      }
      ctx.closePath();
      ctx.fillStyle = "#2d5016";
      ctx.fill();
      // Coastline stroke
      ctx.beginPath();
      ctx.moveTo(scaled[0][0], scaled[0][1]);
      for (let i = 1; i < scaled.length; i++) {
        const prev = scaled[i - 1];
        const curr = scaled[i];
        const cpx = (prev[0] + curr[0]) / 2;
        const cpy = (prev[1] + curr[1]) / 2;
        ctx.quadraticCurveTo(prev[0], prev[1], cpx, cpy);
      }
      ctx.strokeStyle = "#4a7c29";
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    };

    const drawBridge = () => {
      const { w, scale } = sizeRef.current;
      const nx = (BRIDGE_NORTH[0] / 800) * w;
      const ny = BRIDGE_NORTH[1] * scale;
      const sx = (BRIDGE_SOUTH[0] / 800) * w;
      const sy = BRIDGE_SOUTH[1] * scale;

      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([8 * scale, 4 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bridge label
      const midX = (nx + sx) / 2;
      const midY = (ny + sy) / 2;
      ctx.save();
      ctx.translate(midX, midY);
      const angle = Math.atan2(sy - ny, sx - nx);
      ctx.rotate(angle);
      ctx.font = `${11 * scale}px sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.textAlign = "center";
      ctx.fillText("明石海峡大橋", 0, -6 * scale);
      ctx.restore();
    };

    const drawLabels = () => {
      const { w, scale } = sizeRef.current;
      ctx.font = `bold ${14 * scale}px sans-serif`;
      ctx.textAlign = "center";

      // North labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("明石", w * 0.2, 80 * scale);
      ctx.fillText("神戸", w * 0.7, 80 * scale);

      // South label
      ctx.fillText("淡路島", w * 0.5, sizeRef.current.h - 40 * scale);

      // Direction indicators
      ctx.font = `${12 * scale}px sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText("← 大阪湾", w * 0.9, 280 * scale);
      ctx.fillText("播磨灘 →", w * 0.1, 280 * scale);
    };

    const animate = () => {
      const { w, h, scale } = sizeRef.current;

      // Dark sea background
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, w, h);

      // Water gradient
      const waterGrad = ctx.createLinearGradient(0, 140 * scale, 0, 430 * scale);
      waterGrad.addColorStop(0, "#0d2847");
      waterGrad.addColorStop(0.5, "#0f3060");
      waterGrad.addColorStop(1, "#0d2847");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 140 * scale, w, 290 * scale);

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Fade in/out
        const fadeIn = Math.min(p.life / 30, 1);
        const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 30) / 30);
        p.opacity = Math.min(fadeIn, fadeOut);

        if (p.life > p.maxLife) {
          particles[i] = createParticle();
          particles[i].life = 0;
          continue;
        }

        // Move particle
        const flowAngle = direction === "south"
          ? Math.PI * 0.55 + (Math.random() - 0.5) * 0.3  // roughly rightward + downward
          : direction === "north"
          ? Math.PI * -0.55 + (Math.random() - 0.5) * 0.3 // roughly leftward + upward
          : (Math.random() - 0.5) * 0.5; // slack: drift slightly

        const speedMult = direction === "slack" ? 0.2 : 1;
        p.x += Math.cos(flowAngle) * p.speed * speedMult;
        p.y += Math.sin(flowAngle) * p.speed * speedMult;

        // Wrap around
        if (p.x > w + 10) p.x = -10;
        if (p.x < -10) p.x = w + 10;
        if (p.y > h) p.y = 150 * scale;
        if (p.y < 140 * scale) p.y = 420 * scale;

        if (!isInWater(p.x, p.y)) {
          particles[i] = createParticle();
          particles[i].life = 0;
          continue;
        }

        // Draw particle trail
        const trailLen = p.speed * 4;
        const tx = p.x - Math.cos(flowAngle) * trailLen;
        const ty = p.y - Math.sin(flowAngle) * trailLen;

        const colorBase = direction === "south"
          ? [255, 120, 80]   // warm red-orange for ebb (南流)
          : direction === "north"
          ? [80, 200, 255]   // cool blue for flood (北流)
          : [180, 180, 180]; // gray for slack

        const grad = ctx.createLinearGradient(tx, ty, p.x, p.y);
        grad.addColorStop(0, `rgba(${colorBase.join(",")}, 0)`);
        grad.addColorStop(1, `rgba(${colorBase.join(",")}, ${p.opacity * 0.8})`);

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = (1.5 + p.speed * 0.3) * scale;
        ctx.stroke();

        // Bright head
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 + p.speed * 0.2) * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorBase.join(",")}, ${p.opacity})`;
        ctx.fill();
      }

      // Draw land masses on top
      drawCoastline(NORTH_COAST, "north");
      drawCoastline(SOUTH_COAST, "south");

      // Bridge
      drawBridge();

      // Labels
      drawLabels();

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [direction, strength, createParticle, getParticleCount, isInWater]);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl"
        style={{ touchAction: "none" }}
      />
      {/* Overlay: current status */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl sm:text-2xl">
              {direction === "south" ? "↓" : direction === "north" ? "↑" : "~"}
            </span>
            <span className="text-white font-bold text-sm sm:text-lg">
              {directionLabel}
            </span>
          </div>
          <div className="text-xs sm:text-sm text-white/80">
            流速: <span className={
              strength === "strong" ? "text-yellow-300 font-bold" :
              strength === "medium" ? "text-blue-300" : "text-white/60"
            }>{strengthLabel}</span>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1.5 text-[10px] sm:text-xs text-white/60">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-3 h-0.5 bg-orange-400 rounded" />
            <span>南流（下げ潮）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-400 rounded" />
            <span>北流（上げ潮）</span>
          </div>
        </div>
      </div>
    </div>
  );
}

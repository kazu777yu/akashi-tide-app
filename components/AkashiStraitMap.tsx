"use client";

import { useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Akashi Strait center
const AKASHI_CENTER: [number, number] = [34.62, 134.98];
const DEFAULT_ZOOM = 12;

// Water area polygons for the Akashi Strait region
// Each polygon is [lng, lat][] — covers strait channel + surrounding sea
const WATER_POLYGONS: [number, number][][] = [
  // Strait channel between Akashi and Awaji
  [
    [134.88, 34.655], [134.91, 34.65], [134.94, 34.645],
    [134.97, 34.64],  [135.00, 34.635], [135.03, 34.63],
    [135.06, 34.625], [135.09, 34.62],
    [135.09, 34.585], [135.06, 34.58], [135.03, 34.58],
    [135.00, 34.585], [134.97, 34.59], [134.94, 34.595],
    [134.91, 34.60],  [134.88, 34.61],
  ],
  // Harima-nada (west of strait)
  [
    [134.55, 34.72], [134.88, 34.655], [134.88, 34.61],
    [134.55, 34.45], [134.40, 34.45], [134.40, 34.72],
  ],
  // Osaka Bay (east of strait)
  [
    [135.09, 34.62], [135.30, 34.62], [135.30, 34.45],
    [135.09, 34.45], [135.09, 34.585],
  ],
];

type FlowDirection = "south" | "north" | "slack";
type FlowStrength = "strong" | "medium" | "weak";

interface Particle {
  lat: number;
  lng: number;
  speed: number;
  opacity: number;
  life: number;
  maxLife: number;
  prevScreenX: number;
  prevScreenY: number;
}

interface Props {
  direction: FlowDirection;
  strength: FlowStrength;
  directionLabel: string;
  strengthLabel: string;
}

function pointInPolygon(lng: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isWater(lng: number, lat: number): boolean {
  return WATER_POLYGONS.some((p) => pointInPolygon(lng, lat, p));
}

// Flow direction angle in the strait (in radians, in lng/lat coordinate space)
// The strait runs roughly ENE-WSW.
// 南流 (ebb / "south flow") actually flows eastward through the strait toward Osaka Bay
// 北流 (flood / "north flow") actually flows westward toward Harima-nada
function getFlowAngle(direction: FlowDirection, lng: number): number {
  // Slight curvature: in the narrow section (lng ~134.95-135.05) flow is more E-W,
  // on the west side it angles slightly south, on the east side slightly south too
  const baseSouth = 0; // 0 = east
  const baseNorth = Math.PI; // PI = west

  // Add gentle curvature based on longitude
  const center = 134.98;
  const curve = (lng - center) * 0.3;

  if (direction === "south") return baseSouth + curve + (Math.random() - 0.5) * 0.3;
  if (direction === "north") return baseNorth + curve + (Math.random() - 0.5) * 0.3;
  return Math.random() * Math.PI * 2; // slack
}

export default function AkashiStraitMap({
  direction,
  strength,
  directionLabel,
  strengthLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const dirRef = useRef(direction);
  const strRef = useRef(strength);
  dirRef.current = direction;
  strRef.current = strength;

  const speedFor = useCallback((s: FlowStrength) => {
    return s === "strong" ? 0.0006 : s === "medium" ? 0.00035 : 0.00015;
  }, []);

  const countFor = useCallback((s: FlowStrength) => {
    return s === "strong" ? 350 : s === "medium" ? 200 : 80;
  }, []);

  const spawnParticle = useCallback((stagger: boolean): Particle => {
    const lngMin = 134.50, lngMax = 135.25;
    const latMin = 34.48, latMax = 34.70;
    let lng = 0, lat = 0;
    for (let i = 0; i < 40; i++) {
      lng = lngMin + Math.random() * (lngMax - lngMin);
      lat = latMin + Math.random() * (latMax - latMin);
      if (isWater(lng, lat)) break;
    }
    const base = speedFor(strRef.current);
    const maxLife = 100 + Math.random() * 180;
    return {
      lat, lng,
      speed: base * (0.5 + Math.random()),
      opacity: 0,
      life: stagger ? Math.random() * maxLife : 0,
      maxLife,
      prevScreenX: -1,
      prevScreenY: -1,
    };
  }, [speedFor]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: AKASHI_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    // CartoDB Dark Matter — no API key required
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;

    // Canvas overlay
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:450;";
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const c = map.getContainer();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = c.clientWidth * dpr;
      canvas.height = c.clientHeight * dpr;
    };
    resize();
    map.on("resize zoom move", resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reinit particles when direction/strength change
  useEffect(() => {
    const n = countFor(strength);
    const arr: Particle[] = [];
    for (let i = 0; i < n; i++) arr.push(spawnParticle(true));
    particlesRef.current = arr;
  }, [direction, strength, countFor, spawnParticle]);

  // Animation loop
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const loop = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fade previous frame for trail effect
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, w, h);

      const dir = dirRef.current;
      const str = strRef.current;
      const particles = particlesRef.current;
      const slackMult = dir === "slack" ? 0.15 : 1;

      // Color
      const col = dir === "south"
        ? "rgba(255,255,255,"
        : dir === "north"
        ? "rgba(200,230,255,"
        : "rgba(150,150,150,";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Opacity fade in/out
        const fi = Math.min(p.life / 15, 1);
        const fo = Math.max(0, 1 - (p.life - p.maxLife + 15) / 15);
        p.opacity = Math.min(fi, fo) * 0.8;

        if (p.life > p.maxLife || p.opacity <= 0) {
          particles[i] = spawnParticle(false);
          continue;
        }

        // Move in geo coordinates
        const angle = getFlowAngle(dir, p.lng);
        p.lng += Math.cos(angle) * p.speed * slackMult;
        p.lat += Math.sin(angle) * p.speed * slackMult * 0.7; // lat degrees are ~1.2x lng at this latitude

        if (!isWater(p.lng, p.lat)) {
          particles[i] = spawnParticle(false);
          continue;
        }

        // Project to screen
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const sx = pt.x, sy = pt.y;

        // Draw trail from previous position
        if (p.prevScreenX >= 0) {
          const dx = sx - p.prevScreenX;
          const dy = sy - p.prevScreenY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.5 && dist < 50) {
            ctx.beginPath();
            ctx.moveTo(p.prevScreenX, p.prevScreenY);
            ctx.lineTo(sx, sy);
            ctx.strokeStyle = col + (p.opacity * 0.5) + ")";
            ctx.lineWidth = 1.2 + (str === "strong" ? 0.5 : 0);
            ctx.stroke();
          }
        }

        // Head dot
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = col + p.opacity + ")";
        ctx.fill();

        p.prevScreenX = sx;
        p.prevScreenY = sy;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spawnParticle]);

  return (
    <div className="relative w-full h-[65vh] sm:h-[70vh]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Flow status overlay */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[500]">
        <div className="bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg sm:text-xl text-white">
              {direction === "south" ? "→" : direction === "north" ? "←" : "〜"}
            </span>
            <span className="text-white font-bold text-sm sm:text-base">
              {directionLabel}
            </span>
          </div>
          <div className="text-xs sm:text-sm text-white/70">
            流速:{" "}
            <span className={
              strength === "strong" ? "text-yellow-300 font-bold" :
              strength === "medium" ? "text-blue-300" : "text-white/50"
            }>
              {strengthLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-3 sm:bottom-10 sm:left-4 z-[500]">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5 mb-1 text-white/70">
            <span className="w-4 h-[2px] bg-white rounded inline-block" />
            <span>南流（下げ潮・東流）</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/70">
            <span className="w-4 h-[2px] bg-blue-200 rounded inline-block" />
            <span>北流（上げ潮・西流）</span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Akashi Strait center coordinates
const AKASHI_CENTER: [number, number] = [34.62, 134.98];
const DEFAULT_ZOOM = 12;

// Water detection: approximate bounding polygon of the Akashi Strait water area
// Using lat/lng pairs for the main water channel
const WATER_POLYGONS: [number, number][][] = [
  // Main strait channel (lng, lat pairs for checking)
  [
    [134.85, 34.66], [134.88, 34.65], [134.91, 34.645],
    [134.94, 34.64], [134.97, 34.635], [135.00, 34.63],
    [135.03, 34.625], [135.06, 34.62], [135.09, 34.615],
    [135.12, 34.61], [135.12, 34.58], [135.09, 34.58],
    [135.06, 34.575], [135.03, 34.575], [135.00, 34.58],
    [134.97, 34.585], [134.94, 34.59], [134.91, 34.595],
    [134.88, 34.60], [134.85, 34.61],
  ],
  // Wider Harima-nada side (west)
  [
    [134.75, 34.70], [134.85, 34.66], [134.85, 34.61],
    [134.75, 34.55], [134.65, 34.50], [134.55, 34.50],
    [134.55, 34.70], [134.65, 34.70],
  ],
  // Osaka Bay side (east)
  [
    [135.12, 34.61], [135.20, 34.60], [135.25, 34.58],
    [135.25, 34.50], [135.15, 34.50], [135.12, 34.55],
    [135.12, 34.58],
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
  angle: number;
}

interface Props {
  direction: FlowDirection;
  strength: FlowStrength;
  directionLabel: string;
  strengthLabel: string;
}

function isPointInPolygon(lng: number, lat: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInWater(lng: number, lat: number): boolean {
  return WATER_POLYGONS.some(poly => isPointInPolygon(lng, lat, poly));
}

export default function AkashiStraitMap({
  direction,
  strength,
  directionLabel,
  strengthLabel,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  const getBaseSpeed = useCallback(() => {
    switch (strength) {
      case "strong": return 0.0008;
      case "medium": return 0.0005;
      case "weak": return 0.0002;
    }
  }, [strength]);

  const getParticleCount = useCallback(() => {
    switch (strength) {
      case "strong": return 400;
      case "medium": return 250;
      case "weak": return 100;
    }
  }, [strength]);

  const createParticle = useCallback((randomLife = true): Particle => {
    // Generate random position in strait area
    const lngMin = 134.70, lngMax = 135.20;
    const latMin = 34.52, latMax = 34.68;
    let lng: number, lat: number;
    let attempts = 0;
    do {
      lng = lngMin + Math.random() * (lngMax - lngMin);
      lat = latMin + Math.random() * (latMax - latMin);
      attempts++;
    } while (!isInWater(lng, lat) && attempts < 30);

    const baseSpeed = getBaseSpeed();
    const maxLife = 80 + Math.random() * 160;

    // Flow angle: south flow goes roughly east (toward Osaka Bay) + slightly south
    // north flow goes roughly west (toward Harima-nada) + slightly north
    // The strait runs roughly east-west
    let baseAngle: number;
    if (direction === "south") {
      // Ebb tide: flows east through the strait (Harima-nada → Osaka Bay) and slightly south
      baseAngle = (Math.PI * 0.05) + (Math.random() - 0.5) * 0.4;
    } else if (direction === "north") {
      // Flood tide: flows west through the strait (Osaka Bay → Harima-nada) and slightly north
      baseAngle = Math.PI + (Math.PI * -0.05) + (Math.random() - 0.5) * 0.4;
    } else {
      baseAngle = Math.random() * Math.PI * 2;
    }

    return {
      lat,
      lng,
      speed: baseSpeed * (0.4 + Math.random() * 1.2),
      opacity: 0,
      life: randomLife ? Math.random() * maxLife : 0,
      maxLife,
      angle: baseAngle,
    };
  }, [direction, getBaseSpeed]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: AKASHI_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    // Terrain-style dark tile layer (Stadia Alidade Smooth Dark or similar)
    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 18,
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/">OSM</a>',
      }
    ).addTo(map);

    // Add attribution control in bottom-left
    L.control.attribution({ position: "bottomleft" }).addTo(map);

    // Add zoom control in bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    // Create canvas overlay
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "450"; // Above tiles, below controls
    map.getContainer().appendChild(canvas);
    canvasOverlayRef.current = canvas;

    const resizeCanvas = () => {
      const container = map.getContainer();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    };

    resizeCanvas();
    map.on("resize", resizeCanvas);
    map.on("zoom", resizeCanvas);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Particle animation loop
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasOverlayRef.current;
    if (!map || !canvas) return;

    // Reinitialize particles when direction/strength changes
    const count = getParticleCount();
    particlesRef.current = [];
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle(true));
    }

    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Semi-transparent clear for trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, w, h);

      const particles = particlesRef.current;
      const bounds = map.getBounds();
      const topLeft = map.latLngToContainerPoint(bounds.getNorthWest());
      const bottomRight = map.latLngToContainerPoint(bounds.getSouthEast());

      // Only render if bounds are valid
      if (topLeft && bottomRight) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.life++;

          // Fade in/out
          const fadeIn = Math.min(p.life / 20, 1);
          const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 20) / 20);
          p.opacity = Math.min(fadeIn, fadeOut);

          if (p.life > p.maxLife) {
            particles[i] = createParticle(false);
            continue;
          }

          // Move in lat/lng space
          p.lng += Math.cos(p.angle) * p.speed;
          p.lat += Math.sin(p.angle) * p.speed;

          // Small random wobble
          p.angle += (Math.random() - 0.5) * 0.1;

          // Check if still in water
          if (!isInWater(p.lng, p.lat)) {
            particles[i] = createParticle(false);
            continue;
          }

          // Convert to screen coordinates
          const pos = map.latLngToContainerPoint([p.lat, p.lng]);
          if (!pos) continue;

          // Trail
          const trailLen = p.speed * 5000;
          const tx = pos.x - Math.cos(p.angle) * trailLen;
          const ty = pos.y + Math.sin(p.angle) * trailLen; // y is inverted on screen

          // Color based on direction
          let r: number, g: number, b: number;
          if (direction === "south") {
            // Warm white-yellow for ebb
            r = 255; g = 240; b = 220;
          } else if (direction === "north") {
            // Cool white-blue for flood
            r = 220; g = 240; b = 255;
          } else {
            r = 200; g = 200; b = 200;
          }

          const grad = ctx.createLinearGradient(tx, ty, pos.x, pos.y);
          grad.addColorStop(0, `rgba(${r},${g},${b}, 0)`);
          grad.addColorStop(1, `rgba(${r},${g},${b}, ${p.opacity * 0.7})`);

          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(pos.x, pos.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Bright head dot
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b}, ${p.opacity * 0.9})`;
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [direction, strength, createParticle, getParticleCount]);

  return (
    <div className="relative w-full h-[65vh] sm:h-[70vh]">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Current flow overlay */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[500]">
        <div className="bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl sm:text-2xl text-white">
              {direction === "south" ? "→" : direction === "north" ? "←" : "~"}
            </span>
            <span className="text-white font-bold text-sm sm:text-base">
              {directionLabel}
            </span>
          </div>
          <div className="text-xs sm:text-sm text-white/70">
            流速:{" "}
            <span
              className={
                strength === "strong"
                  ? "text-yellow-300 font-bold"
                  : strength === "medium"
                  ? "text-blue-300"
                  : "text-white/50"
              }
            >
              {strengthLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-3 sm:bottom-10 sm:left-4 z-[500]">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5 mb-1 text-white/70">
            <span className="w-4 h-[2px] bg-amber-100 rounded inline-block" />
            <span>南流（下げ潮・東流）</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/70">
            <span className="w-4 h-[2px] bg-blue-100 rounded inline-block" />
            <span>北流（上げ潮・西流）</span>
          </div>
        </div>
      </div>
    </div>
  );
}

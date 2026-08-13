"use client";

import { useEffect, useRef, useState } from "react";

type Point = readonly [number, number];
type Edge = readonly [number, number, number];

const NODES: readonly Point[] = [
  [0.035, 0.26],
  [0.12, 0.18],
  [0.18, 0.43],
  [0.08, 0.69],
  [0.25, 0.58],
  [0.34, 0.76],
  [0.66, 0.2],
  [0.74, 0.38],
  [0.82, 0.24],
  [0.89, 0.48],
  [0.78, 0.65],
  [0.94, 0.72],
  [0.68, 0.82],
];

// The final value bends the connection perpendicular to its direct path.
const EDGES: readonly Edge[] = [
  [0, 1, -0.08],
  [0, 3, 0.08],
  [1, 2, -0.07],
  [2, 3, 0.08],
  [2, 4, -0.07],
  [3, 5, 0.08],
  [4, 5, -0.06],
  [6, 7, 0.06],
  [6, 8, -0.05],
  [7, 9, -0.08],
  [7, 10, 0.07],
  [8, 9, 0.06],
  [9, 10, -0.05],
  [9, 11, 0.07],
  [10, 12, -0.07],
  [10, 11, 0.05],
  [12, 11, -0.08],
];

function isDarkTheme() {
  const root = document.documentElement;
  if (root.classList.contains("light")) return false;
  if (root.classList.contains("dark")) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function GraphBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const draw = () => {
      frame = 0;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const dark = isDarkTheme();
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const scrollProgress = reduceMotion
        ? 0
        : Math.min(window.scrollY / 1400, 1);
      const yOffset = -16 * scrollProgress;
      const opacity = 1 - scrollProgress * 0.2;
      const edgeColor = dark ? "255, 255, 255" : "55, 78, 112";
      const nodeColor = dark ? "255, 255, 255" : "45, 67, 101";
      const glowColor = dark ? "105, 164, 255" : "71, 122, 190";

      context.save();
      context.translate(0, yOffset);
      context.globalAlpha = opacity;
      context.lineWidth = 0.75;
      context.strokeStyle = `rgba(${edgeColor}, ${dark ? 0.15 : 0.18})`;

      for (const [from, to, bend] of EDGES) {
        const [fromX, fromY] = NODES[from];
        const [toX, toY] = NODES[to];
        const x1 = fromX * width;
        const y1 = fromY * height;
        const x2 = toX * width;
        const y2 = toY * height;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const controlX = (x1 + x2) / 2 - dy * bend;
        const controlY = (y1 + y2) / 2 + dx * bend;

        context.beginPath();
        context.moveTo(x1, y1);
        context.quadraticCurveTo(controlX, controlY, x2, y2);
        context.stroke();
      }

      for (const [xRatio, yRatio] of NODES) {
        const x = xRatio * width;
        const y = yRatio * height;
        const radius = width < 640 ? 1.8 : 2.3;

        context.save();
        context.shadowBlur = dark ? 13 : 9;
        context.shadowColor = `rgba(${glowColor}, ${dark ? 0.9 : 0.45})`;
        context.fillStyle = `rgba(${nodeColor}, ${dark ? 0.9 : 0.72})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();

        context.strokeStyle = `rgba(${edgeColor}, ${dark ? 0.58 : 0.35})`;
        context.lineWidth = 0.65;
        context.beginPath();
        context.arc(x, y, radius + 2.2, 0, Math.PI * 2);
        context.stroke();
      }

      context.restore();
    };

    const requestDraw = () => {
      if (!frame) frame = window.requestAnimationFrame(draw);
    };

    const handleResize = () => {
      resize();
      requestDraw();
    };

    resize();
    draw();
    setIsReady(true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", requestDraw, { passive: true });

    const themeObserver = new MutationObserver(requestDraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", requestDraw);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div className="graph-background" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className={`graph-background__canvas opacity-0 transition-opacity duration-[2500ms] ease-out motion-reduce:transition-none ${
          isReady ? "opacity-100" : ""
        }`}
      />
      <div className="graph-background__center" />
      <div className="graph-background__vignette" />
    </div>
  );
}

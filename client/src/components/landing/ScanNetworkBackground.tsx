import { useEffect, useRef } from "react";
import { Box, useTheme } from "@mui/material";
import { usePageHidden, usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_COUNT = 26;
const LINK_DISTANCE = 140; // px, in CSS pixels
const NODE_SPEED = 0.12; // px/frame, kept slow and "ambient"

/**
 * Lightweight canvas particle/node network drifting behind the hero.
 * Evokes "continuously scanning your codebase" — faint teal nodes and
 * connecting lines, low opacity, capped particle count, no DOM nodes.
 *
 * Respects prefers-reduced-motion (renders one static frame, no rAF loop)
 * and pauses the animation loop while the tab is hidden.
 */
export default function ScanNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef<number | null>(null);
  const { palette } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const pageHidden = usePageHidden();

  // Keep the latest color + motion flags in refs so the draw loop (set up once)
  // can read current values without needing to be torn down/rebuilt every render.
  const colorRef = useRef(palette.primary.main);
  colorRef.current = palette.primary.main;
  const pausedRef = useRef(prefersReducedMotion || pageHidden);
  pausedRef.current = prefersReducedMotion || pageHidden;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedNodes() {
      const nodes: Node[] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * NODE_SPEED,
          vy: Math.sin(angle) * NODE_SPEED,
        });
      }
      nodesRef.current = nodes;
    }

    function hexToRgb(hex: string): [number, number, number] {
      const m = hex.replace("#", "");
      const bigint = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const nodes = nodesRef.current;
      const [r, g, b] = hexToRgb(colorRef.current);

      // links first, so nodes sit visually on top
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const c = nodes[j];
          const dx = a.x - c.x;
          const dy = a.y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DISTANCE) {
            const opacity = (1 - dist / LINK_DISTANCE) * 0.16;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
        ctx.fill();
      }
    }

    function step() {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      for (const n of nodesRef.current) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      draw();
      rafRef.current = requestAnimationFrame(step);
    }

    resize();
    seedNodes();
    draw();

    const onResize = () => {
      resize();
      // reseed so nodes aren't stranded outside the new bounds
      seedNodes();
      draw();
    };
    window.addEventListener("resize", onResize);

    if (!prefersReducedMotion) {
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Intentionally run once: color/pause changes are read live via refs above
    // so we don't tear down and restart the rAF loop on every theme toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </Box>
  );
}

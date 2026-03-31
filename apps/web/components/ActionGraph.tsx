"use client";

import { useEffect, useRef } from "react";
import type { ReasoningEntry } from "./HermesBrainPanel";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, { stroke: string; fill: string; glow: string }> = {
  execute_swap:        { stroke: "#ef4444", fill: "#fef2f2", glow: "rgba(239,68,68,0.4)" },
  deposit_to_yield:    { stroke: "#8b5cf6", fill: "#f5f3ff", glow: "rgba(139,92,246,0.4)" },
  withdraw_from_yield: { stroke: "#f59e0b", fill: "#fffbeb", glow: "rgba(245,158,11,0.4)" },
  reserve_expense:     { stroke: "#0ea5e9", fill: "#f0f9ff", glow: "rgba(14,165,233,0.4)" },
  send_alert:          { stroke: "#f97316", fill: "#fff7ed", glow: "rgba(249,115,22,0.4)" },
  hold:                { stroke: "#16a34a", fill: "#f0fdf4", glow: "rgba(22,163,74,0.4)" },
  default:             { stroke: "#7c3aed", fill: "#faf5ff", glow: "rgba(124,58,237,0.4)" },
};

const ACTION_LABELS: Record<string, string> = {
  execute_swap: "SWAP", deposit_to_yield: "YIELD", withdraw_from_yield: "WITHDRAW",
  reserve_expense: "RESERVE", send_alert: "ALERT", hold: "HOLD",
};

const ACTION_ICONS: Record<string, string> = {
  execute_swap: "⇄", deposit_to_yield: "↑", withdraw_from_yield: "↓",
  reserve_expense: "🔒", send_alert: "⚠", hold: "◆",
};

// ─── Node / Edge types ────────────────────────────────────────────────────────
interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  action: string;
  label: string;
  time: string;
  text: string;
  r: number;
}

interface Edge { from: string; to: string }

// ─── Force layout helpers ─────────────────────────────────────────────────────
function applyForces(nodes: Node[], edges: Edge[], w: number, h: number) {
  const k = 80;
  const repulsion = 4500;

  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[i].vx -= fx; nodes[i].vy -= fy;
      nodes[j].vx += fx; nodes[j].vy += fy;
    }
  }

  // Attraction along edges
  for (const edge of edges) {
    const a = nodes.find(n => n.id === edge.from);
    const b = nodes.find(n => n.id === edge.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - k) * 0.08;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }

  // Gravity to centre
  const cx = w / 2, cy = h / 2;
  for (const node of nodes) {
    node.vx += (cx - node.x) * 0.004;
    node.vy += (cy - node.y) * 0.004;
  }

  // Integrate and dampen
  for (const node of nodes) {
    node.vx *= 0.82; node.vy *= 0.82;
    node.x += node.vx; node.y += node.vy;
    node.x = Math.max(node.r + 20, Math.min(w - node.r - 20, node.x));
    node.y = Math.max(node.r + 20, Math.min(h - node.r - 20, node.y));
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ActionGraph({ entries, onClose }: { entries: ReasoningEntry[]; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const hoveredRef = useRef<Node | null>(null);
  const rafRef = useRef<number>(0);

  // Build graph from entries
  useEffect(() => {
    const w = canvasRef.current?.offsetWidth ?? 700;
    const h = canvasRef.current?.offsetHeight ?? 500;
    const cx = w / 2, cy = h / 2;
    const reasoningEntries = entries.filter(e => e.type === "reasoning").slice(0, 20);

    // Golden ratio spiral initial positions
    nodesRef.current = reasoningEntries.map((e, i) => {
      const angle = i * 2.39996; // golden angle
      const radius = 30 + i * 18;
      return {
        id: e.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0, vy: 0,
        action: e.action ?? "default",
        label: ACTION_LABELS[e.action ?? ""] ?? "THINK",
        time: e.time,
        text: e.message,
        r: i === 0 ? 36 : 26,
      };
    });

    // Chain edges (temporal sequence)
    edgesRef.current = reasoningEntries.slice(1).map((e, i) => ({
      from: reasoningEntries[i].id,
      to: e.id,
    }));

    // Also add edges between same action types (thematic links)
    const actionGroups: Record<string, string[]> = {};
    for (const n of nodesRef.current) {
      (actionGroups[n.action] ??= []).push(n.id);
    }
    for (const ids of Object.values(actionGroups)) {
      for (let i = 0; i < ids.length - 1; i++) {
        if (!edgesRef.current.find(e => e.from === ids[i] && e.to === ids[i + 1])) {
          edgesRef.current.push({ from: ids[i], to: ids[i + 1] });
        }
      }
    }
  }, [entries]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      hoveredRef.current = nodesRef.current.find(n => {
        const dx = n.x - mx, dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) < n.r + 4;
      }) ?? null;
      canvas.style.cursor = hoveredRef.current ? "pointer" : "default";
    };
    canvas.addEventListener("mousemove", onMove);
    return () => canvas.removeEventListener("mousemove", onMove);
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    window.addEventListener("resize", resize);
    resize();

    const render = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      // Settle physics for first 180 frames
      if (frame < 180) {
        applyForces(nodesRef.current, edgesRef.current, w, h);
        frame++;
      }

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const hovered = hoveredRef.current;

      // Draw edges
      for (const edge of edges) {
        const a = nodes.find(n => n.id === edge.from);
        const b = nodes.find(n => n.id === edge.to);
        if (!a || !b) continue;

        const isSameAction = a.action === b.action;
        const isSequential = !isSameAction;

        ctx.beginPath();
        // Curved edge
        const mx = (a.x + b.x) / 2 - (b.y - a.y) * 0.18;
        const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);

        const colors = ACTION_COLORS[a.action] ?? ACTION_COLORS.default;
        ctx.strokeStyle = isSequential
          ? "rgba(25,25,24,0.08)"
          : colors.stroke + "55";
        ctx.lineWidth = isSequential ? 1 : 1.5;
        ctx.setLineDash(isSequential ? [] : [4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const node of nodes) {
        const colors = ACTION_COLORS[node.action] ?? ACTION_COLORS.default;
        const isHovered = hovered?.id === node.id;
        const r = isHovered ? node.r + 4 : node.r;

        // Glow
        if (isHovered || node === nodes[0]) {
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5);
          glow.addColorStop(0, colors.glow);
          glow.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Circle fill
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = node === nodes[0] ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.font = `${r * 0.7}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors.stroke;
        ctx.fillText(ACTION_ICONS[node.action] ?? "🧠", node.x, node.y - 2);

        // Label
        ctx.font = `600 ${Math.max(8, r * 0.32)}px var(--font-mono, monospace)`;
        ctx.fillStyle = colors.stroke;
        ctx.fillText(node.label, node.x, node.y + r * 0.52);

        // Time badge below node
        if (isHovered || node === nodes[0]) {
          ctx.font = `500 9px var(--font-mono, monospace)`;
          ctx.fillStyle = "rgba(25,25,24,0.35)";
          ctx.fillText(node.time, node.x, node.y + r + 12);
        }
      }

      // Tooltip for hovered node
      if (hovered) {
        const colors = ACTION_COLORS[hovered.action] ?? ACTION_COLORS.default;
        const text = hovered.text.slice(0, 140) + (hovered.text.length > 140 ? "…" : "");
        const lines: string[] = [];
        let line = "";
        for (const word of text.split(" ")) {
          if ((line + word).length > 42) { lines.push(line.trim()); line = word + " "; }
          else line += word + " ";
        }
        if (line.trim()) lines.push(line.trim());

        const TOO_FAR_RIGHT = hovered.x + 200 > w - 10;
        const tx = TOO_FAR_RIGHT ? hovered.x - 190 : hovered.x + 12;
        const ty = Math.min(hovered.y - 10, h - lines.length * 16 - 40);
        const bw = 190, bh = lines.length * 16 + 28;

        ctx.fillStyle = "rgba(25,25,24,0.92)";
        ctx.beginPath();
        ctx.roundRect(tx, ty, bw, bh, 8);
        ctx.fill();

        ctx.fillStyle = colors.stroke;
        ctx.font = `700 9px var(--font-mono, monospace)`;
        ctx.textAlign = "left";
        ctx.fillText(`${ACTION_ICONS[hovered.action] ?? "🧠"} ${hovered.label}  ${hovered.time}`, tx + 10, ty + 14);

        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `400 9px sans-serif`;
        lines.forEach((l, i) => ctx.fillText(l, tx + 10, ty + 28 + i * 16));
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(10,10,8,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1.5rem",
    }}>
      <div style={{
        background: "#FFFEF2", borderRadius: 16, overflow: "hidden",
        width: "100%", maxWidth: 900, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
        border: "1px solid rgba(25,25,24,0.12)",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem", borderBottom: "1px solid rgba(25,25,24,0.08)",
          background: "white",
        }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#191918", letterSpacing: "-0.01em" }}>
              🕸️ Agent Decision Web
            </p>
            <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.45)", fontFamily: "var(--font-mono, monospace)" }}>
              Force-directed graph of Hermes reasoning — hover nodes to inspect
            </p>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {Object.entries(ACTION_COLORS).filter(([k]) => k !== "default").map(([action, colors]) => (
              <div key={action} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors.stroke, display: "inline-block" }} />
                <span style={{ fontSize: "0.55rem", fontFamily: "var(--font-mono, monospace)", color: "rgba(25,25,24,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {ACTION_LABELS[action]}
                </span>
              </div>
            ))}
            <button
              onClick={onClose}
              style={{
                marginLeft: "0.5rem", padding: "0.35rem 0.75rem", borderRadius: 6, cursor: "pointer",
                background: "rgba(25,25,24,0.06)", border: "1px solid rgba(25,25,24,0.12)",
                fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem",
                fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#191918",
              }}
            >
              Close ✕
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: "relative", minHeight: 500 }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
          <p style={{
            position: "absolute", bottom: "0.75rem", left: "50%", transform: "translateX(-50%)",
            fontSize: "0.6rem", fontFamily: "var(--font-mono, monospace)",
            color: "rgba(25,25,24,0.3)", textTransform: "uppercase", letterSpacing: "0.08em",
            pointerEvents: "none",
          }}>
            Solid lines = chronological sequence · Dashed lines = same action type
          </p>
        </div>
      </div>
    </div>
  );
}

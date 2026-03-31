"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function NoiseCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
    const fs = `precision lowp float;uniform vec2 r;float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}void main(){gl_FragColor=vec4(vec3(rand(gl_FragCoord.xy/r)),0.15);}`;
    const mk = (t: number, src: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const res = gl.getUniformLocation(prog, "r");
    const render = () => { gl.uniform2f(res, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    const onResize = () => { resize(); render(); };
    window.addEventListener("resize", onResize);
    resize(); render();
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.8, zIndex: 1,
      }}
    />
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: "#FFFEF2", color: "#191918", minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(180deg,#8ba5bb 0%,#e1c4a9 45%,#c48c5a 50%,#525333 65%,#2a2a1c 100%)",
        height: "70vh", position: "relative", display: "flex",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        color: "white", padding: "0 1.5rem",
      }}>
        <NoiseCanvas />

        {/* Connect button — top right */}
        <div style={{ position: "absolute", top: "1.25rem", right: "1.5rem", zIndex: 20 }}>
          <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
        </div>

        <div style={{ position: "relative", zIndex: 10, maxWidth: "48rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
            <span style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em", color: "#191918" }}>🛡️ FlowVault</span>
            <span className="pulse-green" style={{ width: 6, height: 6, borderRadius: "50%", background: "#28C840", display: "inline-block" }} />
          </div>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3.75rem)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 1.5rem", color: "#191918" }}>
            AI-powered treasury<br />management on Flow.
          </h1>
          <p style={{ fontSize: "1.2rem", fontWeight: 400, maxWidth: "36rem", margin: "0 auto 2.5rem", color: "#191918" }}>
            Set your delegation rules once — the AI agent monitors runway, enforces guardrails, and executes DAO-approved rebalances 24/7.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                background: "#FCAA2D", color: "#191918", padding: "0.75rem 1.5rem",
                borderRadius: 6, fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem",
                fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                display: "inline-flex", alignItems: "center", gap: "0.5rem", textDecoration: "none",
              }}
            >
              Open Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <main style={{ maxWidth: 1000, margin: "calc(-10vh - 50px) auto 0", position: "relative", zIndex: 10, padding: "0 1.5rem 120px" }}>
        <div className="m-card" style={{ marginBottom: "1.5rem" }}>
          <p style={{ textAlign: "center", fontSize: "1rem", lineHeight: 1.7, color: "rgba(25,25,24,0.65)", maxWidth: "40rem", margin: "0 auto 2.5rem" }}>
            FlowVault gives DAOs an <strong style={{ color: "#191918", fontWeight: 500 }}>autonomous treasury agent</strong> — enforcing on-chain guardrails, protecting runway, and logging every decision to Flow for full auditability.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", border: "1px solid rgba(25,25,24,0.12)", borderRadius: 8 }}>
            <div style={{ padding: "1.75rem" }}>
              <p className="m-label" style={{ marginBottom: "1.25rem" }}>For DAOs</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.875rem", fontSize: "0.875rem" }}>
                {["Runway protection & expense reserves","2-of-3 multi-sig rebalance approvals","On-chain audit log of every action"].map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#FCAA2D", flexShrink: 0, display: "inline-block" }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: "rgba(25,25,24,0.12)" }} />
            <div style={{ padding: "1.75rem" }}>
              <p className="m-label" style={{ marginBottom: "1.25rem" }}>For AI Agents</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.875rem", fontSize: "0.875rem" }}>
                {["Cadence smart delegation rules","IncrementFi yield vault integration","Hermes AI decision & execution engine"].map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#FCAA2D", flexShrink: 0, display: "inline-block" }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "3rem", padding: "1.75rem 0 0", borderTop: "1px solid rgba(25,25,24,0.12)", marginTop: "2rem", opacity: 0.55, fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {["Flow","Cadence","IncrementFi","DAOMultiSig","Self Protocol"].map(n => <span key={n}>{n}</span>)}
          </div>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
          {["⛓️ Flow Native","🏦 Treasury Management","🤖 AI Agent Execution","🔒 2-of-3 MultiSig","📊 Expense Reserves","🪪 Self Protocol"].map(f => (
            <span key={f} style={{ padding: "0.375rem 0.875rem", borderRadius: "99px", border: "1px solid rgba(25,25,24,0.12)", fontSize: "0.8rem", color: "rgba(25,25,24,0.65)" }}>
              {f}
            </span>
          ))}
        </div>
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)",
        background: "rgba(25,25,24,0.95)", backdropFilter: "blur(12px)",
        padding: "0.75rem 1.5rem", borderRadius: "99px",
        display: "flex", alignItems: "center", gap: "2rem", zIndex: 100,
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <span style={{ fontWeight: 700, color: "white", fontSize: "0.875rem", letterSpacing: "-0.02em" }}>🛡️ FlowVault</span>
        <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }} />
        {[["Dashboard", "/dashboard"], ["Treasury", "/dashboard/treasury"], ["Rules", "/dashboard/rules"]].map(([label, href]) => (
          <Link key={label} href={href} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
        <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }} />
        <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
      </nav>
    </div>
  );
}

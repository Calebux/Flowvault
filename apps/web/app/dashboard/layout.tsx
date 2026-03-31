"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { href: "/dashboard",           label: "Overview"  },
  { href: "/dashboard/portfolio", label: "Portfolio" },
  { href: "/dashboard/treasury",  label: "Treasury"  },
  { href: "/dashboard/rules",     label: "Rules"     },
  { href: "/dashboard/history",   label: "History"   },
  { href: "/dashboard/identity",  label: "Identity"  },
];

function DemoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div style={{
      background: "rgba(252,170,45,0.08)",
      borderBottom: "1px solid rgba(252,170,45,0.18)",
      padding: "0.35rem 1.5rem",
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      fontSize: "0.65rem",
      fontFamily: "var(--font-mono, monospace)",
      color: "rgba(25,25,24,0.55)",
      letterSpacing: "0.02em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FCAA2D", flexShrink: 0, display: "inline-block" }} />
      <span>
        Demo treasury · $841,760 simulated on Flow EVM Testnet · Real AI decisions by Hermes 4 70B
      </span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
        <a
          href="https://evm-testnet.flowscan.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#FCAA2D", textDecoration: "none", fontWeight: 600 }}
        >
          FlowScan ↗
        </a>
        <button
          onClick={() => setVisible(false)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(25,25,24,0.3)", fontSize: "0.8rem", lineHeight: 1, padding: 0 }}
        >
          ✕
        </button>
      </span>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  // Auto-seed Redis with demo data on first dashboard visit per session
  useEffect(() => {
    if (sessionStorage.getItem("fv_seeded")) return;
    fetch("/api/seed-demo", { method: "POST" })
      .then(() => sessionStorage.setItem("fv_seeded", "1"))
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFEF2", color: "#191918" }}>
      {/* Top nav */}
      <header style={{
        height: 56, borderBottom: "1px solid rgba(25,25,24,0.1)",
        display: "flex", alignItems: "center", padding: "0 1.5rem", gap: "1.5rem",
        background: "rgba(255,254,242,0.85)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.02em", color: "#191918", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          🛡️ <span>FlowVault</span>
        </Link>

        <nav style={{ display: "flex", gap: "0.25rem", marginLeft: "0.5rem" }}>
          {NAV.map(({ href, label }) => {
            const active = path === href;
            return (
              <Link key={href} href={href} style={{
                fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem",
                textTransform: "uppercase", letterSpacing: "0.08em", textDecoration: "none",
                padding: "0.375rem 0.75rem", borderRadius: 6,
                color: active ? "#191918" : "rgba(25,25,24,0.45)",
                background: active ? "rgba(25,25,24,0.07)" : "transparent",
                transition: "all 0.15s",
              }}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginLeft: "auto" }}>
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </header>

      {/* Demo mode banner */}
      <DemoBanner />

      <main style={{ padding: "1.75rem 1.5rem 7rem", maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </main>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
        background: "rgba(25,25,24,0.95)", backdropFilter: "blur(12px)",
        padding: "0.625rem 1.25rem", borderRadius: "99px",
        display: "flex", alignItems: "center", gap: "1.5rem", zIndex: 100,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{ fontWeight: 700, color: "white", fontSize: "0.8rem" }}>🛡️ FlowVault</span>
        <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)" }} />
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} style={{
            fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem",
            textTransform: "uppercase", letterSpacing: "0.05em",
            color: path === href ? "#FCAA2D" : "rgba(255,255,255,0.55)",
            textDecoration: "none", fontWeight: path === href ? 600 : 400,
            transition: "color 0.15s",
          }}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

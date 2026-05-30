"use client";

import { useRouter } from "next/navigation";
import { clearCachedProfile } from "@/lib/api";

interface Props {
  username: string;
  criticos?: number;
  onLogoClick?: () => void;
  onProfileClick?: () => void;
  actionsSlot?: React.ReactNode;
}

export default function Navbar({ username, criticos = 0, onLogoClick, onProfileClick, actionsSlot }: Props) {
  const router = useRouter();

  function logout() {
    clearCachedProfile();
    localStorage.removeItem("token");
    router.push("/");
  }

  const initial = username.charAt(0).toUpperCase();

  return (
    <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: "100%", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo + título */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => { if (onLogoClick) { onLogoClick(); } else { router.push("/"); } }}
            style={{ fontFamily: "monospace", fontSize: 13, letterSpacing: "0.22em", fontWeight: 800, color: "var(--amber)", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "opacity 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.8")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}
            aria-label="Voltar para home"
          >
            STOCKOPS
          </button>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Sistema de Inteligência Operacional</span>
        </div>

        {/* Centro — alerta de críticos */}
        {criticos > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: "#E0525210", border: "1px solid #E0525230" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--red)" }}>
              {criticos} SKU{criticos > 1 ? "s" : ""} em estado crítico
            </span>
          </div>
        )}

        {/* Usuário + ações + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {actionsSlot}

          <button
            onClick={onProfileClick}
            disabled={!onProfileClick}
            aria-label="Editar perfil"
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: "4px 6px", borderRadius: 8, cursor: onProfileClick ? "pointer" : "default", transition: "background 0.15s" }}
            onMouseOver={e => { if (onProfileClick) e.currentTarget.style.background = "var(--border, #E8E8EF)"; }}
            onMouseOut={e => { e.currentTarget.style.background = "none"; }}
          >
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0B0B0C" }}>{initial}</span>
            </div>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>{username}</span>
          </button>

          <button onClick={logout} aria-label="Sair"
            className="btn-ghost btn-ghost-danger"
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8 }}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

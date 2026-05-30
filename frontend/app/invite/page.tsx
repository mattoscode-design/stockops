"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Users, CheckCircle, AlertCircle } from "lucide-react";
import { getInviteDetails, acceptInvite } from "@/lib/api";
import type { TeamInviteInfo } from "@/lib/api";

function InviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [invite,    setInvite]    = useState<TeamInviteInfo | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted,  setAccepted]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Detectado client-side para evitar SSR mismatch
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
  }, []);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    getInviteDetails(token).then(data => {
      if (!data) setNotFound(true);
      else setInvite(data);
      setLoading(false);
    });
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    const result = await acceptInvite(token);
    setAccepting(false);
    if (result.ok) {
      setAccepted(true);
      setTimeout(() => router.replace("/dashboard"), 2000);
    } else {
      setError(result.errorMessage ?? "Não foi possível aceitar o convite.");
    }
  }

  function handleLoginRedirect() {
    if (token) {
      localStorage.setItem("pending_invite", token);
    }
    router.push("/");
  }

  // ── estilos ──────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--bg, #F5F5F7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 20,
    padding: 40,
    maxWidth: 460,
    width: "100%",
    boxShadow: "0 30px 80px -20px rgba(0,0,0,0.15)",
    textAlign: "center",
  };

  const btnPrimary: React.CSSProperties = {
    width: "100%",
    padding: "13px 0",
    background: "#0B0B0C",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: 8,
  };

  const btnGhost: React.CSSProperties = {
    width: "100%",
    padding: "13px 0",
    background: "none",
    color: "var(--text)",
    border: "1px solid var(--border, #E8E8EF)",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: 8,
  };

  // ── estados de carregamento / erro ────────────────────────────────────────

  if (loading) {
    return (
      <div data-theme="light" style={pageStyle}>
        <div style={{ fontSize: 14, color: "var(--muted)" }}>Verificando convite...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div data-theme="light" style={pageStyle}>
        <div style={cardStyle}>
          <AlertCircle size={40} color="#E05252" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
            Convite não encontrado
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
            Este link de convite é inválido ou já expirou.
          </p>
          <button onClick={() => router.push("/")} style={btnGhost}>
            Ir para o início
          </button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div data-theme="light" style={pageStyle}>
        <div style={cardStyle}>
          <CheckCircle size={44} color="#22C55E" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>
            Bem-vindo à equipe!
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Você entrou em <strong>{invite?.tenant_name}</strong>. Redirecionando...
          </p>
        </div>
      </div>
    );
  }

  // ── convite válido ─────────────────────────────────────────────────────────

  return (
    <div data-theme="light" style={pageStyle}>
      <div style={cardStyle}>

        {/* Logo / ícone */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%", margin: "0 auto 20px",
          background: "color-mix(in oklab, var(--amber,#E6A817) 15%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Users size={24} color="var(--amber,#E6A817)" />
        </div>

        <p style={{ fontSize: 12, fontFamily: "monospace", textTransform: "uppercase",
          letterSpacing: "0.2em", color: "var(--muted)", margin: "0 0 8px" }}>
          Convite de equipe
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          {invite!.tenant_name}
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 28px" }}>
          {invite!.invited_by} convidou{" "}
          <strong style={{ color: "var(--text)" }}>{invite!.email}</strong>{" "}
          para fazer parte da equipe.
        </p>

        {error && (
          <p style={{ fontSize: 13, color: "#E05252", marginBottom: 12 }}>{error}</p>
        )}

        {isLoggedIn ? (
          <>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{ ...btnPrimary, opacity: accepting ? 0.6 : 1, cursor: accepting ? "not-allowed" : "pointer" }}
            >
              {accepting ? "Aceitando..." : "Aceitar convite"}
            </button>
            <button onClick={() => router.push("/dashboard")} style={btnGhost}>
              Agora não
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Para aceitar este convite, entre na sua conta StockOps.
            </p>
            <button onClick={handleLoginRedirect} style={btnPrimary}>
              Entrar na minha conta
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div data-theme="light" style={{ minHeight: "100vh", background: "var(--bg, #F5F5F7)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>Carregando...</span>
      </div>
    }>
      <InviteInner />
    </Suspense>
  );
}

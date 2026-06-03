"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, UserCheck, UserX, Mail, Copy, Check, Clock } from "lucide-react";
import {
  getTeamMembers,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  inviteMember,
  removeMember,
} from "@/lib/api";
import type { TenantUser, JoinRequest } from "@/types/tenant";

function initials(member: { nome_exibicao: string | null; email: string }): string {
  const name = member.nome_exibicao ?? member.email;
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function EquipeTab() {
  const [members, setMembers] = useState<TenantUser[]>([]);
  const [requests,    setRequests]    = useState<JoinRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting,    setInviting]    = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);
  // Mapa de IDs em processamento (approve/reject/remove)
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const [m, r] = await Promise.all([getTeamMembers(), getJoinRequests()]);
    setMembers(m);
    setRequests(r);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function setBusyId(id: string, state: boolean) {
    setBusy(prev => ({ ...prev, [id]: state }));
  }

  async function handleApprove(id: string) {
    setBusyId(id, true);
    const ok = await approveJoinRequest(id);
    if (ok) await refresh();
    else setBusyId(id, false);
  }

  async function handleReject(id: string) {
    setBusyId(id, true);
    const ok = await rejectJoinRequest(id);
    if (ok) await refresh();
    else setBusyId(id, false);
  }

  async function handleRemove(member: TenantUser) {
    if (!window.confirm(`Remover ${member.nome_exibicao ?? member.email} da equipe?`)) return;
    setBusyId(member.id, true);
    const ok = await removeMember(member.id);
    if (ok) await refresh();
    else setBusyId(member.id, false);
  }

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    setInviteToken(null);
    const result = await inviteMember(email);
    setInviting(false);
    if (result.ok) {
      setInviteEmail("");
      setInviteToken(result.token ?? null);
    } else {
      setInviteError(result.errorMessage ?? "Não foi possível enviar o convite.");
    }
  }

  function inviteLink(token: string): string {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/invite?token=${token}`;
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(inviteLink(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── estilos ──────────────────────────────────────────────────────────────────

  const CARD: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #E8E8EF",
    borderRadius: 16,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
    padding: 24,
    marginBottom: 24,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const memberRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid var(--border)",
  };

  const avatarStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
    background: "color-mix(in oklab, var(--amber, #E6A817) 15%, transparent)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 12, color: "var(--amber, #E6A817)",
    fontFamily: "monospace",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, boxSizing: "border-box",
    border: "1px solid var(--border)", borderRadius: 8,
    padding: "10px 14px", fontSize: 14,
    color: "var(--text)", background: "var(--surface)",
    outline: "none", fontFamily: "inherit",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 18px", background: "#0B0B0C", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  };

  const btnGhost: React.CSSProperties = {
    padding: "6px 10px", background: "none",
    border: "1px solid var(--border)", borderRadius: 6,
    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    color: "var(--text)", display: "flex", alignItems: "center", gap: 4,
  };

  const btnDanger: React.CSSProperties = {
    ...btnGhost, color: "var(--red, #E05252)", borderColor: "color-mix(in oklab, var(--red,#E05252) 30%, transparent)",
  };

  // ── render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        Carregando equipe...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 60px" }}>

      {/* ── Membros ─────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={sectionTitle}>
          <Users size={16} />
          Membros ({members.length})
        </div>

        {members.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Nenhum membro ainda. Convide alguém abaixo.
          </p>
        ) : (
          <div>
            {members.map((m, i) => (
              <div
                key={m.id}
                style={{ ...memberRow, borderBottom: i === members.length - 1 ? "none" : memberRow.borderBottom }}
              >
                <div style={avatarStyle}>{initials(m)}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.nome_exibicao ?? m.email}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                    {m.email}
                  </div>
                </div>

                {/* Badge tipo */}
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  padding: "3px 8px", borderRadius: 4,
                  background: m.tipo_perfil === "empresa"
                    ? "color-mix(in oklab, var(--amber,#E6A817) 15%, transparent)"
                    : "var(--surface)",
                  color: m.tipo_perfil === "empresa" ? "var(--amber,#E6A817)" : "var(--muted)",
                  border: `1px solid ${m.tipo_perfil === "empresa"
                    ? "color-mix(in oklab, var(--amber,#E6A817) 30%, transparent)"
                    : "var(--border)"}`,
                  flexShrink: 0,
                }}>
                  {m.tipo_perfil === "empresa" ? "Proprietário" : "Membro"}
                </span>

                {/* Data de entrada */}
                <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0, minWidth: 80, textAlign: "right" }}>
                  {formatDate(m.joined_at)}
                </span>

                {/* Remover — não disponível para proprietário */}
                {m.tipo_perfil !== "empresa" && (
                  <button
                    style={{ ...btnDanger, opacity: busy[m.id] ? 0.5 : 1 }}
                    disabled={busy[m.id]}
                    onClick={() => handleRemove(m)}
                    title="Remover membro"
                  >
                    <UserX size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Solicitações pendentes ──────────────────────────────────── */}
      <div style={CARD}>
        <div style={sectionTitle}>
          <Clock size={16} />
          Solicitações pendentes ({requests.length})
        </div>

        {requests.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Sem solicitações pendentes.
          </p>
        ) : (
          <div>
            {requests.map((r, i) => (
              <div
                key={r.id}
                style={{ ...memberRow, borderBottom: i === requests.length - 1 ? "none" : memberRow.borderBottom }}
              >
                <div style={{ ...avatarStyle, background: "color-mix(in oklab, #6366F1 12%, transparent)", color: "#6366F1" }}>
                  {initials({ nome_exibicao: r.nome_exibicao, email: r.email })}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                    {r.nome_exibicao ?? r.email}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                    {r.email}
                    <span style={{ marginLeft: 8 }}>· Solicitado em {formatDate(r.requested_at)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    style={{ ...btnGhost, color: "#15803D", borderColor: "color-mix(in oklab, #22C55E 35%, transparent)", opacity: busy[r.id] ? 0.5 : 1 }}
                    disabled={busy[r.id]}
                    onClick={() => handleApprove(r.id)}
                    title="Aprovar"
                  >
                    <UserCheck size={13} />
                    Aprovar
                  </button>
                  <button
                    style={{ ...btnDanger, opacity: busy[r.id] ? 0.5 : 1 }}
                    disabled={busy[r.id]}
                    onClick={() => handleReject(r.id)}
                    title="Recusar"
                  >
                    <UserX size={13} />
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Convidar por e-mail ─────────────────────────────────────── */}
      <div style={CARD}>
        <div style={sectionTitle}>
          <Mail size={16} />
          Convidar por e-mail
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="email"
            placeholder="email@exemplo.com"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteError(null); setInviteToken(null); }}
            onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
            style={inputStyle}
            disabled={inviting}
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{ ...btnPrimary, opacity: (inviting || !inviteEmail.trim()) ? 0.5 : 1 }}
          >
            {inviting ? "Enviando..." : "Enviar convite"}
          </button>
        </div>

        {inviteError && (
          <p style={{ marginTop: 10, fontSize: 12, color: "var(--red, #E05252)" }}>{inviteError}</p>
        )}

        {/* Link do convite após envio */}
        {inviteToken && (
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 8,
            background: "color-mix(in oklab, #22C55E 8%, transparent)",
            border: "1px solid color-mix(in oklab, #22C55E 25%, transparent)",
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#15803D", margin: "0 0 8px" }}>
              Convite criado! Compartilhe o link abaixo:
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{
                flex: 1, fontSize: 11, padding: "6px 10px",
                borderRadius: 6, background: "#fff",
                border: "1px solid var(--border)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                display: "block", color: "var(--text)",
              }}>
                {inviteLink(inviteToken)}
              </code>
              <button
                onClick={() => handleCopy(inviteToken)}
                style={{ ...btnGhost, flexShrink: 0 }}
              >
                {copied ? <Check size={13} color="#22C55E" /> : <Copy size={13} />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

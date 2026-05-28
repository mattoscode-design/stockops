"use client";

import { useState, useEffect } from "react";
import { X, User, Search, CheckCircle } from "lucide-react";
import { updateProfile, searchTenants, requestJoinTenant } from "@/lib/api";
import type { UserProfile } from "@/lib/api";
import type { TenantSearchResult } from "@/types/tenant";

interface ProfileModalProps {
  profile: UserProfile;
  isOnboarding?: boolean;
  onSaved: (updated: UserProfile) => void;
  onClose?: () => void;
}

export default function ProfileModal({
  profile,
  isOnboarding = false,
  onSaved,
  onClose,
}: ProfileModalProps) {
  const [username,      setUsername]      = useState(profile.username ?? "");
  const [nomeExibicao,  setNomeExibicao]  = useState(profile.nome_exibicao ?? "");
  const [tipoPerfil,    setTipoPerfil]    = useState<"empresa" | "colaborador">(
    profile.tipo_perfil === "colaborador" ? "colaborador" : "empresa"
  );
  // Colaborador: query = texto digitado; selectedTenant = empresa confirmada
  const [tenantQuery,    setTenantQuery]    = useState(profile.empresa_nome ?? "");
  const [tenantResults,  setTenantSearchResults]  = useState<TenantSearchResult[]>([]);
  const [tenantLoading,  setTenantLoading]  = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantSearchResult | null>(null);
  const [joinStatus,     setJoinStatus]     = useState<"idle" | "sent" | "error">("idle");
  const [joinError,      setJoinError]      = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Busca empresas com debounce — só quando colaborador e sem seleção ativa
  useEffect(() => {
    if (tipoPerfil !== "colaborador" || selectedTenant || tenantQuery.trim().length < 2) {
      if (!selectedTenant) setTenantSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setTenantLoading(true);
      const results = await searchTenants(tenantQuery.trim());
      setTenantSearchResults(results);
      setTenantLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [tenantQuery, tipoPerfil, selectedTenant]);

  function handleTenantQueryChange(value: string) {
    setTenantQuery(value);
    setSelectedTenant(null); // limpa seleção ao digitar
    setJoinStatus("idle");
  }

  function handleSelectTenant(t: TenantSearchResult) {
    setSelectedTenant(t);
    setTenantQuery(t.name);
    setTenantSearchResults([]);
  }

  async function handleSave() {
    const usernameClean = username.trim().replace(/^@+/, "");
    if (!usernameClean) { setError("Username é obrigatório."); return; }
    if (!/^[a-zA-Z0-9_.]+$/.test(usernameClean)) {
      setError("Username pode conter apenas letras, números, . e _");
      return;
    }
    if (!nomeExibicao.trim()) { setError("O nome de exibição é obrigatório."); return; }

    setError(null);
    setSaving(true);

    const empresaNome =
      tipoPerfil === "colaborador"
        ? (selectedTenant?.name ?? (tenantQuery.trim() || null))
        : null;

    const result = await updateProfile({
      username: usernameClean,
      nome_exibicao: nomeExibicao.trim(),
      tipo_perfil: tipoPerfil,
      empresa_nome: empresaNome,
    });

    if (!result.ok) {
      setSaving(false);
      setError(result.errorMessage ?? "Não foi possível salvar. Tente novamente.");
      return;
    }

    const updatedProfile: UserProfile = {
      ...profile,
      username: usernameClean,
      nome_exibicao: nomeExibicao.trim(),
      tipo_perfil: tipoPerfil,
      empresa_nome: empresaNome,
    };

    // Colaborador selecionou uma empresa do sistema → enviar solicitação de entrada
    if (tipoPerfil === "colaborador" && selectedTenant) {
      const joinResult = await requestJoinTenant(selectedTenant.id);
      setSaving(false);
      setJoinStatus(joinResult.ok ? "sent" : "error");
      if (!joinResult.ok) setJoinError(joinResult.errorMessage ?? null);
      // Fecha modal após 1.5 s independente do resultado (perfil já foi salvo)
      setTimeout(() => onSaved(updatedProfile), 1500);
      return;
    }

    setSaving(false);
    onSaved(updatedProfile);
  }

  // ── estilos reutilizáveis ──────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--text)",
    background: "var(--surface)",
    outline: "none",
  };

  const labelCapStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    color: "var(--muted)",
    marginBottom: 6,
  };

  // ── render ─────────────────────────────────────────────────────────────────

  const showJoinFeedback = joinStatus !== "idle";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.3)",
          position: "relative", padding: 32,
        }}
      >
        {/* Botão fechar — oculto no onboarding */}
        {!isOnboarding && onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              position: "absolute", top: 16, right: 16, background: "none",
              border: "none", cursor: "pointer", color: "var(--muted)", padding: 4,
              display: "flex", alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "color-mix(in oklab, var(--amber, #E6A817) 15%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <User size={20} color="var(--amber, #E6A817)" />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0 }}>
              {isOnboarding ? "Complete seu perfil" : "Editar perfil"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
              {isOnboarding ? "Antes de continuar, como quer ser chamado?" : profile.email}
            </p>
          </div>
        </div>

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Username */}
          <label style={{ display: "block" }}>
            <span style={labelCapStyle}>Username</span>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontFamily: "monospace", fontSize: 14, color: "var(--muted)",
                pointerEvents: "none", userSelect: "none",
              }}>@</span>
              <input
                type="text"
                placeholder="joao_silva"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/^@+/, ""))}
                autoFocus
                style={{ ...inputStyle, paddingLeft: 28 }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
              Identificador único. Só letras, números, . e _
            </span>
          </label>

          {/* Nome de exibição */}
          <label style={{ display: "block" }}>
            <span style={labelCapStyle}>Nome de exibição *</span>
            <input
              type="text"
              placeholder="Como quer ser chamado"
              value={nomeExibicao}
              onChange={e => setNomeExibicao(e.target.value)}
              style={inputStyle}
            />
          </label>

          {/* Tipo de perfil */}
          <div>
            <span style={labelCapStyle}>Tipo de perfil</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(
                [
                  { value: "empresa",     label: "Sou uma empresa" },
                  { value: "colaborador", label: "Sou colaborador de uma empresa" },
                ] as const
              ).map(opt => (
                <label
                  key={opt.value}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "var(--text)" }}
                >
                  <input
                    type="radio"
                    name="tipo_perfil"
                    value={opt.value}
                    checked={tipoPerfil === opt.value}
                    onChange={() => {
                      setTipoPerfil(opt.value);
                      if (opt.value === "empresa") {
                        setSelectedTenant(null);
                        setTenantSearchResults([]);
                        setJoinStatus("idle");
                      }
                    }}
                    style={{ accentColor: "var(--amber, #E6A817)", width: 16, height: 16 }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Busca de empresa — só para colaborador */}
          {tipoPerfil === "colaborador" && (
            <div>
              <span style={labelCapStyle}>Empresa</span>

              {/* Campo de busca */}
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  color: "var(--muted)", pointerEvents: "none", display: "flex",
                }}>
                  {tenantLoading
                    ? <span style={{ fontSize: 12, color: "var(--muted)" }}>...</span>
                    : <Search size={14} />}
                </span>
                <input
                  type="text"
                  placeholder="Buscar empresa no StockOps"
                  value={tenantQuery}
                  onChange={e => handleTenantQueryChange(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                />
              </div>

              {/* Resultados da busca */}
              {tenantResults.length > 0 && (
                <div style={{
                  marginTop: 4,
                  border: "1px solid var(--border)", borderRadius: 8,
                  background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}>
                  {tenantResults.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTenant(t)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 14px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 14, color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                    >
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                        @{t.slug}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Empresa selecionada */}
              {selectedTenant && (
                <div style={{
                  marginTop: 6, display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 12px", borderRadius: 8,
                  background: "color-mix(in oklab, #22C55E 10%, transparent)",
                  border: "1px solid color-mix(in oklab, #22C55E 30%, transparent)",
                }}>
                  <CheckCircle size={14} color="#22C55E" />
                  <span style={{ fontSize: 13, color: "#15803D", fontWeight: 500 }}>
                    {selectedTenant.name}
                  </span>
                  <span style={{ fontSize: 11, color: "#15803D", marginLeft: 4 }}>
                    — solicitação enviada ao salvar
                  </span>
                </div>
              )}

              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
                {tenantQuery.trim().length < 2 && !selectedTenant
                  ? "Digite ao menos 2 caracteres para buscar."
                  : tenantResults.length === 0 && !tenantLoading && !selectedTenant && tenantQuery.trim().length >= 2
                  ? "Nenhuma empresa encontrada — o texto digitado será salvo como nome."
                  : ""}
              </span>
            </div>
          )}
        </div>

        {/* Feedback de erro de validação */}
        {error && (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--red, #E05252)" }}>{error}</p>
        )}

        {/* Feedback de solicitação de entrada */}
        {showJoinFeedback && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: joinStatus === "sent"
              ? "color-mix(in oklab, #22C55E 10%, transparent)"
              : "color-mix(in oklab, var(--red, #E05252) 10%, transparent)",
            border: `1px solid ${joinStatus === "sent"
              ? "color-mix(in oklab, #22C55E 30%, transparent)"
              : "color-mix(in oklab, var(--red, #E05252) 30%, transparent)"}`,
            color: joinStatus === "sent" ? "#15803D" : "var(--red, #E05252)",
          }}>
            {joinStatus === "sent"
              ? `Solicitação enviada para ${selectedTenant?.name}. Aguardando aprovação.`
              : (joinError ?? "Não foi possível enviar a solicitação. Tente novamente.")}
          </div>
        )}

        {/* Botão salvar */}
        <button
          onClick={handleSave}
          disabled={saving || showJoinFeedback}
          style={{
            marginTop: 24, width: "100%",
            background: "#0B0B0C", color: "#fff",
            border: "none", borderRadius: 8, padding: "12px 0",
            fontSize: 14, fontWeight: 600,
            cursor: (saving || showJoinFeedback) ? "not-allowed" : "pointer",
            opacity: (saving || showJoinFeedback) ? 0.6 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}

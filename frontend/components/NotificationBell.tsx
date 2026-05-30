"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Mail, AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getMyInvites } from "@/lib/api";
import type { TeamInviteInfo } from "@/lib/api";
import type { AnalysisResult } from "@/types/analysis";

interface Props {
  result: AnalysisResult | null;
  onStockAlertClick: (sku: string) => void;
}

export default function NotificationBell({ result, onStockAlertClick }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<TeamInviteInfo[]>([]);

  useEffect(() => {
    getMyInvites().then(setInvites);
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const stockAlerts = (result?.resultados ?? [])
    .filter(r => r.score_ruptura >= 71)
    .slice(0, 5);

  const total = invites.length + stockAlerts.length;

  function handleInviteClick(invite: TeamInviteInfo) {
    setOpen(false);
    router.push(`/invite?token=${invite.token}`);
  }

  function handleAlertClick(sku: string) {
    setOpen(false);
    onStockAlertClick(sku);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Botão sino */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notificações${total > 0 ? ` (${total})` : ""}`}
        style={{
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 8,
          background: open ? "var(--surface, #F5F5F7)" : "none",
          border: "none", cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "var(--border, #E8E8EF)"; }}
        onMouseOut={e => { e.currentTarget.style.background = open ? "var(--surface, #F5F5F7)" : "none"; }}
      >
        <Bell size={17} color="var(--muted)" />
        {total > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: "var(--red, #E05252)", color: "#fff",
            fontSize: 9, fontWeight: 700, fontFamily: "monospace",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 340, maxHeight: 440, overflowY: "auto",
          background: "#fff", borderRadius: 12,
          border: "1px solid var(--border, #E8E8EF)",
          boxShadow: "0 16px 48px -8px rgba(0,0,0,0.18)",
          zIndex: 100,
        }}>
          {/* Cabeçalho */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Notificações</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
              <X size={14} />
            </button>
          </div>

          {total === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Nenhuma notificação
            </div>
          ) : (
            <>
              {/* Convites */}
              {invites.length > 0 && (
                <div>
                  <div style={{ padding: "10px 16px 4px", fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)" }}>
                    Convites
                  </div>
                  {invites.map(inv => (
                    <button
                      key={inv.token}
                      onClick={() => handleInviteClick(inv)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        width: "100%", textAlign: "left", padding: "10px 16px",
                        background: "none", border: "none", cursor: "pointer",
                        borderBottom: "1px solid var(--border)", fontFamily: "inherit",
                        transition: "background 0.12s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "var(--surface, #F5F5F7)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <span style={{ marginTop: 2, flexShrink: 0, display: "flex", width: 28, height: 28, borderRadius: "50%", background: "color-mix(in oklab, #6366F1 12%, transparent)", alignItems: "center", justifyContent: "center" }}>
                        <Mail size={13} color="#6366F1" />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                          Convite de {inv.tenant_name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                          Convidado por {inv.invited_by}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#6366F1", marginTop: 4, flexShrink: 0 }}>
                        Ver →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Alertas de estoque */}
              {stockAlerts.length > 0 && (
                <div>
                  <div style={{ padding: "10px 16px 4px", fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)" }}>
                    Alertas de estoque
                  </div>
                  {stockAlerts.map(row => (
                    <button
                      key={`${row.sku}-${row.loja}`}
                      onClick={() => handleAlertClick(row.sku)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        width: "100%", textAlign: "left", padding: "10px 16px",
                        background: "none", border: "none", cursor: "pointer",
                        borderBottom: "1px solid var(--border)", fontFamily: "inherit",
                        transition: "background 0.12s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "var(--surface, #F5F5F7)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <span style={{ marginTop: 2, flexShrink: 0, display: "flex", width: 28, height: 28, borderRadius: "50%", background: row.score_ruptura >= 86 ? "color-mix(in oklab, var(--red,#E05252) 12%, transparent)" : "color-mix(in oklab, var(--amber,#E6A817) 15%, transparent)", alignItems: "center", justifyContent: "center" }}>
                        <AlertTriangle size={13} color={row.score_ruptura >= 86 ? "var(--red,#E05252)" : "var(--amber,#E6A817)"} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.nome ?? row.sku}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                          {row.loja} · score {row.score_ruptura} · {row.classificacao}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: row.score_ruptura >= 86 ? "var(--red,#E05252)" : "var(--amber,#E6A817)", marginTop: 4, flexShrink: 0 }}>
                        Estoque →
                      </span>
                    </button>
                  ))}
                  {(result?.resultados ?? []).filter(r => r.score_ruptura >= 71).length > 5 && (
                    <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                      +{(result?.resultados ?? []).filter(r => r.score_ruptura >= 71).length - 5} itens adicionais no Ranking
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

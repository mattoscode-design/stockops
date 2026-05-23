"use client";

import { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AnalysisRow } from "@/types/analysis";

const STATUS_PILL: Record<string, string> = {
  "Urgente":           "bg-danger/15 text-danger border-danger/30",
  "Ação Recomendada":  "bg-amber-signal/20 text-amber-signal border-amber-signal/40",
  "Alerta":            "bg-amber-soft text-ink border-amber-signal/30",
  "Monitoramento":     "bg-success/15 text-success border-success/30",
};

const CURVA_PILL: Record<string, string> = {
  A: "bg-danger/15 text-danger border-danger/40",
  B: "bg-amber-signal/15 text-amber-signal border-amber-signal/40",
  C: "bg-success/15 text-success border-success/40",
};

function scoreColor(score: number) {
  if (score >= 86) return "var(--danger)";
  if (score >= 71) return "var(--amber-signal)";
  if (score >= 51) return "oklch(0.78 0.14 85)";
  return "var(--success)";
}

function exportToCSV(rows: AnalysisRow[]) {
  const headers = ["Código","EAN","Produto","Loja","Categoria","ABC","Cobertura (d)","Score","Status","Perda (R$)","Reposição","Insight","Recomendação"];
  const esc = (v: string|number) => typeof v === "string" ? `"${v.replace(/"/g,'""')}"` : v;
  const lines = [headers.join(","), ...rows.map(r => [
    esc(r.sku),esc(r.ean||""),esc(r.nome || r.sku),esc(r.loja),esc(r.categoria),esc(r.curva_abc||"C"),
    r.cobertura_dias,r.score_ruptura,esc(r.classificacao),
    r.perda_estimada_reais,r.quantidade_recomendada,
    esc(r.insight),esc(r.recomendacao),
  ].join(","))];
  const blob = new Blob(["﻿"+lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `stockops_${new Date().toISOString().slice(0,10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

const SEL = {
  background:"var(--surface-2)", border:"1px solid var(--border)",
  color:"var(--text)", borderRadius:"6px", padding:"6px 10px", fontSize:"12px", outline:"none",
};

interface Props { rows: AnalysisRow[]; categorias: string[]; }

/** Altura estimada por linha normal (sem painel expandido) */
const ROW_HEIGHT = 52;

/* Recalcula curva ABC no frontend quando todos os valores são "C" */
function getAbcMap(rows: AnalysisRow[]): Map<string, string> | null {
  const allC = rows.every(r => !r.curva_abc || r.curva_abc === "C");
  if (!allC) return null;
  const total = rows.reduce((s, r) => s + r.perda_estimada_reais, 0);
  if (total === 0) return null;
  const sorted = [...rows].sort((a, b) => b.perda_estimada_reais - a.perda_estimada_reais);
  let cum = 0;
  const map = new Map<string, string>();
  sorted.forEach(r => {
    cum += r.perda_estimada_reais / total;
    map.set(`${r.sku}::${r.loja}`, cum <= 0.80 ? "A" : cum <= 0.95 ? "B" : "C");
  });
  return map;
}

export default function RiskTable({ rows, categorias }: Props) {
  const abcFallback = useMemo(() => getAbcMap(rows), [rows]);
  const getAbc = useCallback((row: AnalysisRow) =>
    abcFallback ? (abcFallback.get(`${row.sku}::${row.loja}`) ?? "C") : (row.curva_abc || "C"),
  [abcFallback]);

  const [expanded, setExpanded] = useState<string|null>(null);
  const [fCat,    setFCat]    = useState("all");
  const [fLoja,   setFLoja]   = useState("");
  const [fABC,    setFABC]    = useState("all");
  const [fStatus, setFStatus] = useState("all");

  // Debounce no filtro de loja via React 19 useDeferredValue
  const deferredLoja = useDeferredValue(fLoja);

  const filtered = useMemo(() => rows.filter(r => {
    if (fCat !== "all" && r.categoria !== fCat) return false;
    if (deferredLoja && !r.loja.toLowerCase().includes(deferredLoja.toLowerCase())) return false;
    if (fABC !== "all" && (r.curva_abc||"C") !== fABC) return false;
    if (fStatus !== "all" && r.classificacao !== fStatus) return false;
    return true;
  }), [rows, fCat, deferredLoja, fABC, fStatus]);

  // Fechar linha expandida ao trocar filtros (a chave pode não existir mais)
  useEffect(() => { setExpanded(null); }, [fCat, deferredLoja, fABC, fStatus]);

  const toggle = (k: string) => setExpanded(p => p === k ? null : k);

  // ── Virtualização ──────────────────────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
    // measureElement permite altura dinâmica (linha expandida vs normal)
    measureElement: el => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const topPad    = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const bottomPad = virtualItems.length > 0
    ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select value={fCat} onChange={e => setFCat(e.target.value)} style={SEL}>
            <option value="all">Todas categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={SEL}>
            <option value="all">Todos os status</option>
            <option value="Urgente">Urgente</option>
            <option value="Ação Recomendada">Ação Recomendada</option>
            <option value="Alerta">Alerta</option>
            <option value="Monitoramento">Monitoramento</option>
          </select>
          <select value={fABC} onChange={e => setFABC(e.target.value)} style={SEL}>
            <option value="all">Curva ABC — todas</option>
            <option value="A">Curva A</option>
            <option value="B">Curva B</option>
            <option value="C">Curva C</option>
          </select>
          <input placeholder="Filtrar por loja..." value={fLoja}
            onChange={e => setFLoja(e.target.value)}
            style={{ ...SEL, minWidth: 160 }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:"var(--muted)" }}>
            {filtered.length}/{rows.length} SKUs
          </span>
          <button onClick={() => exportToCSV(filtered)} className="btn-ghost" style={{ fontSize:12, padding:"6px 12px", borderRadius:7 }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Tabela virtualizada
          overflow: clip no outer div preserva border-radius sem quebrar position:sticky
          do thead — usar overflow:hidden quebraria o sticky no Safari/Chrome */}
      <div style={{ border:"1px solid #E2E2EA", borderRadius: 14, overflow: "clip", background:"#fff", boxShadow:"0 2px 16px rgba(0,0,0,0.04)" }}>
        <div
          ref={parentRef}
          style={{ overflowY: "auto", overflowX: "auto", height: 600 }}
        >
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth: 800 }}>

            {/* Cabeçalho fixo — sticky dentro do scroll container */}
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ background:"#F7F7FA", borderBottom:"1px solid #E2E2EA" }}>
                {["Código","EAN","Produto","Loja","Categoria","ABC","Cobertura","Score","Status","Perda Est."].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700,
                    letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8", whiteSpace:"nowrap",
                    background:"#F7F7FA" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            {filtered.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} style={{ padding:"48px", textAlign:"center", color:"#9090A8", background:"#FAFAFA", fontSize:14 }}>
                    Nenhum SKU corresponde aos filtros.
                  </td>
                </tr>
              </tbody>
            ) : (
              <>
                {/* Espaçador superior — itens acima da janela visível */}
                {topPad > 0 && (
                  <tbody aria-hidden="true">
                    <tr><td colSpan={10} style={{ height: topPad, padding: 0 }} /></tr>
                  </tbody>
                )}

                {/* Itens virtualizados
                    Cada <tbody> = 1 linha de dados + painel de detalhe (se expandido).
                    measureElement no <tbody> captura a altura total das duas linhas,
                    e o ResizeObserver embutido re-mede automaticamente ao expandir. */}
                {virtualItems.map(virtualRow => {
                  const row = filtered[virtualRow.index];
                  const key = `${row.sku}::${row.loja}::${virtualRow.index}`;
                  const isOpen = expanded === key;
                  const sc = scoreColor(row.score_ruptura);
                  const abc = getAbc(row);

                  return (
                    <tbody
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                    >
                      {/* Linha principal */}
                      <tr
                        onClick={() => toggle(key)}
                        style={{ background: isOpen ? "#F0F0F8" : "#FFFFFF", borderBottom: isOpen ? "none" : "1px solid var(--border)", cursor:"pointer", transition:"background 0.15s", display:"table-row" }}
                        onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "#F5F5FA"; }}
                        onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}
                      >
                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:12, fontWeight:600, color:"var(--text)", width:"12%", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:120 }}>{row.sku}</td>
                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:11, color:"var(--muted)", width:"12%", whiteSpace:"nowrap" }}>{row.ean || "—"}</td>
                        <td style={{ padding:"12px 14px", fontSize:13, color:"var(--text)", width:"15%", overflow:"hidden", textOverflow:"ellipsis", maxWidth:160 }}>{row.nome || row.sku}</td>
                        <td style={{ padding:"12px 14px", fontSize:12, color:"var(--muted)", width:"14%", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.loja}</td>
                        <td style={{ padding:"12px 14px", fontSize:12, color:"var(--muted)", width:"15%", whiteSpace:"nowrap" }}>{row.categoria || "—"}</td>
                        <td style={{ padding:"12px 14px", width:"10%" }}>
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border font-mono text-[11px] font-semibold ${CURVA_PILL[abc] ?? ""}`}>
                            {abc}
                          </span>
                        </td>
                        <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:13, width:"11%", color: row.cobertura_dias < 3 ? "var(--danger)" : "var(--text)" }}>{row.cobertura_dias}d</td>
                        <td style={{ padding:"12px 14px", minWidth:90, width:"11%" }}>
                          <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:sc, marginBottom:4 }}>{row.score_ruptura}</div>
                          <div className="score-bar"><div className="score-bar-fill" style={{ width:`${row.score_ruptura}%`, background:sc }} /></div>
                        </td>
                        <td style={{ padding:"12px 14px", whiteSpace:"nowrap", width:"17%" }}>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_PILL[row.classificacao] ?? ""}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />{row.classificacao}
                            </span>
                            {row.validade_dias_restantes != null && row.validade_dias_restantes <= 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-danger">
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />Vencido
                              </span>
                            )}
                            {row.validade_dias_restantes != null && row.validade_dias_restantes > 0 && row.validade_dias_restantes < row.cobertura_dias && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-danger">
                                Vence em {row.validade_dias_restantes}d
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding:"12px 14px", textAlign:"right", fontFamily:"monospace", fontSize:12, color:"var(--text)", whiteSpace:"nowrap", width:"12%" }}>
                          R$ {row.perda_estimada_reais.toLocaleString("pt-BR",{minimumFractionDigits:2})}
                        </td>
                      </tr>

                      {/* Painel de detalhe expandido */}
                      {isOpen && (
                        <tr>
                          <td colSpan={10} style={{ background:"#F5F5FA", borderBottom:"1px solid #E2E2EA", padding:"16px 14px" }}>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                              <div>
                                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:"#9090A8", marginBottom:4 }}>Insight</div>
                                <div style={{ fontSize:13, color:"#0A0A14", lineHeight:1.5 }}>{row.insight}</div>
                              </div>
                              <div>
                                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:"#9090A8", marginBottom:4 }}>Recomendação</div>
                                <div style={{ fontSize:13, color:"#D97706", lineHeight:1.5, fontWeight:500 }}>{row.recomendacao}</div>
                              </div>
                              <div style={{ display:"flex", gap:24 }}>
                                <div>
                                  <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:"#9090A8", marginBottom:4 }}>Reposição</div>
                                  <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#0A0A14" }}>{row.quantidade_recomendada.toFixed(0)} un.</div>
                                </div>
                                <div>
                                  <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:"#9090A8", marginBottom:4 }}>Curva ABC</div>
                                  <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color: abc === "A" ? "var(--danger)" : abc === "B" ? "var(--amber-signal)" : "var(--success)" }}>{abc} {abc === "A" ? "— Alto impacto" : abc === "B" ? "— Médio impacto" : "— Baixo impacto"}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}

                {/* Espaçador inferior — itens abaixo da janela visível */}
                {bottomPad > 0 && (
                  <tbody aria-hidden="true">
                    <tr><td colSpan={10} style={{ height: bottomPad, padding: 0 }} /></tr>
                  </tbody>
                )}
              </>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useDeferredValue, useCallback } from "react";
import type { AnalysisRow } from "@/types/analysis";

const RISK_COLORS: Record<string, string> = {
  Urgente:            "#E05252",
  "Ação Recomendada": "#E88A00",
  Alerta:             "#E8C200",
  Monitoramento:      "#3DB87A",
};
const ABC_COLORS: Record<string, string> = { A: "#E05252", B: "#E88A00", C: "#3DB87A" };

function scoreColor(score: number) {
  if (score >= 86) return "#E05252";
  if (score >= 71) return "#E88A00";
  if (score >= 51) return "#E8C200";
  return "#3DB87A";
}

function exportToCSV(rows: AnalysisRow[]) {
  const headers = ["SKU","Loja","Categoria","ABC","Cobertura (d)","Score","Status","Perda (R$)","Reposição","Insight","Recomendação"];
  const esc = (v: string|number) => typeof v === "string" ? `"${v.replace(/"/g,'""')}"` : v;
  const lines = [headers.join(","), ...rows.map(r => [
    esc(r.sku),esc(r.loja),esc(r.categoria),esc(r.curva_abc||"C"),
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

const PAGE_SIZES = [10, 25, 50];

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
  const [page,    setPage]    = useState(1);
  const [pageSize,setPageSize]= useState(25);

  // Debounce no filtro de loja via React 19 useDeferredValue
  const deferredLoja = useDeferredValue(fLoja);

  const filtered = useMemo(() => rows.filter(r => {
    if (fCat !== "all" && r.categoria !== fCat) return false;
    if (deferredLoja && !r.loja.toLowerCase().includes(deferredLoja.toLowerCase())) return false;
    if (fABC !== "all" && (r.curva_abc||"C") !== fABC) return false;
    if (fStatus !== "all" && r.classificacao !== fStatus) return false;
    return true;
  }), [rows, fCat, deferredLoja, fABC, fStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filter changes
  useMemo(() => setPage(1), [fCat, deferredLoja, fABC, fStatus, pageSize]);

  const toggle = (k: string) => setExpanded(p => p === k ? null : k);

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
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ ...SEL, padding:"4px 8px" }}>
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} por página</option>)}
          </select>
          <button onClick={() => exportToCSV(filtered)} className="btn-ghost" style={{ fontSize:12, padding:"6px 12px", borderRadius:7 }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Tabela com scroll horizontal */}
      <div style={{ border:"1px solid #E2E2EA", borderRadius: 14, overflow:"hidden", background:"#fff", boxShadow:"0 2px 16px rgba(0,0,0,0.04)" }}>
        <div className="overflow-x-auto">
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background:"#F7F7FA", borderBottom:"1px solid #E2E2EA" }}>
                {["SKU","Loja","Categoria","ABC","Cobertura","Score","Status","Perda Est."].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700,
                    letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8", whiteSpace:"nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding:"48px", textAlign:"center", color:"#9090A8", background:"#FAFAFA", fontSize:14 }}>
                    Nenhum SKU corresponde aos filtros.
                  </td>
                </tr>
              ) : paginated.map((row, i) => {
                const key = `${row.sku}::${row.loja}::${i}`;
                const isOpen = expanded === key;
                const sc = scoreColor(row.score_ruptura);
                const tc = RISK_COLORS[row.classificacao] ?? "var(--muted)";
                const abc = getAbc(row);
                const abcC = ABC_COLORS[abc] ?? "#888";

                return (
                  <tr key={key}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <table style={{ width:"100%", borderCollapse:"collapse" }}>
                        <tbody>
                          <tr onClick={() => toggle(key)}
                            style={{ background: isOpen ? "#F0F0F8" : "#FFFFFF", borderBottom: isOpen ? "none" : "1px solid var(--border)", cursor:"pointer", transition:"background 0.15s", display:"table-row" }}
                            onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "#F5F5FA"; }}
                            onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}>
                            <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:13, fontWeight:500, color:"var(--text)", width:"25%", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:180 }}>{row.sku}</td>
                            <td style={{ padding:"12px 14px", fontSize:12, color:"var(--muted)", width:"19%", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.loja}</td>
                            <td style={{ padding:"12px 14px", fontSize:12, color:"var(--muted)", width:"15%", whiteSpace:"nowrap" }}>{row.categoria || "—"}</td>
                            <td style={{ padding:"12px 14px", width:"10%" }}>
                              <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:4, color:abcC, background:`${abcC}18`, border:`1px solid ${abcC}40` }}>{abc}</span>
                            </td>
                            <td style={{ padding:"12px 14px", fontFamily:"monospace", fontSize:13, width:"11%", color: row.cobertura_dias < 3 ? "#E05252" : "var(--text)" }}>{row.cobertura_dias}d</td>
                            <td style={{ padding:"12px 14px", minWidth:90, width:"11%" }}>
                              <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:sc, marginBottom:4 }}>{row.score_ruptura}</div>
                              <div className="score-bar"><div className="score-bar-fill" style={{ width:`${row.score_ruptura}%`, background:sc }} /></div>
                            </td>
                            <td style={{ padding:"12px 14px", whiteSpace:"nowrap", width:"17%" }}>
                              <span style={{ fontSize:11, fontWeight:500, padding:"3px 8px", borderRadius:4, color:tc, background:`${tc}18`, border:`1px solid ${tc}40` }}>{row.classificacao}</span>
                            </td>
                            <td style={{ padding:"12px 14px", textAlign:"right", fontFamily:"monospace", fontSize:12, color:"var(--text)", whiteSpace:"nowrap", width:"12%" }}>
                              R$ {row.perda_estimada_reais.toLocaleString("pt-BR",{minimumFractionDigits:2})}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr>
                              <td colSpan={8} style={{ background:"#F5F5FA", borderBottom:"1px solid #E2E2EA", padding:"16px 14px" }}>
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
                                      <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:abcC }}>{abc} {abc === "A" ? "— Alto impacto" : abc === "B" ? "— Médio impacto" : "— Baixo impacto"}</div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 4px" }}>
          <span style={{ fontSize:12, color:"var(--muted)" }}>
            Página {page} de {totalPages} · {filtered.length} SKUs
          </span>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} className="btn-ghost" style={{ fontSize:12, padding:"5px 10px", borderRadius:6, opacity: page===1 ? 0.4 : 1 }}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-ghost" style={{ fontSize:12, padding:"5px 10px", borderRadius:6, opacity: page===1 ? 0.4 : 1 }}>‹</button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return p <= totalPages ? (
                <button key={p} onClick={() => setPage(p)}
                  style={{ fontSize:12, padding:"5px 10px", borderRadius:6, border:`1px solid ${p===page ? "var(--amber)" : "var(--border)"}`, background: p===page ? "var(--amber)" : "transparent", color: p===page ? "#0B0B0C" : "var(--muted)", cursor:"pointer", fontFamily:"monospace" }}>
                  {p}
                </button>
              ) : null;
            })}

            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="btn-ghost" style={{ fontSize:12, padding:"5px 10px", borderRadius:6, opacity: page===totalPages ? 0.4 : 1 }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="btn-ghost" style={{ fontSize:12, padding:"5px 10px", borderRadius:6, opacity: page===totalPages ? 0.4 : 1 }}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}

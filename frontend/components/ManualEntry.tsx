"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { apiFetch } from "@/lib/api";
import { addItem, loadInventory } from "@/lib/inventory";
import { toast } from "@/components/Toast";

interface StockRow {
  id: string;
  sku: string;
  ean: string;
  loja: string;
  categoria: string;
  estoque_atual: string;
  vendas_diarias: string;
  preco_medio: string;
  promocao_planejada: string;
}

function newRow(): StockRow {
  return {
    id: crypto.randomUUID(),
    sku: "", ean: "", loja: "", categoria: "",
    estoque_atual: "", vendas_diarias: "", preco_medio: "",
    promocao_planejada: "0",
  };
}

function rowsToCsv(rows: StockRow[]): string {
  const header = "sku,ean,loja,categoria,estoque_atual,vendas_diarias,preco_medio,promocao_planejada";
  const lines = rows.map(r =>
    [r.sku, r.ean, r.loja, r.categoria, r.estoque_atual, r.vendas_diarias, r.preco_medio, r.promocao_planejada]
      .map(v => `"${v.replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

const COLS = [
  { key: "sku",                label: "Produto / SKU",    placeholder: "Ex: Energético 473ml", req: true,  width: 190, type: "text"   },
  { key: "ean",                label: "EAN",              placeholder: "7891234567890",         req: true,  width: 140, type: "text"   },
  { key: "loja",               label: "Loja",             placeholder: "Ex: Loja SP-Norte",    req: true,  width: 150, type: "text"   },
  { key: "categoria",          label: "Categoria",        placeholder: "Ex: Bebidas",           req: false, width: 120, type: "text"   },
  { key: "estoque_atual",      label: "Estoque",          placeholder: "0",                    req: true,  width: 90,  type: "number" },
  { key: "vendas_diarias",     label: "Vendas/dia",       placeholder: "0.0",                  req: true,  width: 100, type: "number" },
  { key: "preco_medio",        label: "Preço (R$)",       placeholder: "0.00",                 req: true,  width: 100, type: "number" },
  { key: "promocao_planejada", label: "Promo %",          placeholder: "0",                    req: false, width: 80,  type: "number" },
] as const;

interface Props {
  onResult: (data: AnalysisResult) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
}

export default function ManualEntry({ onResult, onLoading, loading }: Props) {
  const [rows, setRows] = useState<StockRow[]>([newRow(), newRow(), newRow()]);
  const [error, setError] = useState("");
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

  function update(id: string, field: keyof StockRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow() { setRows(prev => [...prev, newRow()]); }

  function removeRow(id: string) {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function duplicateRow(id: string) {
    const src = rows.find(r => r.id === id);
    if (!src) return;
    const dup = { ...src, id: crypto.randomUUID() };
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  }

  const validRows = rows.filter(r => r.sku.trim() && r.ean.trim() && r.loja.trim() && r.estoque_atual && r.vendas_diarias && r.preco_medio);

  async function submit() {
    if (validRows.length === 0) {
      setError("Preencha ao menos 1 linha com SKU, EAN, Loja, Estoque, Vendas/dia e Preço.");
      return;
    }
    setError("");
    onLoading(true);
    const csv = rowsToCsv(validRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const fd = new FormData();
    fd.append("file", blob, "entrada_manual.csv");
    try {
      const res = await apiFetch("/analysis/upload", { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); setError(e.detail ?? "Erro ao processar."); return; }
      onResult(await res.json());

      // C1 — salvar itens no inventário via API (somente novos)
      const existing = await loadInventory();
      const existingKeys = new Set(existing.map(i => `${i.sku}::${i.loja}`));
      const toAdd = validRows.filter(r => !existingKeys.has(`${r.sku}::${r.loja}`));
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map(r => addItem({
          sku: r.sku,
          ean: r.ean || undefined,
          loja: r.loja,
          categoria: r.categoria || "Sem Categoria",
          estoque_atual: Number(r.estoque_atual) || 0,
          vendas_diarias: Number(r.vendas_diarias) || 0,
          preco_medio: Number(r.preco_medio) || 0,
          promocao_planejada: Number(r.promocao_planejada) || 0,
        })));
        toast(`${toAdd.length} produto${toAdd.length > 1 ? "s" : ""} adicionado${toAdd.length > 1 ? "s" : ""} ao inventário`, "success");
      }
    } catch (e) {
      if (e instanceof Error && !e.message.includes("expirada")) setError("Erro ao conectar.");
    } finally {
      onLoading(false);
    }
  }

  return (
    <div style={{ padding: "32px 24px 48px" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 className="heading-lg" style={{ color: "var(--text)", marginBottom: 8 }}>Cadastro de Estoque</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
          Cadastre os dados de estoque diretamente — sem precisar de planilha Excel.<br />
          Campos marcados com <span style={{ color: "var(--amber)" }}>*</span> são obrigatórios.
        </p>
      </div>

      {/* Legenda das colunas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {COLS.map(c => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: c.req ? "var(--amber)" : "var(--muted)" }}>{c.label}</span>
            {c.req && <span style={{ color: "var(--amber)", fontSize: 10 }}>*</span>}
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>

        {/* Header da tabela */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", gap: 0 }}>
          {COLS.map(c => (
            <div key={c.key} style={{ width: c.width, flexShrink: 0, paddingRight: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.req ? "var(--text-2)" : "var(--muted)" }}>
                {c.label}{c.req && <span style={{ color: "var(--amber)" }}> *</span>}
              </span>
            </div>
          ))}
          <div style={{ width: 72, flexShrink: 0 }} />
        </div>

        {/* Linhas */}
        {rows.map((row, idx) => {
          const isFilled = row.sku.trim() && row.ean.trim() && row.loja.trim() && row.estoque_atual && row.vendas_diarias && row.preco_medio;
          return (
            <div key={row.id}
              style={{
                display: "flex", alignItems: "center", padding: "7px 14px",
                borderBottom: idx < rows.length - 1 ? "1px solid var(--border)" : "none",
                background: idx % 2 === 0 ? "var(--surface)" : "var(--bg-2)",
                transition: "background .1s",
              }}>

              {COLS.map(c => (
                <div key={c.key} style={{ width: c.width, flexShrink: 0, paddingRight: 8 }}>
                  <input
                    type={c.type}
                    placeholder={c.placeholder}
                    value={row[c.key as keyof StockRow]}
                    onChange={e => update(row.id, c.key as keyof StockRow, e.target.value)}
                    onFocus={() => setFocusedCell(`${row.id}-${c.key}`)}
                    onBlur={() => setFocusedCell(null)}
                    min={c.type === "number" ? "0" : undefined}
                    step={c.type === "number" ? "any" : undefined}
                    style={{
                      width: "100%", padding: "7px 10px", fontSize: 13, borderRadius: 7, outline: "none",
                      fontFamily: c.type === "number" ? "monospace" : "inherit",
                      background: focusedCell === `${row.id}-${c.key}` ? "var(--surface-2)" : "transparent",
                      border: focusedCell === `${row.id}-${c.key}` ? "1px solid var(--amber)" : "1px solid transparent",
                      color: "var(--text)",
                      transition: "all .15s",
                    }}
                  />
                </div>
              ))}

              {/* Ações da linha */}
              <div style={{ width: 72, flexShrink: 0, display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button onClick={() => duplicateRow(row.id)} title="Duplicar linha"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "4px 6px", borderRadius: 5, transition: "color .15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--amber)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                  ⧉
                </button>
                <button onClick={() => removeRow(row.id)} title="Remover linha" disabled={rows.length <= 1}
                  style={{ background: "none", border: "none", cursor: rows.length <= 1 ? "not-allowed" : "pointer", color: "var(--muted)", fontSize: 15, padding: "4px 6px", borderRadius: 5, opacity: rows.length <= 1 ? 0.3 : 1, transition: "color .15s" }}
                  onMouseEnter={e => { if (rows.length > 1) e.currentTarget.style.color = "var(--red)"; }}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                  ×
                </button>
              </div>
            </div>
          );
        })}

        {/* Linha de adicionar */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
          <button onClick={addRow}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, transition: "color .15s", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--amber)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
            <span style={{ fontSize: 16, fontWeight: 300 }}>+</span> Adicionar linha
          </button>
        </div>
      </div>

      {/* Rodapé com ações */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            <span style={{ fontFamily: "monospace", color: validRows.length > 0 ? "var(--green)" : "var(--muted)", fontWeight: 700 }}>{validRows.length}</span>
            /{rows.length} linhas válidas
          </span>
          {error && (
            <span style={{ fontSize: 12, color: "var(--red)", background: "#E0525210", border: "1px solid #E0525230", padding: "5px 12px", borderRadius: 6 }}>{error}</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setRows([newRow(), newRow(), newRow()]); setError(""); }}
            className="btn-ghost" style={{ fontSize: 13, padding: "10px 18px", borderRadius: 9 }}>
            Limpar tudo
          </button>
          <button onClick={submit} disabled={loading || validRows.length === 0}
            style={{ background: validRows.length > 0 ? "var(--amber)" : "var(--surface-2)", color: validRows.length > 0 ? "#0B0B0C" : "var(--muted)", border: "none", padding: "10px 24px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: loading || validRows.length === 0 ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit", transition: "all .2s" }}>
            {loading ? "Analisando…" : `Analisar ${validRows.length > 0 ? validRows.length + " SKU" + (validRows.length > 1 ? "s" : "") : "estoque"} →`}
          </button>
        </div>
      </div>

      {/* Guia rápido */}
      <div style={{ marginTop: 20, padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>Guia rápido</p>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {[
            ["Estoque *",    "quantidade atual em unidades"],
            ["Vendas/dia *", "média diária dos últimos 30 dias"],
            ["Preço (R$) *", "valor unitário de venda"],
            ["Promo %",      "0.20 = promo que aumenta demanda em 20%"],
          ].map(([f, d]) => (
            <p key={String(f)} style={{ fontSize: 12, color: "var(--muted)" }}>
              <span style={{ fontFamily: "monospace", color: "var(--text-2)", fontWeight: 600 }}>{String(f)}</span> — {String(d)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

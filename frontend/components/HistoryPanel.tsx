"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import type { AnalysisResult, HistoryEntry } from "@/types/analysis";
import { clearHistory } from "@/lib/history";
import { importFromAnalysis } from "@/lib/inventory";
import { toast } from "@/components/Toast";

interface Props {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

type Period = "7d" | "30d" | "all";

function parseTimestamp(ts: string): Date {
  const [datePart] = ts.split(",");
  const parts = datePart.trim().split("/").map(Number);
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

export default function HistoryPanel({ entries, onSelect, onClear, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const visibleEntries = period === "all" ? entries : entries.filter(e => {
    const diff = (Date.now() - parseTimestamp(e.timestamp).getTime()) / 86400000;
    return period === "7d" ? diff <= 7 : diff <= 30;
  });

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleClear() {
    if (!confirm("Limpar todo o histórico de análises?")) return;
    await onClear();
    setOpen(false);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-3 py-2 rounded cursor-pointer flex items-center gap-1.5"
        style={{ border: "1px solid var(--border)", color: "var(--muted)", transition: "all 0.15s" }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "var(--amber)";
          e.currentTarget.style.color = "var(--amber)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--muted)";
        }}>
        <span>Histórico</span>
        {entries.length > 0 && (
          <span className="font-mono font-bold" style={{ color: "var(--amber)" }}>
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-80 rounded-lg z-40 overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

          <div className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <span className="text-xs font-medium tracking-widest uppercase"
              style={{ color: "var(--muted)" }}>
              Análises Anteriores
            </span>
            {entries.length > 0 && (
              <button onClick={handleClear} className="text-xs cursor-pointer"
                style={{ color: "var(--red)" }}>
                Limpar
              </button>
            )}
          </div>

          {/* Empty state quando não há histórico */}
          {entries.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs font-medium" style={{ color: "var(--text)" }}>Nenhuma análise ainda.</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Faça upload de um arquivo para começar.</p>
            </div>
          )}

          {/* Filtro de período — só aparece quando há entradas */}
          {entries.length > 0 && (
            <div className="flex items-center gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              {(["7d", "30d", "all"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="text-xs px-2 py-1 rounded cursor-pointer transition-colors"
                  style={{
                    fontFamily: "monospace", fontWeight: period === p ? 700 : 400,
                    background: period === p ? "var(--ink)" : "transparent",
                    color: period === p ? "var(--bone)" : "var(--muted)",
                    border: "1px solid " + (period === p ? "var(--ink)" : "transparent"),
                  }}>
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
                </button>
              ))}
              <span className="text-xs ml-auto" style={{ color: "var(--muted)", fontFamily: "monospace" }}>
                {visibleEntries.length}/{entries.length}
              </span>
            </div>
          )}

          {entries.length > 0 && visibleEntries.length === 0 && (
            <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--muted)" }}>
              Nenhuma análise no período.
            </div>
          )}

          {visibleEntries.map((entry, i) => (
            <div
              key={entry.id}
              style={{ borderBottom: i < visibleEntries.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={() => setHoveredId(entry.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="relative">
                <button
                  onClick={() => { onSelect(entry); setOpen(false); }}
                  className="w-full text-left px-4 py-3 cursor-pointer transition-colors pr-10"
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{entry.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{entry.timestamp}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-mono" style={{ color: "var(--text)" }}>{entry.result.total_skus} SKUs</span>
                    {entry.result.skus_criticos > 0 && (
                      <span className="text-xs font-mono" style={{ color: "var(--red)" }}>{entry.result.skus_criticos} críticos</span>
                    )}
                    <span className="text-xs font-mono ml-auto" style={{ color: "var(--orange)" }}>
                      R$ {entry.result.perda_total_estimada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </button>

                {hoveredId === entry.id && (
                  <button
                    onClick={(e) => handleDelete(e, entry.id)}
                    disabled={deletingId === entry.id}
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded transition-colors"
                    style={{ color: "var(--red)", opacity: deletingId === entry.id ? 0.4 : 1 }}
                    title="Remover esta análise"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div style={{ padding: "0 16px 10px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => { importFromAnalysis(entry.result.resultados); setOpen(false); toast("Produtos carregados na aba Estoque!", "success"); }}
                  style={{ fontSize: 11, color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  📦 Carregar no Estoque
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

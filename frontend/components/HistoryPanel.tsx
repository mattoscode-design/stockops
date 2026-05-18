"use client";

import { useState, useEffect, useRef } from "react";
import type { AnalysisResult, HistoryEntry } from "@/types/analysis";
import { clearHistory } from "@/lib/history";
import { importFromAnalysis } from "@/lib/inventory";
import { toast } from "@/components/Toast";

interface Props {
  entries: HistoryEntry[];
  onSelect: (result: AnalysisResult) => void;
  onClear: () => Promise<void> | void;
}

export default function HistoryPanel({ entries, onSelect, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  if (entries.length === 0) return null;

  async function handleClear() {
    if (!confirm("Limpar todo o histórico de análises?")) return;
    await onClear();
    setOpen(false);
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
        <span className="font-mono font-bold" style={{ color: "var(--amber)" }}>
          {entries.length}
        </span>
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
            <button onClick={handleClear} className="text-xs cursor-pointer"
              style={{ color: "var(--red)" }}>
              Limpar
            </button>
          </div>

          {entries.map((entry, i) => (
            <div key={entry.id} style={{ borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none" }}>
              <button
                onClick={() => { onSelect(entry.result); setOpen(false); }}
                className="w-full text-left px-4 py-3 cursor-pointer transition-colors"
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

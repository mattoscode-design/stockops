"use client";

import { useState, useRef } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { apiFetch } from "@/lib/api";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = /\.(xlsx|xls|csv)$/i;
const COLUMNS = ["sku", "loja", "estoque_atual", "vendas_diarias", "preco_medio"];

interface Props {
  onResult: (data: AnalysisResult) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
}

export default function UploadZone({ onResult, onLoading, loading }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!ALLOWED.test(file.name)) { setError("Formato inválido. Use .xlsx ou .csv"); return; }
    if (file.size > MAX_SIZE) { setError("Arquivo excede 10 MB."); return; }

    setError("");
    onLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiFetch("/analysis/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail ?? "Erro ao processar o arquivo.");
        return;
      }
      onResult(await res.json());
    } catch (e) {
      if (e instanceof Error && e.message !== "Sessão expirada. Redirecionando para login.") {
        setError("Erro ao conectar com o servidor.");
      }
    } finally {
      onLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-20">
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        className="w-full max-w-lg rounded-xl flex flex-col items-center gap-4 py-16 px-8 text-center cursor-pointer select-none"
        style={{
          border: `2px dashed ${dragging ? "var(--amber)" : "var(--border)"}`,
          background: dragging ? "rgba(245,166,35,0.04)" : "var(--surface)",
          transition: "all 0.15s",
        }}>

        {loading ? (
          <>
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--amber)" }} />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Analisando e gerando relatório com IA...
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl">📂</div>
            <div>
              <p className="text-base font-medium" style={{ color: "var(--text)" }}>
                Arraste sua planilha aqui
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                .xlsx ou .csv — máximo 10 MB
              </p>
            </div>
            <button className="mt-2 px-5 py-2.5 rounded text-sm font-semibold"
              style={{ background: "var(--amber)", color: "#0A0A0A" }}>
              Selecionar Arquivo
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm" style={{ color: "var(--red)" }}>{error}</p>}

      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />

      {!loading && (
        <div className="mt-8 rounded-lg px-6 py-4 max-w-lg w-full"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: "var(--muted)" }}>
            Colunas obrigatórias
          </p>
          <div className="flex flex-wrap gap-2">
            {COLUMNS.map(col => (
              <span key={col} className="font-mono text-xs px-2 py-1 rounded"
                style={{ background: "var(--surface-2)", color: "var(--amber)", border: "1px solid var(--border)" }}>
                {col}
              </span>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Opcionais: <span className="font-mono" style={{ color: "var(--text)" }}>categoria · promocao_planejada</span>
          </p>
        </div>
      )}
    </div>
  );
}

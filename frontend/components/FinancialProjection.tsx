"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { TrendingUp, ShoppingCart, Calendar, AlertTriangle, DollarSign } from "lucide-react";

interface ProjectionData {
  receita_potencial_total: number;
  receita_projetada_7d: number;
  receita_projetada_30d: number;
  perda_por_vencimento: number;
  receita_liquida_projetada: number;
}

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
  note?: string;
}

function ProjectionCard({ icon, label, value, tone = "default", note }: CardProps) {
  const toneStyles: Record<string, React.CSSProperties> = {
    default: { borderColor: "var(--border)", background: "#fff" },
    warning: {
      borderColor: "color-mix(in oklab, var(--red, #E05252) 30%, transparent)",
      background: "color-mix(in oklab, var(--red, #E05252) 4%, transparent)",
    },
    success: {
      borderColor: "color-mix(in oklab, #22C55E 30%, transparent)",
      background: "color-mix(in oklab, #22C55E 4%, transparent)",
    },
  };

  const valueColor: Record<string, string> = {
    default: "var(--ink, #0B0B0C)",
    warning: "var(--red, #E05252)",
    success: "#15803D",
  };

  return (
    <div style={{
      border: "1px solid",
      borderRadius: 12,
      padding: "20px 20px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      ...toneStyles[tone],
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8,
          background: tone === "warning"
            ? "color-mix(in oklab, var(--red,#E05252) 12%, transparent)"
            : tone === "success"
              ? "color-mix(in oklab, #22C55E 12%, transparent)"
              : "var(--surface, #F5F5F0)",
          color: valueColor[tone],
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: valueColor[tone], lineHeight: 1.1 }}>
        R$ {value}
      </div>
      {note && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{note}</div>
      )}
    </div>
  );
}

export default function FinancialProjection() {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch("/inventory/projection")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ProjectionData>;
      })
      .then(json => {
        if (!cancelled) setData(json);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar projeção.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: "32px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              height: 96, borderRadius: 12, border: "1px solid var(--border)",
              background: "linear-gradient(90deg, var(--surface) 0%, var(--bone,#FAF9F7) 50%, var(--surface) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s ease-in-out infinite",
            }} />
          ))}
        </div>
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </div>
    );
  }

  // ── Erro ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: "24px 0", fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
        Não foi possível carregar a projeção financeira.
      </div>
    );
  }

  // ── Empty state: sem dados significativos ────────────────────────────────────
  const hasData = data && (
    data.receita_potencial_total > 0 ||
    data.receita_projetada_7d > 0 ||
    data.receita_projetada_30d > 0
  );

  if (!hasData) {
    return (
      <div style={{
        padding: "28px 20px", borderRadius: 12, textAlign: "center",
        border: "1px dashed var(--border)", background: "var(--surface, #F5F5F0)",
      }}>
        <DollarSign size={28} style={{ color: "var(--muted)", marginBottom: 8 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>
          Nenhum dado de projeção disponível.
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Cadastre itens com preço e vendas diárias para ver as estimativas.
        </p>
      </div>
    );
  }

  // ── Cards ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
          Projeção Financeira
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        <ProjectionCard
          icon={<TrendingUp size={14} />}
          label="Estoque atual vale"
          value={fmt(data!.receita_potencial_total)}
          note="valor total em estoque × preço médio"
        />
        <ProjectionCard
          icon={<ShoppingCart size={14} />}
          label="Venda estimada 7 dias"
          value={fmt(data!.receita_projetada_7d)}
          note="vendas diárias × 7"
        />
        <ProjectionCard
          icon={<Calendar size={14} />}
          label="Venda estimada 30 dias"
          value={fmt(data!.receita_projetada_30d)}
          note="vendas diárias × 30"
        />
        {data!.perda_por_vencimento > 0 && (
          <ProjectionCard
            icon={<AlertTriangle size={14} />}
            label="Perda por vencimento"
            value={fmt(data!.perda_por_vencimento)}
            tone="warning"
            note="itens que vencem antes de serem vendidos"
          />
        )}
        <ProjectionCard
          icon={<DollarSign size={14} />}
          label="Receita líquida proj."
          value={fmt(data!.receita_liquida_projetada)}
          tone="success"
          note="projeção 30d − perdas por vencimento"
        />
      </div>
    </div>
  );
}

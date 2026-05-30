"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { AnalysisRecord } from "@/types/analysis";

interface Props {
  records: AnalysisRecord[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function DarkTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#888", marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700, marginBottom: 2 }}>
          {p.name === "score" ? `Score médio: ${p.value}` : `Perda estimada: ${formatBRL(p.value)}`}
        </p>
      ))}
    </div>
  );
}

export default function AnalysisTimeline({ records }: Props) {
  const data = useMemo(() => {
    return records
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((r) => {
        const avgScore =
          r.resultados.length > 0
            ? Math.round(
                r.resultados.reduce((s, row) => s + row.score_ruptura, 0) / r.resultados.length
              )
            : 0;
        return {
          date: formatDate(r.created_at),
          score: avgScore,
          perda: r.perda_total_estimada,
        };
      });
  }, [records]);

  if (data.length < 2) return null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "24px 24px 16px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 4,
            }}
          >
            Linha do Tempo de Análises
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>
            {data.length} análises
          </p>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)" }}>Score médio · Perda estimada</p>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="score"
            domain={[0, 100]}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="perda"
            orientation="right"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip content={<DarkTip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--muted)", paddingTop: 8 }}
            formatter={(value: string) =>
              value === "score" ? "Score médio" : "Perda estimada (R$)"
            }
          />
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="score"
            stroke="var(--amber)"
            strokeWidth={2.5}
            dot={{ fill: "var(--amber)", strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="perda"
            type="monotone"
            dataKey="perda"
            stroke="#E05252"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ fill: "#E05252", strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

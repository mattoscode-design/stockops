"use client";

import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import type { HistoryEntry } from "@/types/analysis";

interface Props {
  history: HistoryEntry[];
  targetSku?: string;
}

function DarkTip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { date: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#888", marginBottom: 3 }}>{payload[0]?.payload?.date}</p>
      <p style={{ color: "#EDEDF0", fontWeight: 700 }}>Score médio: {payload[0]?.value}</p>
    </div>
  );
}

export default function ScoreHistory({ history, targetSku }: Props) {
  const data = useMemo(() => {
    return history
      .slice()
      .reverse()
      .map(entry => {
        const rows = targetSku
          ? entry.result.resultados.filter(r => r.sku === targetSku)
          : entry.result.resultados;

        if (rows.length === 0) return null;

        const avgScore = Math.round(rows.reduce((s, r) => s + r.score_ruptura, 0) / rows.length);
        const criticos = rows.filter(r => r.score_ruptura >= 71).length;

        return {
          date: entry.timestamp.split(",")[0],
          score: avgScore,
          criticos,
          label: entry.name,
        };
      })
      .filter(Boolean) as { date: string; score: number; criticos: number; label: string }[];
  }, [history, targetSku]);

  if (data.length < 2) return null;

  const avgGeral = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  const trend    = data[data.length - 1].score - data[0].score;
  const trendColor = trend > 5 ? "#E05252" : trend < -5 ? "#3DB87A" : "#E88A00";
  const trendLabel = trend > 5 ? `▲ +${trend} (piorando)` : trend < -5 ? `▼ ${trend} (melhorando)` : `→ estável`;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 24px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
            {targetSku ? `Evolução — ${targetSku}` : "Evolução do Score Médio"}
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>
            Score médio: {avgGeral}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>{trendLabel}</p>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>{data.length} análises comparadas</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={71} stroke="#E05252" strokeDasharray="4 4" opacity={0.4} label={{ value: "Crítico", fill: "#E05252", fontSize: 10, position: "right" }} />
          <Tooltip content={<DarkTip />} />
          <Line type="monotone" dataKey="score" stroke="var(--amber)" strokeWidth={2.5} dot={{ fill: "var(--amber)", strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

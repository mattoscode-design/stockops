"use client";

import { useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { AnalysisResult, AnalysisRow } from "@/types/analysis";

const RISK_COLORS: Record<string, string> = {
  Urgente:            "#E05252",
  "Ação Recomendada": "#E88A00",
  Alerta:             "#E8C200",
  Monitoramento:      "#3DB87A",
};

const ABC_COLORS: Record<string, string> = {
  A: "#E05252",
  B: "#E88A00",
  C: "#3DB87A",
};

interface TProps {
  active?: boolean;
  payload?: { value: number; payload: { name: string; fullName?: string } }[];
}

function DarkTooltip({ active, payload }: TProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#F0F0F0", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
      <p style={{ color: "#888", marginBottom: 2 }}>{payload[0].payload.fullName ?? payload[0].payload.name}</p>
      <p style={{ fontWeight: 700 }}>{payload[0].value}</p>
    </div>
  );
}

function CurrencyTooltip({ active, payload }: TProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#F0F0F0", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
      <p style={{ color: "#888", marginBottom: 2 }}>{payload[0].payload.fullName ?? payload[0].payload.name}</p>
      <p style={{ fontWeight: 700 }}>R$ {Number(payload[0].value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

function InfoBtn({ tip }: { tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ background: "none", border: "1px solid #D0D0DC", borderRadius: "50%", width: 18, height: 18, fontSize: 10, color: "#9090A8", cursor: "pointer", lineHeight: "16px", flexShrink: 0 }}>
        ?
      </button>
      {show && (
        <div style={{ position: "absolute", top: 22, right: 0, width: 240, background: "#1A1A1A", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#EDEDF0", lineHeight: 1.5, zIndex: 99, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", whiteSpace: "normal" }}>
          {tip}
        </div>
      )}
    </div>
  );
}

const CHART_INFO: Record<string, string> = {
  risco:    "Mostra quantos SKUs estão em cada nível de risco. Urgente = ação imediata. Ação Recomendada = janela se fechando. Alerta = monitorar. Monitoramento = estável.",
  cobertura:"Distribui os SKUs por quantos dias de estoque eles têm. Ruptura = sem estoque agora. Crítico = menos de 3 dias. Estável = mais de 14 dias.",
  topskus:  "Ranking dos SKUs que representam maior perda financeira estimada se houver ruptura. Cor indica o nível de risco de cada um.",
  abc:      "Curva ABC por impacto financeiro (Pareto). A = 20% dos SKUs que causam 80% da perda. B = próximos 15%. C = os demais 5%.",
  categoria:"Soma da perda estimada de todos os SKUs por categoria. Indica qual área do portfólio tem maior risco financeiro.",
};

function Card({ title, children, infoKey }: { title: string; children: React.ReactNode; infoKey?: string }) {
  return (
    <div className="card-lift" style={{ background: "#fff", border: "1px solid #E8E8EF", borderRadius: 16, padding: "24px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9090A8" }}>
          {title}
        </p>
        {infoKey && <InfoBtn tip={CHART_INFO[infoKey] ?? ""} />}
      </div>
      {children}
    </div>
  );
}

const GRID_COLOR = "#F0F0F5";
const TICK_COLOR = "#9090A8";

/* Calcula curva ABC no frontend (fallback quando backend não retorna) */
function calcularAbcFrontend(rows: { sku: string; loja: string; perda_estimada_reais: number }[]) {
  const total = rows.reduce((s, r) => s + r.perda_estimada_reais, 0);
  if (total === 0) return new Map(rows.map(r => [`${r.sku}::${r.loja}`, "C"]));
  const sorted = [...rows].sort((a, b) => b.perda_estimada_reais - a.perda_estimada_reais);
  let cumulative = 0;
  const map = new Map<string, string>();
  sorted.forEach(r => {
    cumulative += r.perda_estimada_reais / total;
    const cls = cumulative <= 0.80 ? "A" : cumulative <= 0.95 ? "B" : "C";
    map.set(`${r.sku}::${r.loja}`, cls);
  });
  return map;
}

export default function DashboardCharts({ result }: { result: AnalysisResult }) {
  // Verifica se curva_abc está faltando/errada e recalcula
  const allC = result.resultados.every(r => !r.curva_abc || r.curva_abc === "C");
  const abcMap = allC ? calcularAbcFrontend(result.resultados) : null;
  const getAbc = (r: { sku: string; loja: string; curva_abc: string }) =>
    abcMap ? (abcMap.get(`${r.sku}::${r.loja}`) ?? "C") : (r.curva_abc || "C");

  // 1 — Distribuição de risco com label de porcentagem
  const riskCounts = result.resultados.reduce<Record<string, number>>((acc, r) => {
    acc[r.classificacao] = (acc[r.classificacao] ?? 0) + 1;
    return acc;
  }, {});
  const total = result.resultados.length;
  const riskData = ["Urgente", "Ação Recomendada", "Alerta", "Monitoramento"]
    .filter(k => riskCounts[k])
    .map(k => ({ name: k, value: riskCounts[k], pct: Math.round((riskCounts[k] / total) * 100) }));

  // 2 — Cobertura por faixa (mais clara)
  const FAIXAS = [
    { name: "Ruptura",  desc: "0 dias — sem estoque",      min: -1, max: 0,        color: "#E05252" },
    { name: "Crítico",  desc: "1 a 3 dias de estoque",     min: 0,  max: 3,        color: "#E88A00" },
    { name: "Risco",    desc: "3 a 7 dias de estoque",     min: 3,  max: 7,        color: "#E8C200" },
    { name: "Atenção",  desc: "7 a 14 dias de estoque",    min: 7,  max: 14,       color: "#94A3B8" },
    { name: "Estável",  desc: "Acima de 14 dias",          min: 14, max: Infinity, color: "#3DB87A" },
  ];
  const coberturaData = FAIXAS.map(f => ({
    name: f.name,
    fullName: `${f.name} — ${f.desc}`,
    value: result.resultados.filter(r =>
      f.max === 0 ? r.cobertura_dias === 0
      : f.min === -1 ? r.cobertura_dias === 0
      : f.max === Infinity ? r.cobertura_dias > f.min
      : r.cobertura_dias > f.min && r.cobertura_dias <= f.max
    ).length,
    color: f.color,
  })).filter(d => d.value > 0);

  // 3 — Top 10 SKUs por perda
  const topSkus = [...result.resultados]
    .sort((a, b) => b.perda_estimada_reais - a.perda_estimada_reais)
    .slice(0, 10)
    .map(r => ({
      name: r.sku.length > 22 ? r.sku.slice(0, 20) + "…" : r.sku,
      fullName: `${r.sku} — ${r.loja}`,
      perda: r.perda_estimada_reais,
      color: RISK_COLORS[r.classificacao] ?? "#666",
    }));

  // 4 — ABC (com recálculo frontend se necessário)
  const abcCounts = result.resultados.reduce<Record<string, number>>((acc, r) => {
    const abc = getAbc(r);
    acc[abc] = (acc[abc] ?? 0) + 1;
    return acc;
  }, {});
  const abcData = ["A", "B", "C"]
    .filter(k => abcCounts[k])
    .map(k => ({
      name: `Curva ${k}`, fullName: `Curva ${k} — ${abcCounts[k]} SKUs`, value: abcCounts[k], color: ABC_COLORS[k],
    }));

  // 5 — Perda por categoria
  const catLoss = result.resultados.reduce<Record<string, number>>((acc, r) => {
    const cat = r.categoria || "Sem Categoria";
    acc[cat] = (acc[cat] ?? 0) + r.perda_estimada_reais;
    return acc;
  }, {});
  const catData = Object.entries(catLoss)
    .map(([name, perda]) => ({ name, fullName: name, perda: Math.round(perda * 100) / 100 }))
    .sort((a, b) => b.perda - a.perda)
    .slice(0, 8);

  const hasCategories = catData.length > 1;
  const barHeight = Math.max(200, topSkus.length * 36);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>

      {/* Linha 1 — Risco + Cobertura */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        <Card title="Distribuição de Risco" infoKey="risco">
          <div className="flex items-center gap-6">
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={44} outerRadius={72}
                    paddingAngle={3} dataKey="value">
                    {riskData.map((e, i) => <Cell key={i} fill={RISK_COLORS[e.name] ?? "#666"} />)}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {riskData.map(item => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLORS[item.name] ?? "#666", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#52526A", flex: 1, minWidth: 0 }}>{item.name}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: RISK_COLORS[item.name] ?? "#666" }}>{item.value}</span>
                    <span style={{ fontSize: 10, color: "#9090A8" }}>{item.pct}%</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: "8px 10px", background: "#F9F9FC", borderRadius: 8, border: "1px solid #E8E8EF" }}>
                <p style={{ fontSize: 10, color: "#9090A8", lineHeight: 1.5 }}>
                  <span style={{ color: "#E05252", fontWeight: 600 }}>Urgente + Ação</span> = atenção imediata<br />
                  <span style={{ color: "#3DB87A", fontWeight: 600 }}>Monitoramento</span> = estável
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Faixas de Cobertura de Estoque" infoKey="cobertura">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={coberturaData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis dataKey="name" tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {coberturaData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Linha 2 — Top SKUs (altura dinâmica) */}
      <Card title={`Top ${topSkus.length} SKUs por Perda Estimada`} infoKey="topskus">
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={topSkus} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis type="number" tick={{ fill: TICK_COLOR, fontSize: 10 }}
              tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`}
              axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={160}
              tick={{ fill: "#4A4A6A", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CurrencyTooltip />} />
            <Bar dataKey="perda" radius={[0, 4, 4, 0]} barSize={18}>
              {topSkus.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Linha 3 — ABC + Categoria */}
      <div style={{ display: "grid", gridTemplateColumns: hasCategories ? "1fr 1fr" : "1fr", gap: 16 }}>

        <Card title="Distribuição Curva ABC" infoKey="abc">
          <div className="flex items-center gap-6">
            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={abcData} cx="50%" cy="50%" innerRadius={36} outerRadius={62}
                    paddingAngle={3} dataKey="value">
                    {abcData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3 flex-1">
              {abcData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ color: item.color, background: `${item.color}18`, border: `1px solid ${item.color}40` }}>
                      {item.name.replace("Curva ", "")}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{item.name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                A = 80% da perda · B = 15% · C = 5%
              </p>
            </div>
          </div>
        </Card>

        {hasCategories && (
          <Card title="Perda Estimada por Categoria">
            <ResponsiveContainer width="100%" height={catData.length * 36 + 20}>
              <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
                <XAxis type="number" tick={{ fill: TICK_COLOR, fontSize: 10 }}
                  tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130}
                  tick={{ fill: "#4A4A6A", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="perda" fill="#F5A623" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}

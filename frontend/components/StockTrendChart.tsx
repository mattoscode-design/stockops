"use client";

import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import type { InventoryItem } from "@/lib/inventory";

function Tip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { data: string; tipo: string } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#F0F0F0" }}>
      <p style={{ color: "#888", marginBottom: 2 }}>{d.data}</p>
      <p style={{ fontWeight: 700, color: "#EDEDF0" }}>{payload[0].value} un. em estoque</p>
    </div>
  );
}

export default function StockTrendChart({ item }: { item: InventoryItem }) {
  const data = useMemo(() => {
    if (item.movimentos.length === 0) return [];

    // Reconstrói a linha do tempo do estoque a partir dos movimentos
    const pontos: { data: string; estoque: number; tipo: string }[] = [];
    let estoque = item.estoque_atual;

    // Vai de trás pra frente (mais recente → mais antigo) para reconstruir
    const movs = [...item.movimentos].reverse();
    pontos.push({ data: "Agora", estoque: item.estoque_atual, tipo: "atual" });

    movs.forEach(m => {
      const delta = m.tipo === "entrada" ? -m.quantidade : m.quantidade;
      estoque = Math.max(0, estoque + delta);
      pontos.unshift({ data: m.data.split(",")[0], estoque, tipo: m.tipo });
    });

    return pontos;
  }, [item]);

  if (data.length < 2) return (
    <div style={{ padding: "16px", fontSize: 13, color: "#9090A8", textAlign: "center", background: "#F9F9FC", borderRadius: 10, border: "1px solid #E2E2EA" }}>
      Registre ao menos 1 movimento para ver a tendência de estoque.
    </div>
  );

  const cobertura = item.vendas_diarias > 0 ? Math.round((item.estoque_atual / item.vendas_diarias) * 10) / 10 : null;
  const nivelCritico = item.vendas_diarias * 3;

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E2EA", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9090A8", marginBottom: 4 }}>
            Tendência de Estoque
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0A0A14" }}>
            {item.sku} · {item.loja}
          </p>
        </div>
        {cobertura !== null && (
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: cobertura < 3 ? "#DC2626" : cobertura < 7 ? "#D97706" : "#16A34A" }}>
              {cobertura}d
            </p>
            <p style={{ fontSize: 11, color: "#9090A8" }}>cobertura atual</p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#F0F0F5" />
          <XAxis dataKey="data" tick={{ fill: "#9090A8", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#9090A8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          {nivelCritico > 0 && (
            <ReferenceLine y={nivelCritico} stroke="#DC2626" strokeDasharray="4 4" opacity={0.5}
              label={{ value: "Crítico", fill: "#DC2626", fontSize: 10, position: "insideTopRight" }} />
          )}
          <Tooltip content={<Tip />} />
          <Line type="monotone" dataKey="estoque" stroke="#D97706" strokeWidth={2.5}
            dot={{ fill: "#D97706", strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: "#D97706" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

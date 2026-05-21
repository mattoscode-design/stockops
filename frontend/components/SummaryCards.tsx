interface Props {
  totalSkus: number;
  skusCriticos: number;
  perdaTotal: number;
  receitaPotencial?: number;
  categorias?: string[];
  topSku?: string;
}

export default function SummaryCards({ totalSkus, skusCriticos, perdaTotal, receitaPotencial, categorias, topSku }: Props) {
  const pct = totalSkus > 0 ? Math.round((skusCriticos / totalSkus) * 100) : 0;
  const isCritical = skusCriticos > 0;
  const hasLoss = perdaTotal > 0;

  const cards = [
    {
      label: "SKUs Analisados",
      value: totalSkus.toString(),
      sub: categorias && categorias.length > 0 ? `${categorias.length} categorias` : "sem categorias",
      valueColor: "var(--ink)",
      topBorderColor: "var(--border)",
    },
    {
      label: "SKUs em Estado Crítico",
      value: skusCriticos.toString(),
      sub: `${pct}% do total analisado`,
      valueColor: isCritical ? "var(--danger)" : "var(--success)",
      topBorderColor: isCritical ? "var(--danger)" : "var(--success)",
    },
    {
      label: "Perda Total Estimada",
      value: `R$ ${perdaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      sub: hasLoss ? "se rupturas ocorrerem" : "sem risco imediato",
      valueColor: hasLoss ? "var(--amber-signal)" : "var(--success)",
      topBorderColor: hasLoss ? "var(--amber-signal)" : "var(--success)",
    },
    ...(receitaPotencial != null ? [{
      label: "Receita Potencial",
      value: `R$ ${receitaPotencial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      sub: "estoque atual × preço médio",
      valueColor: "var(--success)",
      topBorderColor: "var(--success)",
    }] : []),
    ...(topSku ? [{
      label: "SKU de Maior Risco",
      value: topSku.length > 18 ? topSku.slice(0, 16) + "…" : topSku,
      sub: "score mais alto da análise",
      valueColor: "var(--amber-signal)",
      topBorderColor: "var(--amber-signal)",
    }] : []),
  ];

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 14, padding: "0 24px 24px" }}
    >
      {cards.map(card => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-6"
          style={{ borderTop: `2px solid ${card.topBorderColor}` }}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
            {card.label}
          </p>
          <p className="font-mono text-3xl font-semibold tracking-tight" style={{ color: card.valueColor }}>
            {card.value}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

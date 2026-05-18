interface Props {
  totalSkus: number;
  skusCriticos: number;
  perdaTotal: number;
  categorias?: string[];
  topSku?: string;
}

export default function SummaryCards({ totalSkus, skusCriticos, perdaTotal, categorias, topSku }: Props) {
  const pct  = totalSkus > 0 ? Math.round((skusCriticos / totalSkus) * 100) : 0;
  const isCritical = skusCriticos > 0;

  const cards = [
    {
      label: "SKUs Analisados",
      value: totalSkus.toString(),
      sub: categorias && categorias.length > 0 ? `${categorias.length} categorias` : "sem categorias",
      color: "var(--text)",
      glow: false,
      icon: "📦",
    },
    {
      label: "SKUs em Estado Crítico",
      value: skusCriticos.toString(),
      sub: `${pct}% do total analisado`,
      color: isCritical ? "var(--red)" : "var(--green)",
      glow: isCritical,
      icon: isCritical ? "⚠️" : "✅",
    },
    {
      label: "Perda Total Estimada",
      value: `R$ ${perdaTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      sub: perdaTotal > 0 ? "se rupturas ocorrerem" : "sem risco imediato",
      color: perdaTotal > 0 ? "var(--orange)" : "var(--green)",
      glow: false,
      icon: perdaTotal > 0 ? "📉" : "📈",
    },
    ...(topSku ? [{
      label: "SKU de Maior Risco",
      value: topSku.length > 18 ? topSku.slice(0, 16) + "…" : topSku,
      sub: "score mais alto da análise",
      color: "var(--amber)",
      glow: false,
      icon: "🎯",
    }] : []),
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
      gap: 14,
      padding: "0 24px 24px",
    }}>
      {cards.map(card => (
        <div key={card.label} className="card-lift"
          style={{
            background: "var(--surface)",
            border: `1px solid ${card.glow ? "#E0525240" : "var(--border)"}`,
            borderRadius: 14,
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            boxShadow: card.glow ? "0 0 0 1px #E0525220, 0 4px 20px #E0525218" : "none",
            transition: "box-shadow .2s",
          }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              {card.label}
            </p>
            <span style={{ fontSize: 16 }}>{card.icon}</span>
          </div>

          <p style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 800, color: card.color, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {card.value}
          </p>

          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {card.sub}
          </p>

          {card.glow && (
            <div style={{ marginTop: 8, height: 2, borderRadius: 1, background: "linear-gradient(90deg, var(--red) 0%, transparent 100%)", opacity: 0.5 }} />
          )}
        </div>
      ))}
    </div>
  );
}

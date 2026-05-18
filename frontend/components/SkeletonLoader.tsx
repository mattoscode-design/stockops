export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", height, overflow: "hidden", position: "relative" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-slide 1.5s infinite linear",
      }} />
      <div style={{ height: 10, width: "40%", borderRadius: 5, background: "var(--border)", marginBottom: 16 }} />
      <div style={{ height: 28, width: "60%", borderRadius: 5, background: "var(--border-2)", marginBottom: 8 }} />
      <div style={{ height: 10, width: "30%", borderRadius: 5, background: "var(--border)" }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", margin: "0 24px" }}>
      <div style={{ height: 40, background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 52, padding: "14px 16px", borderBottom: i < rows - 1 ? "1px solid var(--border)" : "none", display: "flex", gap: 16, alignItems: "center", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: `shimmer-slide 1.5s ${i * 0.1}s infinite linear`,
          }} />
          {[40, 25, 15, 10, 10].map((w, j) => (
            <div key={j} style={{ height: 10, width: `${w}%`, borderRadius: 4, background: "var(--border)" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCharts() {
  return (
    <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SkeletonCard height={240} />
        <SkeletonCard height={240} />
      </div>
      <SkeletonCard height={200} />
    </div>
  );
}

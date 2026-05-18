"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import ManualEntry from "@/components/ManualEntry";
import SummaryCards from "@/components/SummaryCards";
import RiskTable from "@/components/RiskTable";
import HistoryPanel from "@/components/HistoryPanel";
import ReportSection from "@/components/ReportSection";
import ChatBot from "@/components/ChatBot";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SkeletonCharts, SkeletonTable } from "@/components/SkeletonLoader";
import ScoreHistory from "@/components/ScoreHistory";
import InventoryManager, { useImportToInventory } from "@/components/InventoryManager";
import { importFromAnalysis, loadInventory } from "@/lib/inventory";
import { ToastContainer } from "@/components/Toast";
import type { AnalysisResult, HistoryEntry } from "@/types/analysis";
import { saveToHistory, loadHistory, clearHistory } from "@/lib/history";
import { apiFetch } from "@/lib/api";

/* Lazy load pesado do recharts */
const DashboardCharts = dynamic(() => import("@/components/DashboardCharts"), {
  ssr: false,
  loading: () => <SkeletonCharts />,
});

type Tab = "painel" | "ranking" | "relatorio" | "estoque" | "importar" | "manual";

const TAB_LABELS: Record<Tab, { label: string; icon: string }> = {
  painel:   { label: "Painel",       icon: "⬡" },
  ranking:  { label: "Ranking",      icon: "↑" },
  relatorio:{ label: "Relatório IA", icon: "✦" },
  estoque:  { label: "Estoque",      icon: "📦" },
  importar: { label: "Importar",     icon: "↑" },
  manual:   { label: "Cadastrar",    icon: "+" },
};

function DashboardInner() {
  const router  = useRouter();
  const params  = useSearchParams();

  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [isDemo,   setIsDemo]   = useState(false);
  const [invCriticos, setInvCriticos] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [username, setUsername] = useState("Admin");
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const [tab,      setTabState] = useState<Tab>((params.get("tab") as Tab) ?? "painel");

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    router.push(url.pathname + url.search, { scroll: false });
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/"); return; }
    try {
      const p = JSON.parse(atob(token.split(".")[1]));
      setUsername(p.sub ?? "Admin");
    } catch { /* mantém Admin */ }

    const hist = loadHistory();
    setHistory(hist);
  }, [router]);

  // Carrega contador de itens críticos do inventário após mount (evita hydration mismatch)
  useEffect(() => {
    loadInventory().then(items => {
      setInvCriticos(
        items.filter(i => i.vendas_diarias > 0 && (i.estoque_atual / i.vendas_diarias) < 3).length
      );
    });
  }, []);

  function handleResult(data: AnalysisResult) {
    setResult(data);
    setIsDemo(false);
    const entry = saveToHistory(data);
    setHistory(prev => [entry, ...prev].slice(0, 10));
    setTab("painel");
  }

  function exportPDF() {
    document.title = `StockOps — Relatório ${new Date().toLocaleDateString("pt-BR")}`;
    window.print();
    setTimeout(() => { document.title = "StockOps — IA Operacional"; }, 1000);
  }

  const criticos = result?.resultados.filter(r => r.score_ruptura >= 71).length ?? 0;
  const topSku   = result?.resultados[0]?.sku;
  const tabs: Tab[] = result
    ? ["painel","ranking","relatorio","estoque","importar","manual"]
    : ["estoque","importar","manual"];

  const CARD: React.CSSProperties = {
    background: "#fff", border: "1px solid #E8E8EF", borderRadius: 16,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
  };

  return (
    <div data-theme="light" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>

      {/* ── HEADER FIXO COMPLETO (Navbar + Banner + Tabs juntos) ── */}
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", boxShadow: "0 1px 0 var(--border)" }}>

        <Navbar username={username} criticos={isDemo ? 0 : criticos} />

        {/* Banner demo */}
        {isDemo && (
          <div style={{ padding: "8px 24px", background: "#FEF3C7", borderTop: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "#D97706", color: "#FFF" }}>DEMO</span>
              <span style={{ fontSize: 12, color: "#92400E" }}>Dados de demonstração — importe sua planilha para analisar dados reais.</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setTab("importar")} style={{ background: "#D97706", color: "#FFF", border: "none", padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Importar Excel</button>
              <button onClick={() => setTab("manual")} style={{ background: "transparent", color: "#92400E", border: "1px solid #FCD34D", padding: "5px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cadastrar</button>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: "100%", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => {
              const isActive = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    background: "none", border: "none", padding: "14px 16px", fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--text)" : "var(--muted)", cursor: "pointer", fontFamily: "inherit",
                    position: "relative", transition: "color .15s", display: "flex", alignItems: "center", gap: 6,
                  }}>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{TAB_LABELS[t].icon}</span>
                  {TAB_LABELS[t].label}
                  {t === "ranking" && criticos > 0 && !isDemo && (
                    <span style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", borderRadius: 4, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}>{criticos}</span>
                  )}
                  {t === "estoque" && invCriticos > 0 && (
                    <span style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", borderRadius: 4, background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A" }}>{invCriticos}</span>
                  )}
                  {isActive && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "var(--amber)", borderRadius: 1 }} />}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {result && !isDemo && (
              <button onClick={exportPDF} className="btn-ghost no-print" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 5 }}>
                ↓ Exportar PDF
              </button>
            )}
            <HistoryPanel
              entries={history}
              onSelect={d => { setResult(d); setIsDemo(false); setTab("painel"); }}
              onClear={async () => {
              try { await apiFetch("/analyses", { method: "DELETE" }); } catch { /* offline */ }
              clearHistory();
              setHistory([]);
              setResult(null);
              setIsDemo(false);
            }}
            />
          </div>
        </div>
        </div>{/* fecha tab bar */}
      </div>{/* fecha header fixo */}

      {/* Conteúdo */}
      <div className="tab-content" key={tab}>

        {/* ── PAINEL ──────────────────────────────────────── */}
        {tab === "painel" && result && (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 60px" }}>

            {/* Hero header */}
            <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>
                  {isDemo ? "Demonstração" : "Análise Operacional"}
                </p>
                <h1 className="heading-lg" style={{ color: "var(--text)", marginBottom: 8 }}>Painel Operacional</h1>
                <p style={{ fontSize: 14, color: "var(--text-2)" }}>
                  {result.total_skus} SKUs analisados
                  {(result.categorias?.length ?? 0) > 0 && ` · ${result.categorias.length} categorias`}
                  {" · "}
                  <button onClick={() => setTab("ranking")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--amber)", fontSize: 14, fontFamily: "inherit", fontWeight: 500, padding: 0 }}>
                    ver ranking completo →
                  </button>
                </p>
              </div>

              {/* Categoria pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", maxWidth: 320 }}>
                {(result.categorias ?? []).slice(0, 4).map(cat => {
                  const n = result.resultados.filter(r => r.categoria === cat && r.score_ruptura >= 71).length;
                  return (
                    <span key={cat} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: `1px solid ${n > 0 ? "#FECACA" : "var(--border)"}`, background: n > 0 ? "#FEF2F2" : "#F9F9FB", color: n > 0 ? "#DC2626" : "var(--text-2)" }}>
                      {cat}{n > 0 ? ` · ${n}` : ""}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Métricas */}
            <SummaryCards
              totalSkus={result.total_skus}
              skusCriticos={result.skus_criticos}
              perdaTotal={result.perda_total_estimada}
              categorias={result.categorias ?? []}
              topSku={topSku}
            />

            {/* Divider com label */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "32px 0 24px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Análise Visual</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {history.length >= 2 && !isDemo && (
              <ErrorBoundary label="Histórico de Scores">
                <ScoreHistory history={history} />
              </ErrorBoundary>
            )}

            <ErrorBoundary label="Gráficos">
              <DashboardCharts result={result} />
            </ErrorBoundary>

            {/* Relatório resumido (no-print do full) */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "32px 0 24px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>Relatório IA</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <ErrorBoundary label="Relatório">
              <ReportSection relatorio={result.relatorio ?? "Relatório não disponível."} />
            </ErrorBoundary>
          </div>
        )}

        {/* ── RANKING ─────────────────────────────────────── */}
        {tab === "ranking" && result && (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 60px" }}>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>Inteligência Operacional</p>
              <h2 className="heading-lg" style={{ color: "var(--text)", marginBottom: 8 }}>Ranking de Risco</h2>
              <p style={{ fontSize: 14, color: "var(--text-2)" }}>
                {result.resultados.length} SKUs ordenados por score de ruptura · clique em uma linha para expandir
              </p>
            </div>
            <RiskTable rows={result.resultados} categorias={result.categorias ?? []} />
          </div>
        )}

        {/* ── RELATÓRIO ───────────────────────────────────── */}
        {tab === "relatorio" && result && (
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 60px" }}>
            <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>Gerado por Gemini Flash</p>
                <h2 className="heading-lg" style={{ color: "var(--text)", marginBottom: 8 }}>Relatório Executivo</h2>
                <p style={{ fontSize: 14, color: "var(--text-2)" }}>Análise completa em linguagem de negócio</p>
              </div>
              <button onClick={exportPDF} className="btn-ghost no-print" style={{ fontSize: 13, padding: "10px 18px", borderRadius: 9, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                ↓ Exportar PDF
              </button>
            </div>
            <ErrorBoundary label="Relatório">
              <ReportSection relatorio={result.relatorio ?? "Relatório não disponível."} />
            </ErrorBoundary>
          </div>
        )}

        {/* ── IMPORTAR ─────────────────────────────────────── */}
        {tab === "importar" && (
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 60px" }}>
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 8 }}>Upload de arquivo</p>
              <h2 className="heading-lg" style={{ color: "var(--text)", marginBottom: 8 }}>Importar Planilha</h2>
              <p style={{ fontSize: 14, color: "var(--text-2)" }}>Aceita Excel (.xlsx) e CSV. Máximo 10 MB.</p>
            </div>
            <UploadZone onResult={handleResult} onLoading={setLoading} loading={loading} />
          </div>
        )}

        {/* ── ESTOQUE (CRUD) ────────────────────────────────── */}
        {tab === "estoque" && (
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <InventoryManager
              onAnalyze={data => { handleResult(data); setTab("painel"); }}
              onLoading={setLoading}
              loading={loading}
            />
          </div>
        )}

        {/* ── CADASTRAR ─────────────────────────────────────── */}
        {tab === "manual" && (
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <ManualEntry onResult={handleResult} onLoading={setLoading} loading={loading} />
          </div>
        )}
      </div>

      {result && <ChatBot result={result} />}
      <ToastContainer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div data-theme="light" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ height: 60, background: "#fff", borderBottom: "1px solid var(--border)" }} />
        <div style={{ padding: "40px 24px" }}>
          <div style={{ height: 32, width: 200, borderRadius: 8, background: "var(--surface)", marginBottom: 24 }} />
          <SkeletonCharts />
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, ListOrdered, FileText, Package, ArrowUpFromLine, Plus, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import UploadZone from "@/components/UploadZone";
import ManualEntry from "@/components/ManualEntry";
import SummaryCards from "@/components/SummaryCards";
import RiskTable from "@/components/RiskTable";
import HistoryPanel from "@/components/HistoryPanel";
import ChatBot from "@/components/ChatBot";
import ErrorBoundary from "@/components/ErrorBoundary";
import EmptyState from "@/components/EmptyState";
import { SkeletonCard, SkeletonCharts } from "@/components/SkeletonLoader";
import ScoreHistory from "@/components/ScoreHistory";
<<<<<<< HEAD
import AnalysisTimeline from "@/components/AnalysisTimeline";
=======
>>>>>>> 801053e (perf: Promise.all boot, lazy tabs (InventoryManager/EquipeTab/ReportSection), skeleton on painel)
import { loadInventory } from "@/lib/inventory";
import { ToastContainer } from "@/components/Toast";
import type { AnalysisResult, HistoryEntry, AnalysisRecord } from "@/types/analysis";
import { saveToHistory, loadHistory, clearHistory, removeFromHistory } from "@/lib/history";
<<<<<<< HEAD
import { apiFetch, getAnalysisCurrent, getMe, getAnalysesHistory, getCachedProfile, setCachedProfile } from "@/lib/api";
import { exportRelatorioPDF } from "@/lib/pdf";
=======
import { apiFetch, getAnalysisCurrent, getMe, getCachedProfile, setCachedProfile } from "@/lib/api";
>>>>>>> 801053e (perf: Promise.all boot, lazy tabs (InventoryManager/EquipeTab/ReportSection), skeleton on painel)
import type { UserProfile } from "@/lib/api";
import ProfileModal from "@/components/ProfileModal";
import NotificationBell from "@/components/NotificationBell";

/* Lazy load pesado do recharts */
const DashboardCharts = dynamic(() => import("@/components/DashboardCharts"), {
  ssr: false,
  loading: () => <SkeletonCharts />,
});

/* Lazy load de tabs pesadas */
const ReportSection = dynamic(() => import("@/components/ReportSection"), {
  ssr: false,
  loading: () => <SkeletonCard height={300} />,
});
const InventoryManager = dynamic(() => import("@/components/InventoryManager"), {
  ssr: false,
  loading: () => <SkeletonCard height={300} />,
});
const EquipeTab = dynamic(() => import("@/components/EquipeTab"), {
  ssr: false,
  loading: () => <SkeletonCard height={300} />,
});

type Tab = "painel" | "ranking" | "relatorio" | "estoque" | "importar" | "manual" | "equipe";

function resolveDisplayName(profile: UserProfile | null, emailFallback?: string | null): string {
  const empresa = profile?.empresa_nome?.trim();
  if (empresa) return empresa;

  const nomeExibicao = profile?.nome_exibicao?.trim();
  if (nomeExibicao) return nomeExibicao;

  const username = profile?.username?.trim();
  if (username) return username;

  const email = (emailFallback ?? profile?.email ?? "").trim();
  if (email.includes("@")) return email.split("@")[0];

  return "...";
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="h-px w-8 bg-accent" />
      <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">{children}</span>
    </div>
  );
}
function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-[clamp(1.8rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[14px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

type TabIcon = React.ComponentType<{ className?: string }>;
const TAB_CONFIG: Record<Tab, { label: string; Icon: TabIcon }> = {
  painel:    { label: "Painel",       Icon: LayoutDashboard },
  ranking:   { label: "Ranking",      Icon: ListOrdered },
  relatorio: { label: "Relatório IA", Icon: FileText },
  estoque:   { label: "Estoque",      Icon: Package },
  importar:  { label: "Importar",     Icon: ArrowUpFromLine },
  manual:    { label: "Cadastrar",    Icon: Plus },
  equipe:    { label: "Equipe",       Icon: Users },
};

function DashboardInner() {
  const router  = useRouter();
  const params  = useSearchParams();

  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [isDemo,   setIsDemo]   = useState(false);
  const [invItems, setInvItems] = useState<import("@/lib/inventory").InventoryItem[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [booting,  setBooting]  = useState(true);
<<<<<<< HEAD
  const [pdfLoading, setPdfLoading] = useState(false);
  const [analysisRecords, setAnalysisRecords] = useState<AnalysisRecord[]>([]);
=======
>>>>>>> 801053e (perf: Promise.all boot, lazy tabs (InventoryManager/EquipeTab/ReportSection), skeleton on painel)
  const [username, setUsername] = useState<string>("...");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [highlightSku, setHighlightSku] = useState<string | null>(null);
  const [showProfileModal,  setShowProfileModal]  = useState(false);
  const [showOnboarding,    setShowOnboarding]    = useState(false);
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const [tab,      setTabState] = useState<Tab>((params.get("tab") as Tab) ?? "painel");
  const [inventorySnapshot, setInventorySnapshot] = useState<HistoryEntry["items_snapshot"] | undefined>(undefined);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    router.push(url.pathname + url.search, { scroll: false });
  }, [router]);

  useEffect(() => {
    const cachedProfile = getCachedProfile();
    if (cachedProfile) {
      setUserProfile(cachedProfile);
      setUsername(resolveDisplayName(cachedProfile));
    }

    const token = localStorage.getItem("token");
    if (!token) { window.location.replace("/"); return; }
    try {
      const p = JSON.parse(atob(token.split(".")[1]));
      if (p.exp && p.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        window.location.replace("/");
        return;
      }
    } catch {
      localStorage.removeItem("token");
      window.location.replace("/");
      return;
    }

    const localHistory = loadHistory();
    setHistory(localHistory);

<<<<<<< HEAD
    // Boot paralelo: perfil + inventário + histórico de análises em Promise.all
    Promise.all([
      getMe(),
      loadInventory(),
      getAnalysesHistory(),
    ]).then(([profile, items, records]) => {
=======
    // Boot paralelo: perfil + inventário em Promise.all
    Promise.all([
      getMe(),
      loadInventory(),
    ]).then(([profile, items]) => {
>>>>>>> 801053e (perf: Promise.all boot, lazy tabs (InventoryManager/EquipeTab/ReportSection), skeleton on painel)
      setBooting(false);
      if (!profile) {
        // Token inválido/expirado — localStorage já foi limpo por getMe
        window.location.replace("/");
        return;
      }
      setCachedProfile(profile);
      setUserProfile(profile);
      setUsername(resolveDisplayName(profile));
      setInvItems(items);
<<<<<<< HEAD
      setAnalysisRecords(records);
=======
>>>>>>> 801053e (perf: Promise.all boot, lazy tabs (InventoryManager/EquipeTab/ReportSection), skeleton on painel)
      if (!profile.nome_exibicao || !profile.username) {
        setShowOnboarding(true);
      }
    }).catch(() => { setBooting(false); });
  }, [router]);

  async function handleResult(data: AnalysisResult) {
    setResult(data);
    setCurrentEntryId(null);
    setIsDemo(false);
    setInventorySnapshot(undefined);
    // C4 — captura snapshot do inventário no momento da análise
    const invItems = await loadInventory();
    const snapshot = invItems.length > 0
      ? invItems.map(i => ({ sku: i.sku, nome: i.nome, ean: i.ean, loja: i.loja, categoria: i.categoria, estoque_atual: i.estoque_atual, vendas_diarias: i.vendas_diarias, preco_medio: i.preco_medio }))
      : undefined;
    const entry = saveToHistory(data, snapshot);
    setHistory(prev => [entry, ...prev].slice(0, 10));
    setTab("painel");
  }

  async function exportPDF() {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      await exportRelatorioPDF(username);
    } finally {
      setPdfLoading(false);
    }
  }

  const criticos = result?.resultados.filter(r => r.score_ruptura >= 71).length ?? 0;
  const topSku   = result?.resultados[0]?.sku;
  const isAdmin  = userProfile?.tipo_perfil === "empresa";
  const tabs: Tab[] = [
    ...(result ? (["painel","ranking","relatorio"] as Tab[]) : []),
    "estoque", "importar", "manual",
    ...(isAdmin ? (["equipe"] as Tab[]) : []),
  ];

  const CARD: React.CSSProperties = {
    background: "#fff", border: "1px solid #E8E8EF", borderRadius: 16,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
  };

  return (
    <div data-theme="light" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>

      {/* ── HEADER FIXO COMPLETO (Navbar + Banner + Tabs juntos) ── */}
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", boxShadow: "0 1px 0 var(--border)" }}>

        <Navbar
          username={username}
          criticos={isDemo ? 0 : criticos}
          onLogoClick={() => {
            setResult(null);
            setTab("painel");
          }}
          onProfileClick={() => setShowProfileModal(true)}
          actionsSlot={
            <NotificationBell
              result={result}
              onStockAlertClick={sku => { setHighlightSku(sku); setTab("estoque"); }}
            />
          }
        />

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
          <div className="flex">
            {tabs.map(t => {
              const isActive = tab === t;
              const { label, Icon } = TAB_CONFIG[t];
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`group relative flex items-center gap-2 px-4 py-3.5 text-[12px] font-medium transition-colors ${
                    isActive ? "text-ink" : "text-muted-foreground hover:text-ink"
                  }`}
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {t === "ranking" && criticos > 0 && !isDemo && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-amber-soft px-1.5 font-mono text-[10px] font-semibold text-ink">
                      {criticos}
                    </span>
                  )}
                  {t === "estoque" && invItems.length > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-amber-soft px-1.5 font-mono text-[10px] font-semibold text-ink">
                      {invItems.length}
                    </span>
                  )}
                  {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {result && !isDemo && (
              <button onClick={exportPDF} disabled={pdfLoading} className="btn-ghost no-print" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 5, opacity: pdfLoading ? 0.6 : 1 }}>
                {pdfLoading ? "Gerando..." : "↓ Exportar PDF"}
              </button>
            )}
            <HistoryPanel
              entries={history}
              onSelect={async entry => {
                // Resposta imediata — carrega resultado do localStorage
                setResult(entry.result);
                setCurrentEntryId(entry.id);
                setIsDemo(false);
                setTab("painel");
                // C4 — fonte primária: Supabase; fallback: cache localStorage
                const apiSnapshot = await getAnalysisCurrent();
                setInventorySnapshot(apiSnapshot ?? entry.items_snapshot);
              }}
              onClear={async () => {
                try { await apiFetch("/analyses", { method: "DELETE" }); } catch { /* offline */ }
                clearHistory();
                setHistory([]);
                setResult(null);
                setCurrentEntryId(null);
                setIsDemo(false);
              }}
              onDelete={async (id) => {
                try { await apiFetch(`/analyses/${id}`, { method: "DELETE" }); } catch { /* offline */ }
                removeFromHistory(id);
                setHistory(prev => prev.filter(e => e.id !== id));
                if (currentEntryId === id) { setResult(null); setCurrentEntryId(null); }
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

            <PageHeader
              eyebrow={isDemo ? "Demonstração" : "Análise Operacional"}
              title="Painel Operacional"
              subtitle={<>{result.total_skus} SKUs analisados{(result.categorias?.length ?? 0) > 0 && ` · ${result.categorias.length} categorias`} · <button onClick={() => setTab("ranking")} className="text-accent hover:underline" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "inherit", fontFamily: "inherit", padding: 0 }}>ver ranking completo →</button></>}
              right={<div className="flex flex-wrap gap-2">{(result.categorias ?? []).slice(0, 4).map(cat => { const n = result.resultados.filter(r => r.categoria === cat && r.score_ruptura >= 71).length; return <span key={cat} className="text-[12px] px-3 py-1 rounded-full border" style={{ border: `1px solid ${n > 0 ? "var(--danger)" : "var(--border)"}`, background: n > 0 ? "color-mix(in oklab,var(--danger) 8%,transparent)" : "var(--card)", color: n > 0 ? "var(--danger)" : "var(--muted-foreground)" }}>{cat}{n > 0 ? ` · ${n}` : ""}</span>; })}</div>}
            />

            {/* Métricas */}
            <SummaryCards
              totalSkus={result.total_skus}
              skusCriticos={result.skus_criticos}
              perdaTotal={result.perda_total_estimada}
              receitaPotencial={result.receita_potencial_total}
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

            {analysisRecords.length >= 2 && !isDemo && (
              <ErrorBoundary label="Linha do Tempo de Análises">
                <AnalysisTimeline records={analysisRecords} />
              </ErrorBoundary>
            )}

            <ErrorBoundary label="Gráficos">
              <DashboardCharts result={result} receitaPotencial={result.receita_potencial_total} />
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

        {/* ── PAINEL VAZIO ────────────────────────────────── */}
        {tab === "painel" && !result && booting && (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 60px" }}>
            <SkeletonCharts />
          </div>
        )}
        {tab === "painel" && !result && !booting && (
          <EmptyState
            onImportClick={() => setTab("importar")}
            onManualClick={() => setTab("manual")}
          />
        )}

        {/* ── RANKING ─────────────────────────────────────── */}
        {tab === "ranking" && result && (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 60px" }}>
            <PageHeader eyebrow="Inteligência Operacional" title="Ranking de Risco" subtitle={`${result.resultados.length} SKUs ordenados por score de ruptura · clique em uma linha para expandir`} />
            <RiskTable rows={result.resultados} categorias={result.categorias ?? []} />
          </div>
        )}

        {/* ── RELATÓRIO ───────────────────────────────────── */}
        {tab === "relatorio" && result && (
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 60px" }}>
            <PageHeader eyebrow="Gerado por Gemini Flash" title="Relatório Executivo" subtitle="Análise completa em linguagem de negócio"
              right={<button onClick={exportPDF} disabled={pdfLoading} className="btn-ghost no-print" style={{ fontSize: 13, padding: "10px 18px", borderRadius: 9, display: "flex", alignItems: "center", gap: 6, opacity: pdfLoading ? 0.6 : 1 }}>{pdfLoading ? "Gerando..." : "↓ Exportar PDF"}</button>}
            />
            <ErrorBoundary label="Relatório">
              <ReportSection relatorio={result.relatorio ?? "Relatório não disponível."} />
            </ErrorBoundary>
          </div>
        )}

        {/* ── IMPORTAR ─────────────────────────────────────── */}
        {tab === "importar" && (
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 60px" }}>
            <PageHeader eyebrow="Upload de arquivo" title="Importar Planilha" subtitle="Aceita Excel (.xlsx) e CSV. Máximo 10 MB." />
            <UploadZone onResult={handleResult} onLoading={setLoading} loading={loading} />
          </div>
        )}

        {/* ── ESTOQUE (CRUD) ────────────────────────────────── */}
        {tab === "estoque" && (
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 24px 60px" }}>
            {highlightSku && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "color-mix(in oklab, var(--amber,#E6A817) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--amber,#E6A817) 30%, transparent)" }}>
                <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>
                  Atenção: <strong>{highlightSku}</strong> está com score de ruptura crítico.
                </span>
                <button onClick={() => setHighlightSku(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>✕</button>
              </div>
            )}
            <PageHeader eyebrow="Gestão de Estoque" title="Inventário" subtitle="Cadastro, ajustes e análise de itens em estoque" />
            <InventoryManager
              onAnalyze={data => { handleResult(data); setTab("painel"); }}
              onLoading={setLoading}
              loading={loading}
              snapshot={inventorySnapshot}
              onClearSnapshot={() => setInventorySnapshot(undefined)}
              onItemsChange={setInvItems}
            />
          </div>
        )}

        {/* ── CADASTRAR ─────────────────────────────────────── */}
        {tab === "manual" && (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 60px" }}>
            <PageHeader eyebrow="Cadastro Manual" title="Novo Item" subtitle="Adicione produtos ao inventário um a um" />
            <ManualEntry onResult={handleResult} onLoading={setLoading} loading={loading} />
          </div>
        )}

        {/* ── EQUIPE (admin only) ───────────────────────────── */}
        {tab === "equipe" && isAdmin && (
          <div>
            <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 8px" }}>
              <PageHeader eyebrow="Gestão de Equipe" title="Equipe" subtitle="Membros, solicitações de entrada e convites" />
            </div>
            <EquipeTab />
          </div>
        )}
      </div>

      <ToastContainer />

      {/* Modal de onboarding — exibido na primeira vez, sem fechar até salvar */}
      {showOnboarding && userProfile && (
        <ProfileModal
          profile={userProfile}
          isOnboarding
          onSaved={updated => {
            setUserProfile(updated);
            setUsername(resolveDisplayName(updated));
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Modal de edição de perfil — aberto pelo avatar na Navbar */}
      {showProfileModal && userProfile && (
        <ProfileModal
          profile={userProfile}
          onSaved={updated => {
            setUserProfile(updated);
            setUsername(resolveDisplayName(updated));
            setShowProfileModal(false);
          }}
          onClose={() => setShowProfileModal(false)}
        />
      )}
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

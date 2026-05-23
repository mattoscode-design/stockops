"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult, InventorySnapshotItem, InventoryResponse } from "@/types/analysis";
import { apiFetch, getInventories, createInventory, activateInventory } from "@/lib/api";
import {
  loadInventory, addItem, updateItem, adjustStock, deleteItem,
  loadMovements, importFromAnalysis,
  type InventoryItem, type Movimento,
} from "@/lib/inventory";
import { toast } from "@/components/Toast";
import StockTrendChart from "@/components/StockTrendChart";

/* ─── tipos locais ────────────────────────────────────── */
type AdjustModal = { id: string; sku: string; estoque: number } | null;
type EditRow = string | null;

const TH: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontSize: 10,
  fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#9090A8", whiteSpace: "nowrap", background: "#F7F7FA",
  borderBottom: "1px solid #E2E2EA",
};
const TD: React.CSSProperties = {
  padding: "10px 14px", fontSize: 13, color: "#0A0A14",
  borderBottom: "1px solid #F0F0F5", verticalAlign: "middle",
};
const INP: React.CSSProperties = {
  width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 7,
  border: "1.5px solid #D97706", background: "#FFFBEB",
  color: "#0A0A14", outline: "none", fontFamily: "monospace",
};

/* ─── Componente principal ────────────────────────────── */
interface Props {
  onAnalyze: (data: AnalysisResult) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
  snapshot?: InventorySnapshotItem[];               // C4: externo (HistoryPanel)
  onClearSnapshot?: () => void;
  onItemsChange?: (items: InventoryItem[]) => void; // B1: badge ao vivo
}

export default function InventoryManager({ onAnalyze, onLoading, loading, snapshot, onClearSnapshot, onItemsChange }: Props) {
  const [items,   setItems]   = useState<InventoryItem[]>([]);
  const [editRow, setEditRow] = useState<EditRow>(null);
  const [editBuf, setEditBuf] = useState<Partial<InventoryItem>>({});
  const [adjModal, setAdjModal] = useState<AdjustModal>(null);
  const [adjTipo,  setAdjTipo]  = useState<"entrada" | "saida">("saida");
  const [adjQtd,   setAdjQtd]   = useState("");
  const [adjObs,   setAdjObs]   = useState("");
  const [showHist, setShowHist] = useState<string | null>(null);
  const [histMovimentos, setHistMovimentos] = useState<Movimento[]>([]);
  const [addMode,  setAddMode]  = useState(false);
  const [newRow,   setNewRow]   = useState<Partial<InventoryItem>>({ sku:"", ean:"", loja:"", categoria:"", estoque_atual:0, vendas_diarias:0, preco_medio:0, promocao_planejada:0 });
  const [search,   setSearch]   = useState("");
  // F8: API inventory state
  const [inventories,      setInventories]      = useState<InventoryResponse[]>([]);
  const [activeInventoryId, setActiveInventoryId] = useState<string | null>(null);
  const [showNewModal,     setShowNewModal]     = useState(false);
  const [newInventoryName, setNewInventoryName] = useState("");
  const [creatingInventory, setCreatingInventory] = useState(false);

  const reload = useCallback(async () => {
    const loaded = await loadInventory(activeInventoryId ?? undefined);
    setItems(loaded);
    onItemsChange?.(loaded);
  }, [onItemsChange, activeInventoryId]);

  // F8: load inventories list on mount
  useEffect(() => {
    getInventories().then(setInventories);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!showHist) { setHistMovimentos([]); return; }
    loadMovements(showHist).then(setHistMovimentos);
  }, [showHist]);

  /* ── Edição inline ───────────────────────────────────── */
  function startEdit(item: InventoryItem) {
    setEditRow(item.id);
    setEditBuf({ sku: item.sku, ean: item.ean, loja: item.loja, categoria: item.categoria,
      estoque_atual: item.estoque_atual, vendas_diarias: item.vendas_diarias,
      preco_medio: item.preco_medio, promocao_planejada: item.promocao_planejada });
  }

  async function saveEdit(id: string) {
    await updateItem(id, editBuf);
    toast("Produto atualizado", "success");
    setEditRow(null);
    reload();
  }

  /* ── Ajuste de estoque ────────────────────────────────── */
  async function submitAdjust() {
    if (!adjModal || !adjQtd) return;
    await adjustStock(adjModal.id, adjTipo, Number(adjQtd), adjModal.estoque, adjObs);
    toast(`${adjTipo === "saida" ? "Saída" : "Entrada"} de ${adjQtd} un. registrada — ${adjModal.sku}`, adjTipo === "saida" ? "warning" : "success");
    setAdjModal(null); setAdjQtd(""); setAdjObs("");
    reload();
  }

  /* ── Adicionar novo item ─────────────────────────────── */
  async function submitAdd() {
    if (!newRow.sku?.trim() || !newRow.loja?.trim()) return;
    await addItem({ sku: newRow.sku!, ean: newRow.ean || undefined, loja: newRow.loja!, categoria: newRow.categoria || "Sem Categoria",
      estoque_atual: Number(newRow.estoque_atual) || 0, vendas_diarias: Number(newRow.vendas_diarias) || 0,
      preco_medio: Number(newRow.preco_medio) || 0, promocao_planejada: Number(newRow.promocao_planejada) || 0 });
    toast(`${newRow.sku} adicionado ao inventário`, "success");
    setAddMode(false);
    setNewRow({ sku:"", ean:"", loja:"", categoria:"", estoque_atual:0, vendas_diarias:0, preco_medio:0, promocao_planejada:0 });
    reload();
  }

  /* ── Analisar estoque atual ──────────────────────────── */
  async function analyzeAll() {
    if (items.length === 0) return;
    onLoading(true);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = items.map(i =>
      `${esc(i.sku)},${esc(i.ean ?? "")},${esc(i.loja)},${esc(i.categoria)},${i.estoque_atual},${i.vendas_diarias},${i.preco_medio},${i.promocao_planejada}`
    );
    const csv = `sku,ean,loja,categoria,estoque_atual,vendas_diarias,preco_medio,promocao_planejada\n${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const fd = new FormData();
    fd.append("file", blob, "estoque_atual.csv");
    try {
      const path = activeInventoryId
        ? `/analysis/upload?inventory_id=${activeInventoryId}`
        : "/analysis/upload";
      const res = await apiFetch(path, { method: "POST", body: fd });
      if (res.ok) onAnalyze(await res.json());
    } catch { /* handled by apiFetch */ }
    finally { onLoading(false); }
  }

  /* ── F8: Seletor de inventário ───────────────────────── */
  async function handleSelectorChange(val: string) {
    onClearSnapshot?.();
    if (val === "__live__") {
      setActiveInventoryId(null);
    } else {
      await activateInventory(val);
      setActiveInventoryId(val);
    }
  }

  async function confirmNewInventory() {
    setCreatingInventory(true);
    try {
      const inv = await createInventory(newInventoryName.trim() || undefined);
      if (!inv) { toast("Erro ao criar inventário", "error"); return; }
      await activateInventory(inv.id);
      setInventories(prev => [...prev, inv]);
      setActiveInventoryId(inv.id);
      setShowNewModal(false);
      setNewInventoryName("");
      toast(`Inventário "${inv.name}" criado`, "success");
    } finally {
      setCreatingInventory(false);
    }
  }

  /* ── Snapshot state ──────────────────────────────────── */
  const activeInventory = inventories.find(inv => inv.id === activeInventoryId) ?? null;
  const isSnapshotInventory = activeInventory?.type === "snapshot";

  // C4: external snapshot passed as prop (from HistoryPanel selection)
  const snapshotItems: InventoryItem[] | null = snapshot
    ? snapshot.map((s, idx) => ({
        id: `snap-${idx}-${s.sku}-${s.loja}`,
        sku: s.sku,
        nome: s.nome,
        ean: s.ean,
        loja: s.loja,
        categoria: s.categoria,
        estoque_atual: s.estoque_atual,
        vendas_diarias: s.vendas_diarias,
        preco_medio: s.preco_medio,
        promocao_planejada: 0,
        ultima_atualizacao: "snapshot",
        movimentos: [],
      }))
    : null;

  const isReadOnly = !!snapshotItems || isSnapshotInventory;
  const displayItems = snapshotItems ?? items;
  const filteredDisplay = displayItems.filter(i =>
    !search || i.sku.toLowerCase().includes(search.toLowerCase()) ||
    i.loja.toLowerCase().includes(search.toLowerCase()) ||
    i.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const totalItens = displayItems.length;
  const totalUnidades = displayItems.reduce((s, i) => s + i.estoque_atual, 0);
  const rupturas = displayItems.filter(i => i.estoque_atual === 0).length;
  const criticos = displayItems.filter(i => i.vendas_diarias > 0 && (i.estoque_atual / i.vendas_diarias) < 3).length;

  return (
    <div style={{ padding: "32px 24px 60px" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#D97706", marginBottom: 8 }}>
          Gerenciamento de Estoque
        </p>
        <h2 className="heading-lg" style={{ color: "var(--text)", marginBottom: 8 }}>Inventário Ativo</h2>
        <p style={{ fontSize: 14, color: "var(--text-2)" }}>
          CRUD completo do seu estoque — adicione, edite, registre entradas/saídas e analise qualquer momento.
        </p>
      </div>

      {/* F8 — Seletor de estoque (API) */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8" }}>Estoque</span>
          <select
            value={activeInventoryId ?? "__live__"}
            onChange={e => handleSelectorChange(e.target.value)}
            style={{ padding:"6px 10px", fontSize:12, borderRadius:8, border:"1px solid #E2E2EA", background:"#fff", color:"#0A0A14", outline:"none", cursor:"pointer", fontFamily:"inherit" }}
          >
            <option value="__live__">Estoque Atual</option>
            {inventories.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.name}{inv.type === "snapshot" ? " (snapshot)" : ""}{inv.item_count > 0 ? ` · ${inv.item_count} itens` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setNewInventoryName(""); setShowNewModal(true); }}
          style={{ background:"#F0F0F5", color:"#52526A", border:"1px solid #E2E2EA", padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
        >
          + Novo Estoque
        </button>
      </div>

      {/* Banner — snapshot externo C4 */}
      {snapshotItems && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "#D97706", color: "#FFF" }}>SNAPSHOT</span>
            <span style={{ fontSize: 12, color: "#92400E" }}>
              Visualizando o inventário do momento desta análise — {snapshotItems.length} item{snapshotItems.length !== 1 ? "s" : ""}. Edições desabilitadas.
            </span>
          </div>
          {onClearSnapshot && (
            <button onClick={onClearSnapshot} style={{ background: "transparent", color: "#92400E", border: "1px solid #FCD34D", padding: "4px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Voltar ao inventário atual
            </button>
          )}
        </div>
      )}

      {/* Banner — inventário tipo snapshot da API */}
      {isSnapshotInventory && !snapshotItems && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "#D97706", color: "#FFF" }}>SNAPSHOT</span>
          <span style={{ fontSize: 12, color: "#92400E" }}>
            Este inventário é somente leitura. Edições desabilitadas.
          </span>
        </div>
      )}

      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label:"Total de Itens",    value: totalItens,     color:"#0A0A14",  icon:"📦" },
          { label:"Total em Estoque",  value: totalUnidades,  color:"#0A0A14",  icon:"🏭" },
          { label:"Em Ruptura",        value: rupturas,       color: rupturas > 0 ? "#DC2626" : "#16A34A", icon:"⚠️" },
          { label:"Cobertura < 3 dias",value: criticos,       color: criticos > 0 ? "#EA580C" : "#16A34A", icon:"🔴" },
        ].map(c => (
          <div key={c.label} style={{ background:"#fff", border:"1px solid #E2E2EA", borderRadius:12, padding:"16px 18px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8" }}>{c.label}</span>
              <span style={{ fontSize:16 }}>{c.icon}</span>
            </div>
            <p style={{ fontFamily:"monospace", fontSize:24, fontWeight:800, color:c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input placeholder="Buscar SKU, loja ou categoria…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding:"7px 12px", fontSize:13, borderRadius:8, border:"1px solid #E2E2EA", outline:"none", width:240, color:"#0A0A14", background:"#FAFAFA" }}
            onFocus={e => (e.currentTarget.style.borderColor = "#D97706")}
            onBlur={e => (e.currentTarget.style.borderColor = "#E2E2EA")}
          />
          <span style={{ fontSize:12, color:"#9090A8" }}>{filteredDisplay.length}/{totalItens} itens</span>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          {!isReadOnly && (
            <button onClick={() => setAddMode(true)} style={{ background:"var(--amber)", color:"#0B0B0C", border:"none", padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              + Novo produto
            </button>
          )}
          {!isReadOnly && (
            <button onClick={analyzeAll} disabled={loading || items.length === 0}
              style={{ background:"#0A0A14", color:"#fff", border:"none", padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity: items.length === 0 ? 0.4 : 1 }}>
              {loading ? "Analisando…" : "▶ Analisar estoque atual"}
            </button>
          )}
        </div>
      </div>

      {/* Tabela principal */}
      <div style={{ background:"#fff", border:"1px solid #E2E2EA", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 16px rgba(0,0,0,0.04)" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1060 }}>
            <thead>
              <tr>
                {["Produto / SKU","EAN","Loja","Categoria","Estoque Atual","Vendas/dia","Preço (R$)","Promo %","Cobertura","Última Atualiz.","Ações"].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>

              {/* Linha de adicionar novo */}
              {addMode && (
                <tr style={{ background:"#FFFBEB" }}>
                  {(["sku","ean","loja","categoria","estoque_atual","vendas_diarias","preco_medio","promocao_planejada"] as const).map(f => (
                    <td key={f} style={{ ...TD, padding:"8px 10px" }}>
                      <input
                        type={["estoque_atual","vendas_diarias","preco_medio","promocao_planejada"].includes(f) ? "number" : "text"}
                        placeholder={f === "sku" ? "Nome do produto *" : f === "ean" ? "EAN *" : f === "loja" ? "Loja *" : f}
                        value={String(newRow[f] ?? "")}
                        onChange={e => setNewRow(p => ({ ...p, [f]: e.target.value }))}
                        style={{ ...INP }}
                        min="0" step="any"
                      />
                    </td>
                  ))}
                  <td style={TD}>—</td>
                  <td style={TD}>—</td>
                  <td style={{ ...TD, whiteSpace:"nowrap" }}>
                    <button onClick={submitAdd} style={{ background:"#16A34A", color:"#fff", border:"none", padding:"5px 12px", borderRadius:6, fontSize:12, cursor:"pointer", marginRight:4, fontFamily:"inherit" }}>Salvar</button>
                    <button onClick={() => setAddMode(false)} style={{ background:"none", border:"1px solid #E2E2EA", color:"#9090A8", padding:"5px 10px", borderRadius:6, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
                  </td>
                </tr>
              )}

              {filteredDisplay.length === 0 && !addMode ? (
                <tr>
                  <td colSpan={11} style={{ padding:"56px", textAlign:"center", color:"#9090A8", fontSize:14 }}>
                    {totalItens === 0
                      ? "Nenhum produto cadastrado. Clique em \"+ Novo produto\" ou importe do histórico."
                      : "Nenhum produto corresponde à busca."
                    }
                  </td>
                </tr>
              ) : filteredDisplay.map((item, idx) => {
                const isEditing = editRow === item.id;
                const cobertura = item.vendas_diarias > 0 ? (item.estoque_atual / item.vendas_diarias).toFixed(1) : "∞";
                const cobN = item.vendas_diarias > 0 ? item.estoque_atual / item.vendas_diarias : 99;
                const cobColor = cobN === 0 ? "#DC2626" : cobN < 3 ? "#EA580C" : cobN < 7 ? "#D97706" : "#16A34A";

                return (
                  <tr key={item.id}
                    style={{ background: isEditing ? "#FFFBEB" : idx % 2 === 0 ? "#fff" : "#FAFAFA",
                      transition:"background .1s" }}
                    onMouseEnter={e => { if (!isEditing) (e.currentTarget as HTMLElement).style.background = "#F5F5FA"; }}
                    onMouseLeave={e => { if (!isEditing) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "#fff" : "#FAFAFA"; }}>

                    {/* SKU */}
                    <td style={TD}>
                      {isEditing
                        ? <input value={editBuf.sku ?? ""} onChange={e => setEditBuf(p => ({...p, sku: e.target.value}))} style={INP} />
                        : <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12 }}>{item.sku}</span>
                      }
                    </td>
                    {/* EAN */}
                    <td style={TD}>
                      {isEditing
                        ? <input value={editBuf.ean ?? ""} placeholder="EAN" onChange={e => setEditBuf(p => ({...p, ean: e.target.value}))} style={{ ...INP, width:120 }} />
                        : <span style={{ fontFamily:"monospace", fontSize:11, color:"#9090A8" }}>{item.ean || "—"}</span>
                      }
                    </td>
                    {/* Loja */}
                    <td style={{ ...TD, color:"#52526A", fontSize:12 }}>
                      {isEditing
                        ? <input value={editBuf.loja ?? ""} onChange={e => setEditBuf(p => ({...p, loja: e.target.value}))} style={INP} />
                        : item.loja
                      }
                    </td>
                    {/* Categoria */}
                    <td style={{ ...TD, color:"#52526A", fontSize:12 }}>
                      {isEditing
                        ? <input value={editBuf.categoria ?? ""} onChange={e => setEditBuf(p => ({...p, categoria: e.target.value}))} style={INP} />
                        : item.categoria
                      }
                    </td>
                    {/* Estoque */}
                    <td style={TD}>
                      {isEditing
                        ? <input type="number" value={editBuf.estoque_atual ?? 0} onChange={e => setEditBuf(p => ({...p, estoque_atual: Number(e.target.value)}))} style={{ ...INP, width:80 }} min="0" />
                        : <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:15, color: item.estoque_atual === 0 ? "#DC2626" : "#0A0A14" }}>{item.estoque_atual}</span>
                      }
                    </td>
                    {/* Vendas/dia */}
                    <td style={TD}>
                      {isEditing
                        ? <input type="number" value={editBuf.vendas_diarias ?? 0} onChange={e => setEditBuf(p => ({...p, vendas_diarias: Number(e.target.value)}))} style={{ ...INP, width:80 }} min="0" step="0.1" />
                        : <span style={{ fontFamily:"monospace", fontSize:12 }}>{item.vendas_diarias}</span>
                      }
                    </td>
                    {/* Preço */}
                    <td style={TD}>
                      {isEditing
                        ? <input type="number" value={editBuf.preco_medio ?? 0} onChange={e => setEditBuf(p => ({...p, preco_medio: Number(e.target.value)}))} style={{ ...INP, width:90 }} min="0" step="0.01" />
                        : <span style={{ fontFamily:"monospace", fontSize:12 }}>R$ {item.preco_medio.toFixed(2)}</span>
                      }
                    </td>
                    {/* Promo */}
                    <td style={TD}>
                      {isEditing
                        ? <input type="number" value={editBuf.promocao_planejada ?? 0} onChange={e => setEditBuf(p => ({...p, promocao_planejada: Number(e.target.value)}))} style={{ ...INP, width:70 }} min="0" step="0.01" />
                        : <span style={{ fontSize:12, color:"#52526A" }}>{item.promocao_planejada > 0 ? `+${(item.promocao_planejada * 100).toFixed(0)}%` : "—"}</span>
                      }
                    </td>
                    {/* Cobertura */}
                    <td style={TD}>
                      <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12, color: cobColor }}>{cobertura}d</span>
                    </td>
                    {/* Data */}
                    <td style={{ ...TD, fontSize:11, color:"#9090A8", whiteSpace:"nowrap" }}>
                      {item.ultima_atualizacao}
                    </td>
                    {/* Ações */}
                    <td style={{ ...TD, whiteSpace:"nowrap" }}>
                      {isReadOnly ? (
                        <span style={{ fontSize:11, color:"#9090A8" }}>—</span>
                      ) : isEditing ? (
                        <div style={{ display:"flex", gap:4 }}>
                          <button onClick={() => saveEdit(item.id)} style={{ background:"#16A34A", color:"#fff", border:"none", padding:"4px 10px", borderRadius:6, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✓ Salvar</button>
                          <button onClick={() => setEditRow(null)} style={{ background:"none", border:"1px solid #E2E2EA", color:"#9090A8", padding:"4px 8px", borderRadius:6, fontSize:11, cursor:"pointer" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display:"flex", gap:3 }}>
                          {/* Ajustar estoque */}
                          <button onClick={() => { setAdjModal({ id: item.id, sku: item.sku, estoque: item.estoque_atual }); setAdjTipo("saida"); }}
                            title="Registrar entrada ou saída de estoque"
                            style={{ background:"none", border:"1px solid #E2E2EA", padding:"4px 8px", borderRadius:6, fontSize:13, cursor:"pointer", transition:"all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#D97706"; e.currentTarget.style.background="#FFFBEB"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#E2E2EA"; e.currentTarget.style.background="none"; }}>
                            📦
                          </button>
                          {/* Histórico */}
                          <button onClick={() => setShowHist(showHist === item.id ? null : item.id)}
                            title="Ver histórico de movimentos"
                            style={{ background:"none", border:"1px solid #E2E2EA", padding:"4px 8px", borderRadius:6, fontSize:12, cursor:"pointer", color:"#9090A8", transition:"all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#0891B2"; e.currentTarget.style.color="#0891B2"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#E2E2EA"; e.currentTarget.style.color="#9090A8"; }}>
                            ⏱
                          </button>
                          {/* Editar */}
                          <button onClick={() => startEdit(item)}
                            title="Editar dados do produto"
                            style={{ background:"none", border:"1px solid #E2E2EA", padding:"4px 8px", borderRadius:6, fontSize:12, cursor:"pointer", color:"#9090A8", transition:"all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#D97706"; e.currentTarget.style.color="#D97706"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#E2E2EA"; e.currentTarget.style.color="#9090A8"; }}>
                            ✏️
                          </button>
                          {/* Excluir */}
                          <button onClick={async () => { await deleteItem(item.id); reload(); }}
                            title="Excluir produto"
                            style={{ background:"none", border:"1px solid #E2E2EA", padding:"4px 8px", borderRadius:6, fontSize:13, cursor:"pointer", transition:"all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#DC2626"; e.currentTarget.style.background="#FEF2F2"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#E2E2EA"; e.currentTarget.style.background="none"; }}>
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Histórico de movimentos inline */}
        {showHist && !isReadOnly && (() => {
          const item = items.find(i => i.id === showHist);
          if (!item) return null;
          return (
            <div style={{ borderTop:"1px solid #E2E2EA", padding:"16px 24px", background:"#F9F9FC" }}>
              <p style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8", marginBottom:12 }}>
                Histórico — {item.sku} · {item.loja}
              </p>

              {/* Gráfico de tendência */}
              <div style={{ marginBottom:16 }}>
                <StockTrendChart item={item} />
              </div>

              {histMovimentos.length === 0 ? (
                <p style={{ fontSize:13, color:"#9090A8" }}>Nenhum movimento registrado ainda.</p>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {[...histMovimentos].reverse().map(m => (
                    <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 12px", borderRadius:8, background:"#fff", border:"1px solid #E2E2EA" }}>
                      <span style={{ fontSize:14 }}>{m.tipo === "entrada" ? "📥" : m.tipo === "saida" ? "📤" : "✏️"}</span>
                      <span style={{ fontSize:11, color: m.tipo === "entrada" ? "#16A34A" : m.tipo === "saida" ? "#DC2626" : "#D97706", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{m.tipo}</span>
                      <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:13, color:"#0A0A14" }}>
                        {m.tipo === "entrada" ? "+" : "-"}{m.quantidade} un.
                      </span>
                      {m.obs && <span style={{ fontSize:12, color:"#52526A" }}>{m.obs}</span>}
                      <span style={{ fontSize:11, color:"#9090A8", marginLeft:"auto" }}>{m.data}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Modal ajuste de estoque */}
      {adjModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => { if (e.target === e.currentTarget) setAdjModal(null); }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"32px", width:400, boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:"#0A0A14", marginBottom:4 }}>Ajustar Estoque</h3>
            <p style={{ fontSize:13, color:"#9090A8", marginBottom:24 }}>
              {adjModal.sku} · estoque atual: <strong style={{ color:"#0A0A14" }}>{adjModal.estoque} un.</strong>
            </p>

            {/* Tipo */}
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {(["saida","entrada"] as const).map(t => (
                <button key={t} onClick={() => setAdjTipo(t)}
                  style={{ flex:1, padding:"10px", borderRadius:10, border:`2px solid ${adjTipo===t ? (t==="saida" ? "#DC2626" : "#16A34A") : "#E2E2EA"}`, background: adjTipo===t ? (t==="saida" ? "#FEF2F2" : "#F0FDF4") : "#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:600, fontSize:13, color: adjTipo===t ? (t==="saida" ? "#DC2626" : "#16A34A") : "#9090A8" }}>
                  {t === "saida" ? "📤 Saída (vendas)" : "📥 Entrada (recebimento)"}
                </button>
              ))}
            </div>

            {/* Quantidade */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8", marginBottom:6 }}>
                Quantidade {adjTipo === "saida" ? "que saiu" : "recebida"}
              </label>
              <input type="number" min="1" value={adjQtd} onChange={e => setAdjQtd(e.target.value)}
                placeholder="0"
                style={{ width:"100%", padding:"12px 14px", fontSize:20, fontFamily:"monospace", fontWeight:700, borderRadius:10, border:"1.5px solid #E2E2EA", outline:"none", color:"#0A0A14" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#D97706")}
                onBlur={e => (e.currentTarget.style.borderColor = "#E2E2EA")}
                autoFocus
              />
            </div>

            {/* Observação */}
            <div style={{ marginBottom:24 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8", marginBottom:6 }}>
                Observação (opcional)
              </label>
              <input value={adjObs} onChange={e => setAdjObs(e.target.value)}
                placeholder="Ex: venda do dia, ajuste de inventário…"
                style={{ width:"100%", padding:"10px 14px", fontSize:13, borderRadius:10, border:"1.5px solid #E2E2EA", outline:"none", color:"#0A0A14", fontFamily:"inherit" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#D97706")}
                onBlur={e => (e.currentTarget.style.borderColor = "#E2E2EA")}
              />
            </div>

            {/* Preview */}
            {adjQtd && (
              <div style={{ marginBottom:20, padding:"10px 14px", background: adjTipo==="saida" ? "#FEF2F2" : "#F0FDF4", borderRadius:10, border:`1px solid ${adjTipo==="saida" ? "#FECACA" : "#BBF7D0"}` }}>
                <p style={{ fontSize:13, color: adjTipo==="saida" ? "#DC2626" : "#16A34A", fontWeight:600 }}>
                  {adjTipo === "saida"
                    ? `Estoque passará de ${adjModal.estoque} → ${Math.max(0, adjModal.estoque - Number(adjQtd))} un.`
                    : `Estoque passará de ${adjModal.estoque} → ${adjModal.estoque + Number(adjQtd)} un.`
                  }
                </p>
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={submitAdjust} disabled={!adjQtd}
                style={{ flex:1, background: adjTipo==="saida" ? "#DC2626" : "#16A34A", color:"#fff", border:"none", padding:"12px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", opacity: adjQtd ? 1 : 0.5, fontFamily:"inherit" }}>
                Confirmar {adjTipo === "saida" ? "Saída" : "Entrada"}
              </button>
              <button onClick={() => setAdjModal(null)}
                style={{ padding:"12px 20px", borderRadius:10, border:"1px solid #E2E2EA", background:"transparent", fontSize:13, color:"#9090A8", cursor:"pointer", fontFamily:"inherit" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F8 — Modal novo inventário */}
      {showNewModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"32px", width:400, boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:"#0A0A14", marginBottom:4 }}>Novo Inventário</h3>
            <p style={{ fontSize:13, color:"#9090A8", marginBottom:24 }}>
              Crie um inventário em branco. O nome é opcional — se omitido, será gerado automaticamente.
            </p>

            <div style={{ marginBottom:24 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#9090A8", marginBottom:6 }}>
                Nome (opcional)
              </label>
              <input
                value={newInventoryName}
                onChange={e => setNewInventoryName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmNewInventory(); }}
                placeholder="Ex: Estoque Maio 2026"
                style={{ width:"100%", padding:"12px 14px", fontSize:14, borderRadius:10, border:"1.5px solid #E2E2EA", outline:"none", color:"#0A0A14", fontFamily:"inherit" }}
                onFocus={e => (e.currentTarget.style.borderColor = "#D97706")}
                onBlur={e => (e.currentTarget.style.borderColor = "#E2E2EA")}
                autoFocus
              />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={confirmNewInventory} disabled={creatingInventory}
                style={{ flex:1, background:"#D97706", color:"#fff", border:"none", padding:"12px", borderRadius:10, fontSize:14, fontWeight:600, cursor: creatingInventory ? "not-allowed" : "pointer", opacity: creatingInventory ? 0.6 : 1, fontFamily:"inherit" }}>
                {creatingInventory ? "Criando…" : "Criar inventário"}
              </button>
              <button onClick={() => setShowNewModal(false)}
                style={{ padding:"12px 20px", borderRadius:10, border:"1px solid #E2E2EA", background:"transparent", fontSize:13, color:"#9090A8", cursor:"pointer", fontFamily:"inherit" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Hook para carregar análise no estoque ─────────── */
export function useImportToInventory() {
  return useCallback(async (result: AnalysisResult) => {
    await importFromAnalysis(result.resultados);
  }, []);
}

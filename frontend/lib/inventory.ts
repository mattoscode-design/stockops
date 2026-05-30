import { apiFetch } from "@/lib/api";

const KEY = "stockops_inventory";

export interface InventoryItem {
  id: string;
  sku: string;
  nome?: string;
  ean?: string;
  loja: string;
  categoria: string;
  estoque_atual: number;
  vendas_diarias: number;
  preco_medio: number;
  promocao_planejada: number;
  ultima_atualizacao: string;
  movimentos: Movimento[];
}

export interface Movimento {
  id: string;
  data: string;
  tipo: "entrada" | "saida" | "edicao";
  quantidade: number;
  obs: string;
}

function now() {
  return new Date().toLocaleString("pt-BR");
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function lsLoad(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSave(items: InventoryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// ── Mappers API → Frontend ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiItem(raw: Record<string, any>): InventoryItem {
  return {
    id: String(raw.id),
    sku: String(raw.sku ?? ""),
    nome: raw.nome ? String(raw.nome) : undefined,
    ean: raw.ean ? String(raw.ean) : undefined,
    loja: String(raw.loja ?? ""),
    categoria: String(raw.categoria ?? "Sem Categoria"),
    estoque_atual: Number(raw.estoque_atual ?? 0),
    vendas_diarias: Number(raw.vendas_diarias ?? 0),
    preco_medio: Number(raw.preco_medio ?? 0),
    promocao_planejada: Number(raw.promocao_planejada ?? 0),
    ultima_atualizacao: raw.updated_at
      ? new Date(String(raw.updated_at)).toLocaleString("pt-BR")
      : now(),
    movimentos: [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiMovement(raw: Record<string, any>): Movimento {
  return {
    id: String(raw.id),
    data: raw.created_at
      ? new Date(String(raw.created_at)).toLocaleString("pt-BR")
      : now(),
    tipo: (raw.tipo as "entrada" | "saida") ?? "saida",
    quantidade: Number(raw.quantidade ?? 0),
    obs: String(raw.motivo ?? ""),
  };
}

// ── API-first functions com fallback localStorage ─────────────────────────────

export async function loadInventory(inventoryId?: string): Promise<InventoryItem[]> {
  try {
    const path = inventoryId ? `/inventory?inventory_id=${inventoryId}` : "/inventory";
    const res = await apiFetch(path);
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as Record<string, any>[];
      const items = data.map(mapApiItem);
      lsSave(items);
      return items;
    }
  } catch { /* sem conexão — usa localStorage */ }
  return lsLoad();
}

export async function loadMovements(itemId: string): Promise<Movimento[]> {
  try {
    const res = await apiFetch(`/inventory/${itemId}/movements`);
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as Record<string, any>[];
      return data.map(mapApiMovement);
    }
  } catch { /* fallback */ }
  const item = lsLoad().find(i => i.id === itemId);
  return item?.movimentos ?? [];
}

export async function addItem(
  item: Omit<InventoryItem, "id" | "ultima_atualizacao" | "movimentos">
): Promise<InventoryItem> {
  try {
    const res = await apiFetch("/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: item.sku,
        nome: item.nome ?? null,
        ean: item.ean ?? null,
        loja: item.loja,
        categoria: item.categoria,
        estoque_atual: item.estoque_atual,
        vendas_diarias: item.vendas_diarias,
        preco_medio: item.preco_medio,
      }),
    });
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as Record<string, any>;
      const novo: InventoryItem = {
        ...mapApiItem(data),
        promocao_planejada: item.promocao_planejada,
      };
      lsSave([...lsLoad(), novo]);
      return novo;
    }
  } catch { /* fallback */ }
  const novo: InventoryItem = {
    ...item,
    id: crypto.randomUUID(),
    ultima_atualizacao: now(),
    movimentos: [],
  };
  lsSave([...lsLoad(), novo]);
  return novo;
}

export async function updateItem(
  id: string,
  changes: Partial<Omit<InventoryItem, "id" | "movimentos">>
): Promise<void> {
  try {
    const body: Record<string, unknown> = {};
    if (changes.sku !== undefined) body.sku = changes.sku;
    if (changes.nome !== undefined) body.nome = changes.nome;
    if (changes.ean !== undefined) body.ean = changes.ean;
    if (changes.loja !== undefined) body.loja = changes.loja;
    if (changes.categoria !== undefined) body.categoria = changes.categoria;
    if (changes.estoque_atual !== undefined) body.estoque_atual = changes.estoque_atual;
    if (changes.vendas_diarias !== undefined) body.vendas_diarias = changes.vendas_diarias;
    if (changes.preco_medio !== undefined) body.preco_medio = changes.preco_medio;

    const res = await apiFetch(`/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      lsSave(lsLoad().map(i =>
        i.id === id ? { ...i, ...changes, ultima_atualizacao: now() } : i
      ));
      return;
    }
  } catch { /* fallback */ }
  lsSave(lsLoad().map(i =>
    i.id === id ? { ...i, ...changes, ultima_atualizacao: now() } : i
  ));
}

export async function adjustStock(
  id: string,
  tipo: "entrada" | "saida",
  quantidade: number,
  currentStock: number,
  obs = ""
): Promise<void> {
  const delta = tipo === "entrada" ? quantidade : -quantidade;
  const novo_estoque = Math.max(0, currentStock + delta);

  try {
    await apiFetch(`/inventory/${id}/movement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, quantidade, motivo: obs || null }),
    });
    await apiFetch(`/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estoque_atual: novo_estoque }),
    });
  } catch { /* fallback — localStorage continua abaixo */ }

  const movimento: Movimento = {
    id: crypto.randomUUID(),
    data: now(),
    tipo,
    quantidade,
    obs,
  };
  lsSave(lsLoad().map(i => {
    if (i.id !== id) return i;
    const movimentos = [...i.movimentos, movimento].slice(-50);
    return { ...i, estoque_atual: novo_estoque, ultima_atualizacao: now(), movimentos };
  }));
}

export async function deleteItem(id: string): Promise<void> {
  try {
    await apiFetch(`/inventory/${id}`, { method: "DELETE" });
  } catch { /* fallback */ }
  lsSave(lsLoad().filter(i => i.id !== id));
}

export async function clearInventory(itemIds: string[]): Promise<void> {
  for (const id of itemIds) {
    try {
      await apiFetch(`/inventory/${id}`, { method: "DELETE" });
    } catch { /* best effort */ }
  }
  localStorage.removeItem(KEY);
}

export async function importFromAnalysis(
  rows: {
    sku: string;
    loja: string;
    categoria: string;
    perda_estimada_reais: number;
    cobertura_dias: number;
    quantidade_recomendada: number;
  }[]
): Promise<void> {
  // Usa API-first para verificar duplicatas — não depende do localStorage
  const existing = await loadInventory();
  const existingKeys = new Set(existing.map(i => `${i.sku}::${i.loja}`));

  for (const r of rows) {
    const k = `${r.sku}::${r.loja}`;
    if (!existingKeys.has(k)) {
      const vendas = r.quantidade_recomendada > 0 ? Math.round(r.quantidade_recomendada / 14) : 10;
      const estoque = Math.round(r.cobertura_dias * vendas);
      await addItem({
        sku: r.sku,
        loja: r.loja,
        categoria: r.categoria || "Sem Categoria",
        estoque_atual: estoque,
        vendas_diarias: vendas,
        preco_medio: 0,
        promocao_planejada: 0,
      });
      existingKeys.add(k);
    }
  }
}

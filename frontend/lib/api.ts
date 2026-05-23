import type { InventorySnapshotItem, InventoryResponse } from "@/types/analysis";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_TIMEOUT = 15000;

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
      throw new Error("Sessão expirada. Redirecionando para login.");
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSnapshotItem(raw: Record<string, any>): InventorySnapshotItem | null {
  if (!raw.sku || !raw.loja) return null;
  return {
    sku: String(raw.sku),
    nome: raw.nome ? String(raw.nome) : undefined,
    ean: raw.ean ? String(raw.ean) : undefined,
    loja: String(raw.loja),
    categoria: String(raw.categoria ?? "Sem Categoria"),
    estoque_atual: Number(raw.estoque_atual ?? 0),
    vendas_diarias: Number(raw.vendas_diarias ?? 0),
    preco_medio: Number(raw.preco_medio ?? 0),
  };
}

export async function getInventories(): Promise<InventoryResponse[]> {
  try {
    const res = await apiFetch("/inventories");
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await res.json() as InventoryResponse[];
  } catch {
    return [];
  }
}

export async function createInventory(name?: string): Promise<InventoryResponse | null> {
  try {
    const res = await apiFetch("/inventories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name ?? null }),
    });
    if (!res.ok) return null;
    return await res.json() as InventoryResponse;
  } catch {
    return null;
  }
}

export async function activateInventory(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/inventories/${id}/activate`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteInventory(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/inventories/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Busca a análise mais recente do tenant no Supabase.
 * Retorna items_snapshot tipado ou null se offline/erro.
 */
export async function getAnalysisCurrent(): Promise<InventorySnapshotItem[] | null> {
  try {
    const res = await apiFetch("/analyses/current");
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as Record<string, any>;
    if (!Array.isArray(data.items_snapshot)) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = (data.items_snapshot as Record<string, any>[])
      .map(mapSnapshotItem)
      .filter((i): i is InventorySnapshotItem => i !== null);
    return mapped.length > 0 ? mapped : null;
  } catch {
    return null;
  }
}

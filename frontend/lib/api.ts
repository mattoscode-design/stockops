import type { InventorySnapshotItem, InventoryResponse, AnalysisRecord } from "@/types/analysis";
import type { TenantSearchResult, JoinRequest, TenantUser } from "@/types/tenant";
export type { TenantSearchResult, JoinRequest, TenantUser };

export interface UserProfile {
  email: string;
  username: string | null;
  nome_exibicao: string | null;
  tipo_perfil: string | null;
  empresa_nome: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_TIMEOUT = 15000;
const PROFILE_CACHE_KEY = "userProfile";

type ApiFetchOptions = RequestInit & {
  /** Se true, um 401 apenas limpa o token e lança erro — sem window.location redirect.
   *  Use em chamadas onde o caller quer tratar o 401 com router.replace(). */
  skipRedirectOn401?: boolean;
};

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<Response> {
  const { skipRedirectOn401, ...fetchOptions } = options;
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem(PROFILE_CACHE_KEY);
      if (!skipRedirectOn401) {
        window.location.href = "/";
      }
      throw new Error("Sessão expirada.");
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

// ── Profile cache (Fix 1 — elimina flash de username) ────────────────────────

export function getCachedProfile(): UserProfile | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PROFILE_CACHE_KEY) : null;
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

export function setCachedProfile(p: UserProfile): void {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); } catch { /* quota */ }
}

export function clearCachedProfile(): void {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

/**
 * Busca o perfil do usuário autenticado.
 * Usa skipRedirectOn401 para que um token inválido retorne null
 * sem hard-redirect — o caller (dashboard) faz router.replace("/") graciosamente.
 */
export async function getMe(): Promise<UserProfile | null> {
  try {
    const res = await apiFetch("/auth/me", { skipRedirectOn401: true });
    if (!res.ok) return null;
    return await res.json() as UserProfile;
  } catch {
    return null;
  }
}

export interface UpdateProfileResult {
  ok: boolean;
  /** Mensagem de erro do backend (ex: "Username já está em uso.") */
  errorMessage?: string;
}

/**
 * Atualiza o perfil do usuário.
 * Usa skipRedirectOn401 para que uma sessão expirada durante o onboarding
 * retorne { ok: false } sem hard-redirect.
 * Propaga a mensagem de erro do backend (ex: username duplicado → 400).
 */
export async function updateProfile(
  data: Partial<Omit<UserProfile, "email">>
): Promise<UpdateProfileResult> {
  try {
    const res = await apiFetch("/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      skipRedirectOn401: true,
    });
    if (res.ok) return { ok: true };
    // Extrai mensagem de erro do body (FastAPI envia { detail: "..." })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json().catch((): Record<string, any> => ({}));
    const msg =
      typeof body?.detail === "string" && body.detail.trim()
        ? body.detail
        : "Não foi possível salvar. Tente novamente.";
    return { ok: false, errorMessage: msg };
  } catch {
    return { ok: false };
  }
}

// ── Equipe / Team ─────────────────────────────────────────────────────────────
// Tipos canônicos em @/types/tenant — re-exportados acima.

/** @deprecated use TenantSearchResult from @/types/tenant */
export type TenantResult = TenantSearchResult;
/** @deprecated use TenantUser from @/types/tenant */
export type TeamMember = TenantUser;

export interface TeamInviteInfo {
  token: string;
  email: string;
  tenant_name: string;
  invited_by: string;
  expires_at: string;
}

export interface InviteResult {
  ok: boolean;
  token?: string;
  errorMessage?: string;
}

export async function searchTenants(q: string): Promise<TenantSearchResult[]> {
  try {
    const res = await apiFetch(
      `/team/tenants/search?q=${encodeURIComponent(q)}`,
      { skipRedirectOn401: true },
    );
    if (!res.ok) return [];
    return await res.json() as TenantSearchResult[];
  } catch {
    return [];
  }
}

export async function requestJoinTenant(tenantId: string): Promise<UpdateProfileResult> {
  try {
    const res = await apiFetch("/team/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId }),
      skipRedirectOn401: true,
    });
    if (res.ok) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json().catch((): Record<string, any> => ({}));
    const msg =
      typeof body?.detail === "string" && body.detail.trim()
        ? body.detail
        : "Não foi possível enviar a solicitação.";
    return { ok: false, errorMessage: msg };
  } catch {
    return { ok: false };
  }
}

export async function getTeamMembers(): Promise<TenantUser[]> {
  try {
    const res = await apiFetch("/team/members");
    if (!res.ok) return [];
    return await res.json() as TenantUser[];
  } catch {
    return [];
  }
}

export async function getJoinRequests(): Promise<JoinRequest[]> {
  try {
    const res = await apiFetch("/team/join-requests");
    if (!res.ok) return [];
    return await res.json() as JoinRequest[];
  } catch {
    return [];
  }
}

export async function approveJoinRequest(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/team/join-requests/${id}/approve`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function rejectJoinRequest(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/team/join-requests/${id}/reject`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function inviteMember(email: string): Promise<InviteResult> {
  try {
    const res = await apiFetch("/team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json().catch((): Record<string, any> => ({}));
      return { ok: true, token: typeof data?.token === "string" ? data.token : undefined };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json().catch((): Record<string, any> => ({}));
    const msg =
      typeof body?.detail === "string" && body.detail.trim()
        ? body.detail
        : "Não foi possível enviar o convite.";
    return { ok: false, errorMessage: msg };
  } catch {
    return { ok: false };
  }
}

/** Busca detalhes de um convite por token — não exige autenticação. */
export async function getInviteDetails(token: string): Promise<TeamInviteInfo | null> {
  try {
    const res = await fetch(`${API_URL}/team/invites/${token}`);
    if (!res.ok) return null;
    return await res.json() as TeamInviteInfo;
  } catch {
    return null;
  }
}

export async function acceptInvite(token: string): Promise<UpdateProfileResult> {
  try {
    const res = await apiFetch(`/team/invites/${token}/accept`, {
      method: "POST",
      skipRedirectOn401: true,
    });
    if (res.ok) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json().catch((): Record<string, any> => ({}));
    const msg =
      typeof body?.detail === "string" && body.detail.trim()
        ? body.detail
        : "Não foi possível aceitar o convite.";
    return { ok: false, errorMessage: msg };
  } catch {
    return { ok: false };
  }
}

export async function getMyInvites(): Promise<TeamInviteInfo[]> {
  try {
    const res = await apiFetch("/team/my-invites", { skipRedirectOn401: true });
    if (!res.ok) return [];
    return await res.json() as TeamInviteInfo[];
  } catch { return []; }
}

export async function removeMember(userId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/team/members/${userId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Análises ──────────────────────────────────────────────────────────────────

/**
 * Busca o histórico das últimas análises do tenant (endpoint GET /analyses).
 * Retorna array vazio se offline/erro.
 */
export async function getAnalysesHistory(): Promise<AnalysisRecord[]> {
  try {
    const res = await apiFetch("/analyses");
    if (!res.ok) return [];
    return await res.json() as AnalysisRecord[];
  } catch {
    return [];
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

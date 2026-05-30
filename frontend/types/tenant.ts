export interface TenantSearchResult {
  id: string;
  name: string;
  slug: string;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  email: string;
  username: string | null;
  nome_exibicao: string | null;
  requested_at: string;
}

export interface TenantUser {
  id: string;
  email: string;
  username: string | null;
  nome_exibicao: string | null;
  tipo_perfil: string;
  joined_at: string;
}

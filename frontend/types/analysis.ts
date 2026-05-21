export interface AnalysisRow {
  sku: string;
  nome?: string;
  loja: string;
  categoria: string;
  cobertura_dias: number;
  score_ruptura: number;
  classificacao: string;
  curva_abc: string;
  perda_estimada_reais: number;
  quantidade_recomendada: number;
  insight: string;
  recomendacao: string;
  validade_dias_restantes?: number;
}

export interface AnalysisResult {
  total_skus: number;
  skus_criticos: number;
  perda_total_estimada: number;
  receita_potencial_total?: number;
  categorias: string[];
  relatorio: string;
  resultados: AnalysisRow[];
}

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: string;
  result: AnalysisResult;
}

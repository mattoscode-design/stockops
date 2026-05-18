export interface AnalysisRow {
  sku: string;
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
}

export interface AnalysisResult {
  total_skus: number;
  skus_criticos: number;
  perda_total_estimada: number;
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

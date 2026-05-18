import type { AnalysisResult } from "@/types/analysis";

/*
 * Dados de demonstração — espelham exatamente o arquivo docs/demo_dados.csv
 * Valores calculados: cobertura = estoque / vendas_ajustadas
 * Perda = max(0, 14 - cobertura) × vendas_ajustadas × preco
 * ABC: Pareto por perda (A=80%, B=15%, C=5%)
 */

export const DEMO_RESULT: AnalysisResult = {
  total_skus: 24,
  skus_criticos: 15,
  perda_total_estimada: 49310.30,
  categorias: ["Alimentos", "Bebidas", "Higiene", "Laticínios", "Limpeza"],
  relatorio: `## Situação Geral
A análise identificou **24 SKUs** em **5 categorias** com **15 em estado crítico**, representando uma perda estimada de **R$ 49.310,00** caso as rupturas ocorram. A categoria Bebidas concentra 6 dos 15 SKUs urgentes — maior risco operacional da semana.

## Principais Riscos
- **Arroz Branco 5kg** (Loja SP-Sul): 3,6 dias de cobertura com perda estimada de R$ 7.267,00 — maior impacto financeiro da análise.
- **Papel Higiênico 12un** (Loja MG-BH): 1,4 dias de cobertura. Curva A — alto impacto e janela crítica.
- **Cerveja Long Neck** (Loja SP-Sul): 0,2 dias de cobertura com promoção planejada (+30%) acelerando o giro.
- **Isotônico 500ml** (Loja SP-Norte): estoque zerado — ruptura confirmada, venda sendo perdida agora.

## Recomendações Prioritárias
1. **Hoje — Urgente:** Repor Isotônico 500ml e Água Mineral 500ml — estoque zerado ou < 0,1 dia.
2. **Hoje:** Acionar abastecimento emergencial de Cerveja Long Neck SP-Sul e Feijão Carioca RJ-Barra.
3. **Esta semana:** Revisar política de reposição do Arroz Branco 5kg — impacto financeiro mais alto da análise.

## Análise por Categoria
- **Bebidas:** 6 SKUs críticos — maior concentração de risco. Atenção especial à cerveja com promoção ativa.
- **Higiene:** 4 SKUs críticos (Shampoo, Condicionador, Sabão em Pó, Sabonete) — categoria subestimada.
- **Alimentos:** Arroz 5kg em alerta com maior perda estimada. Azeite em ruptura iminente.
- **Laticínios:** Iogurte e Achocolatado em estado crítico. Leite Integral em alerta.
- **Limpeza:** Detergente e Sabão monitorados — cobertura baixa mas estável.

## Próximos 7 Dias
1. Executar reposição emergencial dos 15 SKUs críticos, priorizando por impacto financeiro (ABC A e B).
2. Revisar promoções planejadas — Cerveja e Suco com promoção ativa estão acelerando o giro e reduzindo cobertura.`,

  resultados: [
    // ── URGENTES ────────────────────────────────────────────────────────────────
    { sku:"Água Mineral 500ml",      loja:"Loja MG-BH",      categoria:"Bebidas",   cobertura_dias:0.1,  score_ruptura:94, classificacao:"Urgente",           curva_abc:"B", perda_estimada_reais:1207.50,  quantidade_recomendada:431, insight:"Risco crítico: 0,1d de cobertura. Perda estimada R$ 1.207,50.",          recomendacao:"Repor 431 unidades para garantir 14 dias de cobertura." },
    { sku:"Isotônico 500ml",         loja:"Loja SP-Norte",   categoria:"Bebidas",   cobertura_dias:0.0,  score_ruptura:92, classificacao:"Urgente",           curva_abc:"B", perda_estimada_reais:1744.40,  quantidade_recomendada:196, insight:"Risco crítico: 0d de cobertura. Ruptura confirmada — perda ativa.",       recomendacao:"Repor 196 unidades para garantir 14 dias de cobertura." },
    { sku:"Cerveja Long Neck",       loja:"Loja SP-Sul",     categoria:"Bebidas",   cobertura_dias:0.2,  score_ruptura:93, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:3262.20,  quantidade_recomendada:504, insight:"Risco crítico: 0,2d de cobertura. Promoção +30% acelerando o giro.",     recomendacao:"Repor 504 unidades. Promoção planejada eleva demanda estimada." },
    { sku:"Feijão Carioca 1kg",      loja:"Loja RJ-Barra",   categoria:"Alimentos", cobertura_dias:0.4,  score_ruptura:90, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2131.40,  quantidade_recomendada:244, insight:"Risco crítico: 0,4d de cobertura. Perda estimada R$ 2.131,40.",         recomendacao:"Repor 244 unidades para garantir 14 dias de cobertura." },
    { sku:"Refrigerante PET 2L",     loja:"Loja RJ-Centro",  categoria:"Bebidas",   cobertura_dias:0.4,  score_ruptura:89, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2841.60,  quantidade_recomendada:300, insight:"Risco crítico: 0,4d de cobertura. Perda estimada R$ 2.841,60.",         recomendacao:"Repor 300 unidades para garantir 14 dias de cobertura." },
    { sku:"Shampoo 400ml",           loja:"Loja SP-Sul",     categoria:"Higiene",   cobertura_dias:0.4,  score_ruptura:91, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2263.80,  quantidade_recomendada:122, insight:"Risco crítico: 0,4d de cobertura. Perda estimada R$ 2.263,80.",         recomendacao:"Repor 122 unidades para garantir 14 dias de cobertura." },
    { sku:"Azeite Extra Virgem 500ml",loja:"Loja SP-Leste",  categoria:"Alimentos", cobertura_dias:0.3,  score_ruptura:92, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2895.10,  quantidade_recomendada:89,  insight:"Risco crítico: 0,3d de cobertura. Perda estimada R$ 2.895,10.",         recomendacao:"Repor 89 unidades para garantir 14 dias de cobertura." },
    { sku:"Condicionador 400ml",     loja:"Loja SP-Norte",   categoria:"Higiene",   cobertura_dias:0.3,  score_ruptura:92, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2044.80,  quantidade_recomendada:103, insight:"Risco crítico: 0,3d de cobertura. Perda estimada R$ 2.044,80.",         recomendacao:"Repor 103 unidades para garantir 14 dias de cobertura." },
    { sku:"Sabão em Pó 1kg",         loja:"Loja SP-Leste",   categoria:"Limpeza",   cobertura_dias:0.6,  score_ruptura:88, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:1894.00,  quantidade_recomendada:127, insight:"Risco crítico: 0,6d de cobertura. Perda estimada R$ 1.894,00.",         recomendacao:"Repor 127 unidades para garantir 14 dias de cobertura." },
    { sku:"Energético 473ml",        loja:"Loja SP-Sul",     categoria:"Bebidas",   cobertura_dias:0.6,  score_ruptura:87, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2056.00,  quantidade_recomendada:260, insight:"Risco crítico: 0,6d de cobertura. Promoção +20% reduz cobertura real.", recomendacao:"Repor 260 unidades. Considerar promoção no cálculo de demanda." },
    { sku:"Achocolatado 200ml",      loja:"Loja RJ-Centro",  categoria:"Laticínios",cobertura_dias:0.2,  score_ruptura:93, classificacao:"Urgente",           curva_abc:"C", perda_estimada_reais:724.50,   quantidade_recomendada:289, insight:"Risco crítico: 0,2d de cobertura. Perda estimada R$ 724,50.",           recomendacao:"Repor 289 unidades para garantir 14 dias de cobertura." },
    { sku:"Cerveja Long Neck",       loja:"Loja RJ-Barra",   categoria:"Bebidas",   cobertura_dias:1.7,  score_ruptura:82, classificacao:"Urgente",           curva_abc:"A", perda_estimada_reais:2549.40,  quantidade_recomendada:391, insight:"Risco crítico: 1,7d de cobertura. Promoção +30% eleva risco.",          recomendacao:"Repor 391 unidades. Alta promoção requer antecipação do pedido." },
    // ── AÇÃO RECOMENDADA ────────────────────────────────────────────────────────
    { sku:"Papel Higiênico 12un",    loja:"Loja MG-BH",      categoria:"Limpeza",   cobertura_dias:1.4,  score_ruptura:78, classificacao:"Ação Recomendada",  curva_abc:"A", perda_estimada_reais:3742.20,  quantidade_recomendada:227, insight:"Ação necessária: 1,4d de cobertura. Janela de reposição se fechando.",  recomendacao:"Repor 227 unidades para garantir 14 dias de cobertura." },
    { sku:"Café Torrado 500g",       loja:"Loja SP-Norte",   categoria:"Alimentos", cobertura_dias:1.5,  score_ruptura:76, classificacao:"Ação Recomendada",  curva_abc:"A", perda_estimada_reais:3009.90,  quantidade_recomendada:151, insight:"Ação necessária: 1,5d de cobertura. Promoção +10% acelera o giro.",     recomendacao:"Repor 151 unidades. Promoção ativa exige reposição antecipada." },
    { sku:"Iogurte Natural 170g",    loja:"Loja SP-Norte",   categoria:"Laticínios",cobertura_dias:1.5,  score_ruptura:74, classificacao:"Ação Recomendada",  curva_abc:"C", perda_estimada_reais:451.50,   quantidade_recomendada:119, insight:"Ação necessária: 1,5d de cobertura. Janela de reposição se fechando.",  recomendacao:"Repor 119 unidades para garantir 14 dias de cobertura." },
    // ── ALERTA ──────────────────────────────────────────────────────────────────
    { sku:"Energético 473ml",        loja:"Loja SP-Norte",   categoria:"Bebidas",   cobertura_dias:2.4,  score_ruptura:54, classificacao:"Alerta",             curva_abc:"B", perda_estimada_reais:1695.40,  quantidade_recomendada:214, insight:"Monitorar: 2,4d de cobertura. Acompanhar evolução do giro.",           recomendacao:"Repor 214 unidades para garantir 14 dias de cobertura." },
    { sku:"Suco Integral 1L",        loja:"Loja SP-Leste",   categoria:"Bebidas",   cobertura_dias:2.4,  score_ruptura:54, classificacao:"Alerta",             curva_abc:"B", perda_estimada_reais:1334.00,  quantidade_recomendada:107, insight:"Monitorar: 2,4d de cobertura. Promoção +15% pode acelerar ruptura.",   recomendacao:"Repor 107 unidades. Monitorar impacto da promoção no giro." },
    { sku:"Leite Integral 1L",       loja:"Loja MG-BH",      categoria:"Laticínios",cobertura_dias:2.0,  score_ruptura:58, classificacao:"Alerta",             curva_abc:"A", perda_estimada_reais:2268.00,  quantidade_recomendada:540, insight:"Monitorar: 2,0d de cobertura. Alto volume de vendas exige atenção.",   recomendacao:"Repor 540 unidades — alto giro exige cobertura ampliada." },
    { sku:"Biscoito Cream Cracker",  loja:"Loja RJ-Zona Sul", categoria:"Alimentos",cobertura_dias:2.4,  score_ruptura:51, classificacao:"Alerta",             curva_abc:"C", perda_estimada_reais:698.10,   quantidade_recomendada:163, insight:"Monitorar: 2,4d de cobertura. Acompanhar evolução do giro.",           recomendacao:"Repor 163 unidades para garantir 14 dias de cobertura." },
    { sku:"Arroz Branco 5kg",        loja:"Loja SP-Sul",     categoria:"Alimentos", cobertura_dias:3.6,  score_ruptura:52, classificacao:"Alerta",             curva_abc:"A", perda_estimada_reais:7267.40,  quantidade_recomendada:317, insight:"Monitorar: 3,6d de cobertura. Maior perda estimada da análise.",       recomendacao:"Repor 317 unidades — prioridade pelo alto impacto financeiro." },
    { sku:"Sabonete Líquido 250ml",  loja:"Loja RJ-Centro",  categoria:"Higiene",   cobertura_dias:2.9,  score_ruptura:53, classificacao:"Alerta",             curva_abc:"B", perda_estimada_reais:1185.50,  quantidade_recomendada:133, insight:"Monitorar: 2,9d de cobertura. Acompanhar evolução do giro.",           recomendacao:"Repor 133 unidades para garantir 14 dias de cobertura." },
    { sku:"Detergente Líquido 500ml",loja:"Loja MG-BH",      categoria:"Limpeza",   cobertura_dias:3.1,  score_ruptura:48, classificacao:"Alerta",             curva_abc:"C", perda_estimada_reais:711.90,   quantidade_recomendada:245, insight:"Monitorar: 3,1d de cobertura. Acompanhar evolução do giro.",           recomendacao:"Repor 245 unidades para garantir 14 dias de cobertura." },
    { sku:"Macarrão Espaguete 500g", loja:"Loja MG-BH",      categoria:"Alimentos", cobertura_dias:5.0,  score_ruptura:42, classificacao:"Monitoramento",      curva_abc:"C", perda_estimada_reais:442.80,   quantidade_recomendada:108, insight:"Estável: 5,0d de cobertura dentro do esperado.",                       recomendacao:"Repor 108 unidades para garantir 14 dias de cobertura." },
    // ── MONITORAMENTO ───────────────────────────────────────────────────────────
    { sku:"Refrigerante PET 2L",     loja:"Loja RJ-Zona Sul", categoria:"Bebidas",  cobertura_dias:9.2,  score_ruptura:32, classificacao:"Monitoramento",      curva_abc:"B", perda_estimada_reais:888.90,   quantidade_recomendada:93,  insight:"Estável: 9,2d de cobertura dentro do esperado.",                       recomendacao:"Repor 93 unidades para garantir 14 dias de cobertura." },
  ],
};

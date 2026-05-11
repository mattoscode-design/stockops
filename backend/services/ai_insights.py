import json
import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


def gerar_insight(sku: str, loja: str, score: float, cobertura: float,
                  classificacao: str, perda: float, quantidade: float,
                  aceleracao: bool) -> tuple[str, str]:

    prompt = f"""
Você é um analista operacional de varejo. Gere um insight e uma recomendação em português, diretos e em linguagem de negócio.

Dados do SKU:
- Produto: {sku}
- Loja: {loja}
- Score de ruptura: {score}/100 ({classificacao})
- Cobertura atual: {cobertura} dias
- Aceleração de demanda detectada: {"Sim" if aceleracao else "Não"}
- Perda estimada: R$ {perda:,.2f}
- Quantidade recomendada de reposição: {quantidade:.0f} unidades

Responda EXATAMENTE neste formato JSON (sem markdown, sem explicações extras):
{{
  "insight": "frase de até 2 linhas explicando o risco e a causa",
  "recomendacao": "frase de até 2 linhas com a ação específica recomendada"
}}
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return data["insight"], data["recomendacao"]
    except Exception:
        insight = (
            f"O SKU {sku} possui score de ruptura {score}/100 com cobertura de {cobertura} dias. "
            f"Perda estimada de R$ {perda:,.2f}."
        )
        recomendacao = f"Repor {quantidade:.0f} unidades para atingir cobertura de 14 dias."
        return insight, recomendacao

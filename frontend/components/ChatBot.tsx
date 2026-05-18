"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { AnalysisResult } from "@/types/analysis";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FETCH_TIMEOUT_MS = 15000;

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
}

interface QuestionGroup {
  label: string;
  questions: string[];
}

interface Props {
  result: AnalysisResult;
}

function buildQuestionGroups(result: AnalysisResult): QuestionGroup[] {
  const top = result.resultados[0];
  const urgentes = result.resultados.filter(r => r.classificacao === "Urgente");
  const topCat = result.categorias?.[0];

  const groups: QuestionGroup[] = [
    {
      label: "Risco e Prioridade",
      questions: [
        "Qual SKU tem maior risco de ruptura agora?",
        "Quais lojas devo priorizar para reposição hoje?",
        "Quais os 3 SKUs mais urgentes desta semana?",
      ],
    },
    {
      label: "Impacto Financeiro",
      questions: [
        "Qual a perda estimada total desta análise?",
        "Quais SKUs representam maior impacto financeiro?",
        "Como está a distribuição de risco por classificação?",
      ],
    },
  ];

  if (top) {
    groups.push({
      label: "Análise de Produto",
      questions: [
        `Qual é a situação do ${top.sku} em ${top.loja}?`,
        urgentes.length > 0
          ? `Por que ${urgentes[0].sku} está em estado Urgente?`
          : `Por que ${top.sku} tem score ${top.score_ruptura}?`,
        "O que significa a cobertura em dias no contexto desta análise?",
      ],
    });
  }

  if (topCat) {
    groups.push({
      label: "Por Categoria",
      questions: [
        `Qual categoria tem maior exposição a ruptura?`,
        `Como está a categoria ${topCat} nesta análise?`,
        "Quais categorias têm SKUs em estado crítico?",
      ],
    });
  }

  return groups;
}

export default function ChatBot({ result }: Props) {
  const [open, setOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: `Olá! Analisei ${result.total_skus} SKUs — ${result.skus_criticos} em estado crítico. Sou o assistente desta análise e só respondo sobre os dados carregados. Selecione uma pergunta ao lado ou escreva sobre estoque, SKUs ou lojas.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const questionGroups = useMemo(() => buildQuestionGroups(result), [result]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || loading) return;

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", text: question }]);
    setInput("");
    setLoading(true);
    setShowTemplate(false);

    const token = localStorage.getItem("token");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_URL}/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, context: result }),
        signal: controller.signal,
      });

      const data = await res.json();
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "bot", text: data.answer }]);
    } catch (e) {
      const isTimeout = e instanceof Error && e.name === "AbortError";
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "bot",
        text: isTimeout
          ? "A resposta demorou demais. Tente novamente."
          : "Erro ao conectar. Tente novamente.",
      }]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-50 cursor-pointer"
        style={{ background: "var(--amber)", transition: "transform 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        aria-label="Abrir Assistente Operacional">
        <span className="text-xl">{open ? "✕" : "💬"}</span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex gap-3 items-end"
          style={{ maxWidth: "calc(100vw - 3rem)" }}>

          {/* Template lateral de perguntas */}
          {showTemplate && (
            <div className="w-64 rounded-xl overflow-hidden shadow-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

              <div className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <p className="text-xs font-medium tracking-widest uppercase"
                  style={{ color: "var(--muted)" }}>
                  Sugestões de Perguntas
                </p>
              </div>

              <div className="p-3 flex flex-col gap-3 max-h-96 overflow-y-auto">
                {questionGroups.map(group => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold mb-1.5 px-1"
                      style={{ color: "var(--amber)" }}>
                      {group.label}
                    </p>
                    {group.questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => send(q)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg mb-1 cursor-pointer"
                        style={{
                          background: "var(--surface-2)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "var(--amber)";
                          e.currentTarget.style.color = "var(--amber)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.color = "var(--text)";
                        }}>
                        {q}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="px-4 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Restrito aos dados desta análise
                </p>
              </div>
            </div>
          )}

          {/* Painel do chat */}
          <div className="w-88 rounded-xl flex flex-col shadow-2xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              height: "480px",
              width: "22rem",
            }}>

            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2 shrink-0"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--green)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Assistente Operacional
              </span>
              <button
                onClick={() => setShowTemplate(v => !v)}
                className="ml-auto text-xs cursor-pointer px-2 py-1 rounded"
                style={{
                  color: showTemplate ? "var(--amber)" : "var(--muted)",
                  border: `1px solid ${showTemplate ? "var(--amber)" : "var(--border)"}`,
                  transition: "all 0.15s",
                }}>
                Sugestões
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="group relative max-w-[85%]">
                    <div
                      className="rounded-lg px-3 py-2 text-sm"
                      style={
                        msg.role === "user"
                          ? { background: "var(--amber)", color: "#0A0A0A" }
                          : { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }
                      }>
                      {msg.text}
                    </div>
                    {msg.role === "bot" && msg.id !== "welcome" && (
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.text)}
                        className="absolute -bottom-4 right-0 text-xs opacity-0 group-hover:opacity-100 cursor-pointer"
                        style={{ color: "var(--muted)", transition: "opacity 0.15s" }}>
                        copiar
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 flex gap-1"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce inline-block"
                        style={{ background: "var(--muted)", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 flex gap-2 shrink-0"
              style={{ borderTop: "1px solid var(--border)" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder="Pergunte sobre estoque, SKUs, lojas..."
                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--amber)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                aria-label="Enviar"
                className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40"
                style={{ background: "var(--amber)", color: "#0A0A0A" }}>
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

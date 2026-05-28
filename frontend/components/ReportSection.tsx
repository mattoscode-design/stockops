"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  relatorio: string;
}

export default function ReportSection({ relatorio }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(relatorio).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-6 mb-6 rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}>

      <div className="flex items-center justify-between px-6 py-3"
        style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--amber)" }} />
          <span className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--muted)" }}>
            Relatório Executivo — Gerado por IA
          </span>
        </div>
        <button onClick={copy} className="btn-ghost text-xs px-3 py-1.5 rounded">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>

      <div id="relatorio-pdf" className="px-6 py-5" style={{ background: "#ffffff", color: "#0A0A14" }}>
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <h3 className="text-sm font-semibold mt-5 mb-2 tracking-wide first:mt-0"
                style={{ color: "#D97706" }}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-sm mb-2" style={{ color: "#0A0A14", lineHeight: 1.65 }}>
                {children}
              </p>
            ),
            li: ({ children }) => (
              <li className="text-sm mb-1 ml-4" style={{ color: "#0A0A14", listStyle: "disc" }}>
                {children}
              </li>
            ),
            ul: ({ children }) => <ul className="mb-3">{children}</ul>,
            strong: ({ children }) => (
              <strong style={{ color: "#0A0A14", fontWeight: 600 }}>{children}</strong>
            ),
          }}>
          {relatorio}
        </ReactMarkdown>
      </div>
    </div>
  );
}

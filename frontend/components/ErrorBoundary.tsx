"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl px-6 py-5 mx-6 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium tracking-widest uppercase mb-1"
            style={{ color: "var(--red)" }}>
            Erro ao carregar{this.props.label ? ` — ${this.props.label}` : ""}
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Recarregue a página ou tente nova análise.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

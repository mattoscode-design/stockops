"use client";

import { useState, useCallback, useEffect } from "react";

export interface ToastMsg {
  id: string;
  text: string;
  type: "success" | "error" | "info" | "warning";
}

const ICONS = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
const COLORS = {
  success: { bg: "#F0FDF4", border: "#BBF7D0", text: "#16A34A" },
  error:   { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" },
  info:    { bg: "#EFF6FF", border: "#BFDBFE", text: "#2563EB" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706" },
};

let _push: ((msg: Omit<ToastMsg, "id">) => void) | null = null;

export function toast(text: string, type: ToastMsg["type"] = "info") {
  _push?.({ text, type });
}

export function ToastContainer() {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);

  const push = useCallback((msg: Omit<ToastMsg, "id">) => {
    const id = crypto.randomUUID();
    setMsgs(p => [...p, { ...msg, id }]);
    setTimeout(() => setMsgs(p => p.filter(m => m.id !== id)), 4000);
  }, []);

  useEffect(() => { _push = push; return () => { _push = null; }; }, [push]);

  if (msgs.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {msgs.map(m => {
        const c = COLORS[m.type];
        return (
          <div key={m.id} style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", animation: "fadeUp .25s ease", whiteSpace: "nowrap", pointerEvents: "auto" }}>
            <span style={{ fontSize: 14 }}>{ICONS[m.type]}</span>
            {m.text}
          </div>
        );
      })}
    </div>
  );
}

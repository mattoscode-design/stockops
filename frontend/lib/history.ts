import type { AnalysisResult, HistoryEntry, InventorySnapshotItem } from "@/types/analysis";

const STORAGE_KEY = "stockops_history";
const MAX_ENTRIES = 10;

function generateName(result: AnalysisResult, index: number): string {
  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const criticos = result.skus_criticos > 0 ? ` · ${result.skus_criticos} críticos` : "";
  return `Análise ${date}${criticos} #${index + 1}`;
}

export function saveToHistory(result: AnalysisResult, items_snapshot?: InventorySnapshotItem[]): HistoryEntry {
  const existing = loadHistory();
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    name: generateName(result, existing.length),
    timestamp: new Date().toLocaleString("pt-BR"),
    result,
    items_snapshot: items_snapshot && items_snapshot.length > 0 ? items_snapshot : undefined,
  };
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage cheio — remove o mais antigo e tenta de novo
    const trimmed = [entry, ...existing].slice(0, MAX_ENTRIES - 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
  return entry;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeFromHistory(id: string): void {
  const entries = loadHistory().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

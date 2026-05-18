import { Upload, Plus } from "lucide-react";

interface EmptyStateProps {
  onImportClick: () => void;
  onManualClick: () => void;
}

export default function EmptyState({ onImportClick, onManualClick }: EmptyStateProps) {
  return (
    <div style={{
      minHeight: "60vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
    }}>
      <div style={{
        maxWidth: 500,
        textAlign: "center",
      }}>
        {/* Ícone */}
        <div style={{
          marginBottom: 32,
          display: "flex",
          justifyContent: "center",
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            background: "var(--amber-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Upload style={{
              width: 40,
              height: 40,
              color: "var(--amber-signal)",
            }} />
          </div>
        </div>

        {/* Título */}
        <h2 className="heading-lg" style={{
          color: "var(--ink)",
          marginBottom: 12,
        }}>
          Nenhuma análise carregada
        </h2>

        {/* Descrição */}
        <p style={{
          fontSize: 14,
          color: "var(--muted-foreground)",
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          Importe uma planilha com seus dados de estoque ou cadastre itens manualmente para começar a análise de ruptura e receber recomendações da IA.
        </p>

        {/* Botões CTA */}
        <div style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          <button
            onClick={onImportClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              borderRadius: 8,
              background: "var(--ink)",
              color: "var(--bone)",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--amber-signal)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--ink)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--bone)";
            }}
          >
            <Upload style={{ width: 16, height: 16 }} />
            Importar Excel/CSV
          </button>

          <button
            onClick={onManualClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink)",
              border: "1px solid var(--border)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--amber-signal)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--amber-signal)";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Cadastrar manualmente
          </button>
        </div>

        {/* Dica */}
        <div style={{
          marginTop: 32,
          padding: 16,
          borderRadius: 8,
          background: "var(--bone)",
          border: "1px solid var(--border)",
        }}>
          <p style={{
            fontSize: 12,
            color: "var(--muted-foreground)",
            lineHeight: 1.5,
            fontFamily: "monospace",
          }}>
            💡 <strong>Dica:</strong> Use a aba "Importar" para análise rápida de múltiplos SKUs, ou "Cadastrar" para adicionar itens um a um.
          </p>
        </div>
      </div>
    </div>
  );
}

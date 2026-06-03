"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Shield } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type PageState = "loading" | "invalid" | "form" | "success";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [accessToken, setAccessToken] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lê o hash da URL ao montar — Supabase coloca #access_token=...&type=recovery
  useEffect(() => {
    const hash = window.location.hash.slice(1); // remove o '#'
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const type = params.get("type");

    if (token && type === "recovery") {
      setAccessToken(token);
      setPageState("form");
    } else {
      setPageState("invalid");
    }
  }, []);

  // Redireciona para home após sucesso
  useEffect(() => {
    if (pageState !== "success") return;
    const t = setTimeout(() => router.replace("/"), 2000);
    return () => clearTimeout(t);
  }, [pageState, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data?.msg === "string" ? data.msg
          : typeof data?.message === "string" ? data.message
          : "Não foi possível redefinir a senha. O link pode ter expirado.";
        setError(msg);
        return;
      }

      setPageState("success");
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const btnPrimary =
    "group mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-ink py-3.5 text-[13px] font-medium text-primary-foreground transition-all hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="grid h-7 w-7 place-items-center rounded-sm bg-ink">
            <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />
          </div>
          <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-ink">STOCKOPS</span>
        </div>

        <div className="relative rounded-2xl border border-border bg-card p-8 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--ink)_25%,transparent)]">

          {/* Estado: carregando */}
          {pageState === "loading" && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">Verificando link...</p>
            </div>
          )}

          {/* Estado: link inválido ou expirado */}
          {pageState === "invalid" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15">
                <KeyRound className="h-5 w-5 text-danger" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Link inválido ou expirado</h3>
              <p className="mt-3 max-w-xs mx-auto text-sm text-muted-foreground">
                Este link de redefinição de senha não é mais válido. Solicite um novo link.
              </p>
              <button
                onClick={() => router.replace("/")}
                className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:text-accent/80"
              >
                Voltar ao login →
              </button>
            </div>
          )}

          {/* Estado: formulário */}
          {pageState === "form" && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-ink">Redefinir senha</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escolha uma senha com pelo menos 8 caracteres.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Nova senha
                  </span>
                  <input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Confirmar nova senha
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••••"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/20"
                  />
                </label>

                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                {error && <p className="text-xs text-danger">{error}</p>}
              </form>

              <div className="mt-6 border-t border-border pt-5">
                <button
                  onClick={() => router.replace("/")}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-ink"
                >
                  ← Voltar ao login
                </button>
              </div>
            </>
          )}

          {/* Estado: sucesso */}
          {pageState === "success" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Senha redefinida com sucesso!</h3>
              <p className="mt-3 max-w-xs mx-auto text-sm text-muted-foreground">
                Redirecionando para o login...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

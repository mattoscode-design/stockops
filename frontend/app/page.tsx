"use client";

import { useEffect, useState, useRef, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  ClipboardList,
  Database,
  FolderClock,
  Gauge,
  KeyRound,
  Lock,
  MessageSquare,
  Network,
  Shield,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { setCachedProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/api";

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("acesso");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = ["acesso", "produto", "segurança", "tecnologia", "manifesto"];
    const observers = ids.map(id => {
      const element = document.getElementById(id);
      if (!element) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { threshold: 0.25, rootMargin: "-10% 0px -50% 0px" }
      );
      observer.observe(element);
      return observer;
    });
    return () => observers.forEach(observer => observer?.disconnect());
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl"
      style={{
        background: scrolled ? "rgba(252,251,249,0.96)" : "rgba(252,251,249,0.75)",
        boxShadow: scrolled ? "0 1px 40px rgba(0,0,0,0.06)" : "none",
      }}
    >
      <div className="mx-auto flex max-w-350 items-center justify-between px-6 py-4 lg:px-10">
        <a href="#" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-sm bg-ink">
            <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />
          </div>
          <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-ink">STOCKOPS</span>
        </a>
        <nav className="hidden items-center gap-10 md:flex">
          {["Produto", "Segurança", "Tecnologia", "Manifesto"].map(label => {
            const id = label.toLowerCase();
            const isActive = active === id;
            return (
              <a
                key={label}
                href={`#${id}`}
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-ink"
                style={{ color: isActive ? "var(--ink)" : "var(--muted-foreground)" }}
              >
                {label}
              </a>
            );
          })}
        </nav>
        <a href="#acesso" className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-all hover:bg-ink/90">
          Acessar plataforma
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </header>
  );
}

function Ticker() {
  const items = [
    "SKU 4781 · RUPTURA EM 3D",
    "SCORE 92 · URGENTE",
    "SP-NORTE · R$ 8.2K",
    "GEMINI FLASH ATIVO",
    "ABC RECALCULADO",
    "15 SKUs MONITORADOS",
    "MG-BH · ALERTA",
    "PERDA EVITADA R$ 28.430",
    "MODELO XGBOOST · v1.4",
  ];
  const row = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-border bg-ink py-3">
      <div className="ticker flex w-max gap-12 whitespace-nowrap">
        {row.map((item, index) => (
          <span key={index} className="flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-bone/70">
            <span className="h-1 w-1 rounded-full bg-accent" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── OTP Input — campo de 7 dígitos para o código 2FA ─────────────────────── */
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getInputs = () =>
    containerRef.current
      ? Array.from(containerRef.current.querySelectorAll<HTMLInputElement>("input"))
      : [];

  // Preenche 8 posições com os dígitos existentes (ou string vazia)
  const digits = Array.from({ length: 8 }, (_, i) => value[i] ?? "");

  function setDigit(i: number, d: string) {
    const arr = Array.from({ length: 8 }, (_, j) => value[j] ?? "");
    arr[i] = d;
    onChange(arr.join(""));
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (raw.length > 0 && !digit) return; // ignora não-numéricos
    setDigit(i, digit);
    if (digit && i < 7) getInputs()[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        setDigit(i, "");
      } else if (i > 0) {
        setDigit(i - 1, "");
        getInputs()[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      getInputs()[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 7) {
      getInputs()[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    if (pasted) {
      onChange(pasted);
      getInputs()[Math.min(pasted.length, 7)]?.focus();
    }
  }

  return (
    <div ref={containerRef} className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          autoFocus={i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.currentTarget.select()}
          className="h-14 w-10 rounded-lg border border-border bg-muted/50 text-center font-mono text-xl font-bold text-ink outline-none transition-all focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/20"
        />
      ))}
    </div>
  );
}

/* ─── AuthCard — card multi-etapa (login / 2fa / register / forgot) ─────────── */
type AuthStep = "login" | "2fa" | "register" | "forgot";

function getErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as unknown;
    if (typeof first === "string" && first.trim()) return first;
    if (first && typeof first === "object" && "msg" in first) {
      const msg = (first as { msg?: unknown }).msg;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }
  if (detail && typeof detail === "object" && "msg" in detail) {
    const msg = (detail as { msg?: unknown }).msg;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function AuthCard() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("login");

  // Campos compartilhados entre etapas
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFaCode,       setTwoFaCode]       = useState("");

  // UI state
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [registerSuccess,  setRegisterSuccess]  = useState(false);
  const [forgotSuccess,    setForgotSuccess]    = useState(false);
  const [resendCooldown,   setResendCooldown]   = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Redireciona para o dashboard se já há token válido (não expirado)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        router.replace("/dashboard");
      } else {
        localStorage.removeItem("token"); // token expirado — limpa
      }
    } catch {
      localStorage.removeItem("token"); // token malformado — limpa
    }
  }, [router]);

  // Countdown para reenvio do código 2FA
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function apiPost(path: string, body: unknown) {
    const res = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json().catch((): Record<string, any> => ({}));
    return { ok: res.ok, data };
  }

  async function prewarmProfileCache(token: string) {
    try {
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await res.json().catch((): Record<string, any> => ({}));
      const profile: UserProfile = {
        email: typeof raw.email === "string" ? raw.email : "",
        username: typeof raw.username === "string" ? raw.username : null,
        nome_exibicao: typeof raw.nome_exibicao === "string" ? raw.nome_exibicao : null,
        tipo_perfil: typeof raw.tipo_perfil === "string" ? raw.tipo_perfil : null,
        empresa_nome: typeof raw.empresa_nome === "string" ? raw.empresa_nome : null,
      };
      if (profile.email) setCachedProfile(profile);
    } catch {
      // best-effort cache warmup
    }
  }

  /* ── Login ──────────────────────────────────────────────────────────────── */
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { ok, data } = await apiPost("/auth/login", { email, password });
      if (!ok) {
        setError(getErrorMessage(data?.detail, "Usuário ou senha incorretos."));
        return;
      }
      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        void prewarmProfileCache(data.access_token);
        router.replace("/dashboard");
      } else {
        // Backend atual envia OTP por email e a validação acontece na etapa 2FA.
        setStep("2fa");
        setTwoFaCode("");
        setResendCooldown(60);
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Esqueceu a senha ───────────────────────────────────────────────────── */
  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { ok, data } = await apiPost("/auth/forgot-password", { email });
      if (!ok) {
        setError(getErrorMessage(data?.detail, "Não foi possível enviar o link. Tente novamente."));
        return;
      }
      setForgotSuccess(true);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Verificar código 2FA ────────────────────────────────────────────────── */
  async function handleVerify2FA(e: FormEvent) {
    e.preventDefault();
    const code = twoFaCode.replace(/\D/g, "");
    if (code.length !== 8) { setError("Insira os 8 dígitos do código."); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      const { ok, data } = await apiPost("/auth/verify", { email, token: code });
      if (!ok) {
        setError(getErrorMessage(data?.detail, "Código inválido ou expirado."));
        return;
      }
      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        void prewarmProfileCache(data.access_token);
        router.replace("/dashboard");
      }
    } catch {
      setError("Erro ao verificar código.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Reenviar código 2FA ─────────────────────────────────────────────────── */
  async function handleResend2FA() {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await apiPost("/auth/login", { email, password });
      setResendCooldown(60);
    } catch {
      setError("Erro ao reenviar código.");
    }
  }

  /* ── Cadastro ────────────────────────────────────────────────────────────── */
  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { ok, data } = await apiPost("/auth/register", {
        email,
        password,
        tenant_id: "default",
      });
      if (!ok) {
        setError(getErrorMessage(data?.detail, "Erro ao criar conta. Tente novamente."));
        return;
      }
      setRegisterSuccess(true);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function goToLogin() {
    setStep("login");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setTwoFaCode("");
    setRegisterSuccess(false);
    setForgotSuccess(false);
  }

  function goToRegister() {
    setStep("register");
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  const btnPrimary =
    "group mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-ink py-3.5 text-[13px] font-medium text-primary-foreground transition-all hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="relative rounded-2xl border border-border bg-card p-8 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--ink)_25%,transparent)]">

      {/* ── Etapa: Login ──────────────────────────────────────────────────── */}
      {step === "login" && (
        <>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Acessar plataforma</h3>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> online
            </span>
          </div>
          <p className="mb-7 text-xs text-muted-foreground">Use o email da sua conta StockOps</p>

          <form className="space-y-5" onSubmit={handleLogin}>
            <Field
              label="Email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              label="Senha"
              placeholder="••••••••••"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />

            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? "Entrando..." : "Entrar na plataforma"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            {error && <p className="text-xs text-danger">{error}</p>}
          </form>

          <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
            <button
              onClick={goToRegister}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent transition-colors hover:text-accent/80"
            >
              Criar conta
            </button>
            <button
              type="button"
              onClick={() => { setStep("forgot"); setError(null); setForgotSuccess(false); }}
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-ink"
            >
              Esqueceu sua senha?
            </button>
          </div>

          {/* Floating decoratives */}
          <div className="absolute -right-4 -bottom-4 hidden rotate-3 rounded-lg border border-border bg-card px-3 py-2 shadow-lg lg:flex lg:items-center lg:gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-danger" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink">Ruptura · 3d</span>
          </div>
        </>
      )}

      {/* ── Etapa: 2FA ────────────────────────────────────────────────────── */}
      {step === "2fa" && (
        <>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
              <KeyRound className="h-5 w-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-ink">Verificação em 2 etapas</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Enviamos um código para{" "}
              <span className="font-mono font-semibold text-ink">{email}</span>
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleVerify2FA}>
            <OtpInput value={twoFaCode} onChange={setTwoFaCode} />

            <button
              type="submit"
              disabled={isSubmitting || twoFaCode.replace(/\D/g, "").length !== 8}
              className={btnPrimary}
            >
              {isSubmitting ? "Verificando..." : "Verificar código"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            {error && <p className="text-center text-xs text-danger">{error}</p>}
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-5 text-xs">
            <button
              onClick={goToLogin}
              className="font-mono tracking-[0.12em] text-muted-foreground transition-colors hover:text-ink"
            >
              ← Voltar
            </button>
            <button
              onClick={handleResend2FA}
              disabled={resendCooldown > 0}
              className="font-mono tracking-[0.12em] text-accent transition-colors hover:text-accent/80 disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
            </button>
          </div>
        </>
      )}

      {/* ── Etapa: Cadastro ───────────────────────────────────────────────── */}
      {step === "register" && (
        <>
          {registerSuccess ? (
            /* Confirmação pós-cadastro */
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Quase lá!</h3>
              <p className="mt-3 max-w-xs mx-auto text-sm text-muted-foreground">
                Verifique seu email para confirmar o cadastro antes de acessar a plataforma.
              </p>
              <p className="mt-1 font-mono text-xs text-accent">{email}</p>
              <button
                onClick={goToLogin}
                className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:text-accent/80"
              >
                Ir para o login →
              </button>
            </div>
          ) : (
            /* Formulário de cadastro */
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-ink">Criar conta</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Plataforma de gestão de estoque com IA
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleRegister}>
                <Field
                  label="Email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                />
                <Field
                  label="Senha"
                  placeholder="Mínimo 6 caracteres"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <Field
                  label="Confirmar senha"
                  placeholder="••••••••••"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                />

                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? "Criando conta..." : "Criar conta"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                {error && <p className="text-xs text-danger">{error}</p>}
              </form>

              <div className="mt-6 border-t border-border pt-5">
                <button
                  onClick={goToLogin}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-ink"
                >
                  ← Já tenho conta
                </button>
              </div>
            </>
          )}
        </>
      )}
      {/* ── Etapa: Esqueceu a senha ──────────────────────────────────────────── */}
      {step === "forgot" && (
        <>
          {forgotSuccess ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                <Shield className="h-5 w-5 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Verifique seu email</h3>
              <p className="mt-3 max-w-xs mx-auto text-sm text-muted-foreground">
                Enviamos um link para redefinir sua senha.
              </p>
              <p className="mt-1 font-mono text-xs text-accent">{email}</p>
              <button
                onClick={goToLogin}
                className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:text-accent/80"
              >
                Voltar ao login →
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-ink">Redefinir senha</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Informe seu email para receber o link de redefinição.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleForgotPassword}>
                <Field
                  label="Email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                />

                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>

                {error && <p className="text-xs text-danger">{error}</p>}
              </form>

              <div className="mt-6 border-t border-border pt-5">
                <button
                  onClick={goToLogin}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-ink"
                >
                  ← Voltar ao login
                </button>
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section id="acesso" className="relative overflow-hidden border-b border-border">
      <div className="grid-bg absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-350 gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:px-10 lg:pt-28">
        <div className="flex flex-col">
          <div className="mb-10 flex items-center gap-3">
            <span className="h-px w-10 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">IA Operacional · Varejo</span>
          </div>

          <h1 className="text-[clamp(3rem,7vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-ink">
            Previna a perda<br />
            <span className="font-serif text-accent">antes</span> que ela{" "}
            <span className="relative inline-block">
              aconteça
              <svg className="absolute -bottom-2 left-0 h-3 w-full" viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M0,8 Q50,2 100,6 T200,4" stroke="currentColor" strokeWidth="2" fill="none" className="text-accent" />
              </svg>
            </span>
            .
          </h1>

          <p className="mt-10 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Inteligência preditiva que detecta ruptura de estoque, analisa anomalias e entrega decisões em linguagem de negócio — em segundos, não em planilhas.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a href="#produto" className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[13px] font-medium text-primary-foreground transition-all hover:bg-ink/90">
              Ver demonstração
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a href="#tecnologia" className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-6 py-3.5 text-[13px] font-medium text-ink transition-all hover:border-ink hover:bg-ink hover:text-primary-foreground">
              Conhecer o stack
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-6 border-t border-border pt-8">
            {[
              { k: "R$ 36,5bi", v: "perdidos/ano no varejo BR", tone: "ink" },
              { k: "7,81%", v: "taxa média de ruptura", tone: "accent" },
              { k: "R$ 0,00", v: "custo de infraestrutura", tone: "success" },
            ].map(stat => (
              <div key={stat.k}>
                <div className={`font-mono text-2xl font-semibold tracking-tight ${stat.tone === "accent" ? "text-accent" : stat.tone === "success" ? "text-success" : "text-ink"}`}>
                  {stat.k}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{stat.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Auth card column */}
        <div className="relative lg:pt-4">
          <div className="absolute -inset-4 -z-10 rounded-3xl blur-2xl" style={{ background: "color-mix(in oklab, var(--amber-soft) 40%, transparent)" }} />
          <AuthCard />
          <div className="absolute -left-6 top-4 hidden rotate-[-4deg] rounded-lg border border-border bg-card px-3 py-2 shadow-lg lg:flex lg:items-center lg:gap-2">
            <Activity className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink">Score 92</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Field ─────────────────────────────────────────────────────────────────── */
function Field({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange?.(event.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

function OverviewSection() {
  const pillars = [
    { icon: Activity, kicker: "01 — Detectar", title: "Score de ruptura por SKU", desc: "Cobertura, tendência, abastecimento e sazonalidade combinados em um índice de 0 a 100 — atualizado a cada análise." },
    { icon: Bot, kicker: "02 — Decidir", title: "Relatório executivo em linguagem de negócio", desc: "Uma chamada ao Gemini Flash transforma seus dados em riscos, recomendações e plano para os próximos 7 dias." },
    { icon: TrendingDown, kicker: "03 — Agir", title: "Curva ABC priorizada por perda", desc: "Pareto aplicado ao impacto financeiro real. A IA mostra onde cada hora investida devolve mais dinheiro." },
  ] satisfies Array<{ icon: LucideIcon; kicker: string; title: string; desc: string }>;

  return (
    <section className="border-b border-border bg-background py-24">
      <div className="mx-auto max-w-350 px-6 lg:px-10">
        <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionLabel>Resumo</SectionLabel>
            <h2 className="mt-6 text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-none tracking-[-0.035em] text-ink">
              Uma plataforma. <span className="font-serif text-accent">Três movimentos</span>{" "}
              que substituem semanas de planilha.
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            StockOps lê seu estoque, identifica os SKUs em risco e entrega a decisão pronta —
            sem dashboards para interpretar, sem fórmulas para manter. Você sobe o dado, a IA
            devolve o plano.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {pillars.map(pillar => (
            <div key={pillar.title} className="group relative bg-card p-8 transition-colors hover:bg-bone">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">{pillar.kicker}</span>
                <pillar.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-ink" />
              </div>
              <h3 className="mt-8 text-[20px] font-semibold leading-tight tracking-tight text-ink">{pillar.title}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{pillar.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="h-px w-8 bg-accent" />
            do upload ao plano em menos de 60 segundos
          </span>
          <a href="#produto" className="group inline-flex items-center gap-2 text-ink hover:text-accent">
            Ver o produto em detalhe
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="produto" className="border-b border-border bg-bone py-28">
      <div className="mx-auto max-w-350 px-6 lg:px-10">
        <SectionLabel>Produto</SectionLabel>
        <div className="mt-6 grid items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <h2 className="text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-ink">
            Do dado à <span className="font-serif text-accent">decisão</span><br />em segundos.
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Suba sua planilha ou cadastre o estoque diretamente. A IA detecta, prevê e recomenda — sem você abrir um único gráfico no Excel.
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border border-ink/10 bg-ink shadow-[0_50px_120px_-40px_color-mix(in_oklab,var(--ink)_50%,transparent)]">
          <div className="flex items-center justify-between border-b border-bone/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-danger/80" />
              <span className="h-3 w-3 rounded-full bg-accent/80" />
              <span className="h-3 w-3 rounded-full bg-success/80" />
            </div>
            <span className="font-mono text-[11px] tracking-[0.18em] text-bone/40">stockops — painel operacional</span>
            <span className="font-mono text-[11px] text-bone/40">v1.0</span>
          </div>

          <div className="flex gap-7 border-b border-bone/10 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em]">
            <span className="border-b-2 border-accent pb-2 text-bone">Painel</span>
            <span className="flex items-center gap-2 text-bone/50">Ranking <span className="rounded bg-danger/80 px-1.5 text-[9px] text-bone">4</span></span>
            <span className="text-bone/50">Relatório IA</span>
            <span className="text-bone/50">Importar</span>
            <span className="text-bone/50">Manual</span>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3">
            <KPI label="SKUs Analisados" value="15" />
            <KPI label="SKUs Críticos" value="4" tone="danger" />
            <KPI label="Perda Total Est." value="R$ 28.430" tone="danger" />
          </div>

          <div className="grid gap-4 px-6 pb-6 md:grid-cols-[0.9fr_1.4fr]">
            <div className="rounded-xl border border-bone/10 bg-bone/2 p-5">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50">Distribuição</div>
              <div className="flex items-center gap-6">
                <Donut />
                <div className="space-y-2 font-mono text-[11px] text-bone/80">
                  <Legend color="var(--danger)" label="Urgente" value="2" />
                  <Legend color="var(--amber-signal)" label="Ação Rec." value="2" />
                  <Legend color="oklch(0.78 0.14 85)" label="Alerta" value="3" />
                  <Legend color="var(--success)" label="Monitor." value="8" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-bone/10 bg-bone/2 p-5">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50">Top SKUs — Perda estimada</div>
              <div className="space-y-3">
                {[
                  ["Energético 473ml", "R$ 8.2k", 95, "var(--danger)"],
                  ["Água Mineral 500ml", "R$ 6.1k", 75, "var(--danger)"],
                  ["Isotônico 500ml", "R$ 5.8k", 70, "var(--amber-signal)"],
                  ["Achocolatado 200ml", "R$ 4.2k", 55, "var(--amber-signal)"],
                ].map(([name, value, width, color]) => (
                  <div key={name as string} className="flex items-center gap-4">
                    <span className="w-44 truncate text-[12px] text-bone/80">{name}</span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-bone/10">
                        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color as string }} />
                      </div>
                    </div>
                    <span className="w-16 text-right font-mono text-[11px] text-bone/70">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-bone/10">
            <div className="grid grid-cols-[2fr_1fr_0.6fr_0.6fr_0.9fr_0.9fr] gap-4 border-b border-bone/10 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-bone/40">
              <span>SKU</span><span>Loja</span><span>ABC</span><span>Score</span><span>Status</span><span className="text-right">Perda</span>
            </div>
            {[
              ["Energético 473ml", "SP-Norte", "A", "92", "Urgente", "R$ 8.200", "var(--danger)"],
              ["Água Mineral 500ml", "MG-BH", "A", "88", "Urgente", "R$ 6.100", "var(--danger)"],
              ["Isotônico 500ml", "RJ-Barra", "A", "79", "Ação Rec.", "R$ 5.800", "var(--amber-signal)"],
            ].map(row => (
              <div key={row[0]} className="grid grid-cols-[2fr_1fr_0.6fr_0.6fr_0.9fr_0.9fr] items-center gap-4 border-b border-bone/6 px-6 py-4 text-[13px] text-bone/90 last:border-0">
                <span className="font-medium">{row[0]}</span>
                <span className="text-bone/60">{row[1]}</span>
                <span><span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-[10px] text-accent">{row[2]}</span></span>
                <span className="font-mono font-semibold" style={{ color: row[6] as string }}>{row[3]}</span>
                <span><span className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ background: `color-mix(in oklab, ${row[6]} 20%, transparent)`, color: row[6] as string }}>{row[4]}</span></span>
                <span className="text-right font-mono">{row[5]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {[
            { icon: Zap, title: "Score de Ruptura 0–100", desc: "4 variáveis ponderadas: cobertura, tendência, abastecimento e sazonalidade. Calculado por SKU automaticamente." },
            { icon: Bot, title: "Relatório Executivo IA", desc: "Uma chamada ao Gemini Flash gera relatório completo: riscos, recomendações e próximos 7 dias em linguagem de negócio." },
            { icon: BarChart3, title: "Curva ABC Automática", desc: "Pareto aplicado à perda estimada. A = 80% do impacto. Prioriza exatamente onde agir primeiro." },
            { icon: MessageSquare, title: "Assistente Operacional", desc: "Chatbot restrito ao domínio de estoque com perguntas guiadas por categoria. Sem fuga de contexto." },
            { icon: ClipboardList, title: "Entrada Sem Excel", desc: "Cadastre o estoque diretamente no site por uma tabela editável. Sem precisar de planilha." },
            { icon: FolderClock, title: "Histórico de Análises", desc: "10 últimas análises salvas no navegador. Compare a evolução semana a semana sem esforço." },
          ].map(feature => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-bone/10 bg-bone/2 p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/40">{label}</div>
      <div className={`mt-3 font-mono text-3xl font-semibold tracking-tight ${tone === "danger" ? "text-danger" : "text-bone"}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
      <span className="ml-auto text-bone/50">{value}</span>
    </div>
  );
}

function Donut() {
  return (
    <svg width="110" height="110" viewBox="0 0 42 42" className="-rotate-90">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="oklch(0.2 0.005 80)" strokeWidth="6" />
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="var(--danger)" strokeWidth="6" strokeDasharray="14 86" strokeDashoffset="0" />
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="var(--amber-signal)" strokeWidth="6" strokeDasharray="14 86" strokeDashoffset="-14" />
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="oklch(0.78 0.14 85)" strokeWidth="6" strokeDasharray="20 80" strokeDashoffset="-28" />
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="var(--success)" strokeWidth="6" strokeDasharray="52 48" strokeDashoffset="-48" />
    </svg>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="group relative bg-card p-8 transition-colors hover:bg-bone">
      <div className="mb-6 grid h-10 w-10 place-items-center rounded-lg bg-ink/5 text-ink transition-colors group-hover:bg-accent group-hover:text-ink">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
      <ArrowUpRight className="absolute right-6 top-6 h-4 w-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
    </div>
  );
}

function SecuritySection() {
  const layers = [
    { icon: KeyRound, title: "Crachá digital", desc: "Como um crachá que expira em 1 hora.", tag: "JWT · HS256 · 60min" },
    { icon: Lock, title: "Senha embaralhada", desc: "Nunca armazenada como texto. Sempre embaralhada.", tag: "bcrypt · passlib" },
    { icon: Gauge, title: "Limite de tentativas", desc: "Como um semáforo: chamadas seguidas e ele bloqueia.", tag: "Rate limit · 30 req/min" },
    { icon: Shield, title: "Porta com lista", desc: "Só entra quem está na lista. Nenhum domínio desconhecido.", tag: "CORS · domínio restrito" },
    { icon: Sparkles, title: "Dados verificados", desc: "Tudo que chega é checado antes de entrar. Sem lixo.", tag: "Pydantic validation" },
    { icon: Database, title: "Banco blindado", desc: "Ninguém injeta comandos maliciosos no banco.", tag: "SQLAlchemy ORM" },
    { icon: Lock, title: "Segredos escondidos", desc: "Chaves de API ficam fora do código. Nem o GitHub vê.", tag: ".env + .gitignore" },
    { icon: Network, title: "Conexão criptografada", desc: "Tudo que viaja na internet vai criptografado.", tag: "HTTPS · TLS" },
  ] satisfies Array<{ icon: LucideIcon; title: string; desc: string; tag: string }>;

  return (
    <section id="segurança" className="border-b border-border bg-background py-28">
      <div className="mx-auto max-w-350 px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel center>Segurança</SectionLabel>
          <h2 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-ink">
            Seus dados estão{" "}
            <span className="font-serif text-success">completamente protegidos.</span>
          </h2>
          <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
            Pense num prédio corporativo: crachá, catracas, câmeras — e ninguém de fora entra sem autorização. Aqui é a mesma lógica, em 8 camadas.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {layers.map(layer => (
            <div key={layer.title} className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-ink/30 hover:shadow-lg">
              <layer.icon className="mb-5 h-5 w-5 text-ink" />
              <h3 className="mb-2 text-[15px] font-semibold tracking-tight text-ink">{layer.title}</h3>
              <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">{layer.desc}</p>
              <span className="inline-block rounded border border-border bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{layer.tag}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-success/30 bg-success/5 p-6">
          <p className="max-w-xl text-[14px] text-ink">Em resumo: seus dados operacionais estão tão seguros quanto os de um banco digital.</p>
          <div className="flex gap-8">
            {[ ["8", "camadas ativas"], ["R$ 0", "custo de segurança"], ["100%", "open source"] ].map(([value, label]) => (
              <div key={label}>
                <div className="font-mono text-2xl font-semibold text-success">{value}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StackSection() {
  const stack = [
    { layer: "Interface", desc: "O que o usuário vê e usa", items: [["Next.js 16", "Páginas e rotas"], ["Tailwind 4", "Estilos e layout"], ["Recharts", "Gráficos interativos"], ["lottie-react", "Animações"]], accent: "oklch(0.7 0.12 230)" },
    { layer: "Inteligência", desc: "A IA que processa e raciocina", items: [["Gemini Flash", "Relatório executivo"], ["Scikit-learn", "Score de ruptura"], ["XGBoost", "Previsão de ruptura"], ["Prophet", "Sazonalidade"]], accent: "oklch(0.65 0.18 300)" },
    { layer: "Processamento", desc: "Motor que transforma planilha em análise", items: [["FastAPI", "API REST"], ["Python 3.12", "Linguagem principal"], ["Pandas", "Lê e processa"]], accent: "var(--amber-signal)" },
    { layer: "Dados", desc: "Onde as informações ficam guardadas", items: [["SQLite", "MVP e demos"], ["Supabase", "PostgreSQL produção"]], accent: "var(--success)" },
    { layer: "Infraestrutura", desc: "Onde tudo roda — gratuito e automático", items: [["Vercel", "Deploy frontend"], ["Render", "Deploy backend"], ["GitHub", "CI/CD versionado"]], accent: "oklch(0.5 0.01 80)" },
  ] satisfies Array<{ layer: string; desc: string; items: [string, string][]; accent: string }>;

  return (
    <section id="tecnologia" className="border-b border-border bg-bone py-28">
      <div className="mx-auto max-w-350 px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel center>Tecnologia</SectionLabel>
          <h2 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-ink">
            Stack completo.<br />
            <span className="font-serif text-success">Custo: R$ 0,00.</span>
          </h2>
          <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
            Open source ou plano gratuito robusto em cada camada. Sem dívida operacional escondida.
          </p>
        </div>

        <div className="mt-16 space-y-3">
          {stack.map(stackItem => (
            <div key={stackItem.layer} className="grid items-center gap-6 rounded-xl border border-border bg-card p-6 md:grid-cols-[260px_1fr_auto]">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: stackItem.accent }}>{stackItem.layer}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">{stackItem.desc}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {stackItem.items.map(([name, description]) => (
                  <div key={name} className="rounded-lg border border-border bg-background px-3.5 py-2.5 transition-colors hover:border-ink/30">
                    <div className="text-[13px] font-semibold text-ink">{name}</div>
                    <div className="text-[11px] text-muted-foreground">{description}</div>
                  </div>
                ))}
              </div>
              <span className="h-2 w-2 rounded-full" style={{ background: stackItem.accent }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section id="manifesto" className="relative overflow-hidden bg-background py-28">
      <div className="mx-auto max-w-350 px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl bg-ink p-16 lg:p-24">
          <div className="grid-bg absolute inset-0 opacity-[0.04]" />
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <div className="mb-8 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Manifesto operacional</span>
            </div>
            <h2 className="text-[clamp(2.75rem,6vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-bone">
              Pare de reagir.<br />
              <span className="font-serif text-accent">Comece</span> a prever.
            </h2>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-bone/60">
              Transforme operações reativas em inteligência preditiva. A ruptura já está no seu histórico — basta deixar o modelo ler.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#acesso" className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-[14px] font-semibold text-ink transition-all hover:bg-accent/90">
                Acessar plataforma
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#produto" className="inline-flex items-center gap-2 rounded-full border border-bone/20 px-7 py-4 text-[14px] font-medium text-bone transition-all hover:border-bone/40 hover:bg-bone/5">
                Ver demonstração
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-bone py-10">
      <div className="mx-auto flex max-w-350 flex-wrap items-center justify-between gap-4 px-6 lg:px-10">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-accent pulse-dot" />
          StockOps · IA Operacional · v1.0
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Stack 100% gratuita · Open source
        </div>
      </div>
    </footer>
  );
}

function SectionLabel({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${center ? "justify-center" : ""}`}>
      <span className="h-px w-10 bg-accent" />
      <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">{children}</span>
      <span className="h-px w-10 bg-accent" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <Nav />
      <Hero />
      <Ticker />
      <OverviewSection />
      <ProductSection />
      <SecuritySection />
      <StackSection />
      <CTASection />
      <Footer />
    </div>
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const c = {
      cyan:  "\x1b[96m",
      amber: "\x1b[93m",
      green: "\x1b[92m",
      dim:   "\x1b[2m",
      reset: "\x1b[0m",
    };

    console.log(`\n${c.amber}${"═".repeat(60)}${c.reset}`);
    console.log(`${c.amber}  STOCKOPS FRONTEND — Next.js 16 · React 19 · Tailwind 4${c.reset}`);
    console.log(`${c.amber}${"═".repeat(60)}${c.reset}\n`);

    console.log(`${c.cyan}  PÁGINAS${c.reset}`);
    const pages = [
      ["/",          "app/page.tsx",            "handleLogin(e)       → POST /auth/login, salva JWT, redireciona"],
      ["/dashboard", "app/dashboard/page.tsx",  "reset()              → limpa resultado e volta ao upload"],
    ];
    for (const [route, file, desc] of pages) {
      console.log(`  ${c.dim}→${c.reset} ${route.padEnd(14)}${c.dim}${file.padEnd(28)}${c.reset}${desc}`);
    }

    console.log(`\n${c.cyan}  COMPONENTES${c.reset}`);
    const comps = [
      ["Navbar.tsx",        "logout()             → remove token e redireciona para login"],
      ["UploadZone.tsx",    "upload(file)         → valida tipo/tamanho, POST /analysis/upload"],
      ["UploadZone.tsx",    "onDragOver/onDrop    → handlers drag & drop"],
      ["SummaryCards.tsx",  "(puro)               → exibe totalSkus, skusCriticos, perdaTotal"],
      ["RiskTable.tsx",     "scoreColor(score)    → cor CSS por faixa de risco"],
      ["RiskTable.tsx",     "classTag(cls)        → cor do badge por classificação"],
      ["RiskTable.tsx",     "toggle(key)          → expande linha para exibir insight da IA"],
    ];
    for (const [comp, desc] of comps) {
      console.log(`  ${c.dim}→${c.reset} ${comp.padEnd(20)}${desc}`);
    }

    console.log(`\n${c.cyan}  DESIGN SYSTEM — globals.css${c.reset}`);
    const tokens = [
      ["--bg",        "#0A0A0A",  "Fundo principal"],
      ["--surface",   "#111111",  "Cards e superfícies"],
      ["--amber",     "#F5A623",  "Acento principal"],
      ["--red",       "#E05252",  "Status urgente"],
      ["--green",     "#3DB87A",  "Status estável"],
      ["--muted",     "#666666",  "Texto secundário"],
    ];
    for (const [token, value, desc] of tokens) {
      console.log(`  ${c.dim}→${c.reset} ${token.padEnd(16)}${c.amber}${value.padEnd(12)}${c.reset}${c.dim}${desc}${c.reset}`);
    }

    console.log(`\n${c.green}  Frontend rodando → http://localhost:3000${c.reset}`);
    console.log(`${c.amber}${"═".repeat(60)}${c.reset}\n`);
  }
}

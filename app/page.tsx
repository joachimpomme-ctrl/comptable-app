import Link from "next/link";

const AGENTS = [
  {
    code: "01",
    name: "Orchestrateur",
    model: "Gemini 2.5 Flash",
    role: "Classifie chaque requête (domaine, criticité, besoin de calcul) en <1 s.",
    color: "bg-[#0F2A47]",
  },
  {
    code: "02",
    name: "Gem cloné",
    model: "Gemini 2.5 Flash + KB cachée",
    role: "Reproduit le Gem Gemini via API. 10 fichiers KB en explicit cache.",
    color: "bg-[#D4A574]",
  },
  {
    code: "03",
    name: "Calculateur",
    model: "TypeScript pur",
    role: "FORM-001 (amort 39-C), FORM-002 (PV LMNP 2025). Zéro hallucination.",
    color: "bg-[#3B82F6]",
  },
  {
    code: "04",
    name: "Reviewer",
    model: "Gemini 2.5 Pro",
    role: "Challenge la réponse du Gem. Verdict + écarts + score de confiance.",
    color: "bg-[#0F2A47]",
  },
  {
    code: "QG",
    name: "Quality Gate",
    model: "TypeScript pur",
    role: "Vérifie citations CGI, format, millésimes, statuts. Annotations.",
    color: "bg-[#10B981]",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] font-bold tracking-[2px] text-[#D4A574]">
              COMPTA
            </span>
            <h1 className="text-lg font-bold text-[#0F2A47]">
              Multi-Agents
            </h1>
            <span className="text-xs text-zinc-500">v0.1 · MVP LMNP</span>
          </div>
          <Link
            href="/ask"
            className="text-sm font-medium text-[#0F2A47] hover:text-[#3B82F6]"
          >
            Lancer une requête →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#0F2A47] text-white">
        <div className="max-w-6xl mx-auto px-8 py-20">
          <div className="text-[10px] font-bold tracking-[2px] text-[#D4A574] mb-3">
            ÉCOSYSTÈME EN COURS DE CONSTRUCTION
          </div>
          <div className="w-12 h-[3px] bg-[#D4A574] mb-6"></div>
          <h2 className="text-5xl font-bold leading-tight mb-4">
            Assistant comptable
            <br />
            multi-agents
          </h2>
          <p className="text-lg text-zinc-300 max-w-2xl">
            Cinq spécialistes orbitent autour du Gem comptable — orchestrateur,
            calculateur déterministe, reviewer, quality gate — pour fiabiliser
            chaque réponse fiscale, patrimoniale ou comptable.
          </p>
        </div>
      </section>

      {/* Agents */}
      <section className="flex-1 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-[10px] font-bold tracking-[2px] text-zinc-500 mb-2">
            § ARCHITECTURE
          </div>
          <h3 className="text-2xl font-bold text-[#0F2A47] mb-2">
            Les agents
          </h3>
          <p className="text-sm text-zinc-600 mb-10 max-w-2xl">
            Le Gem actuel (gemini.google.com) reste intouché. Les agents
            ci-dessous orbitent autour, sans modifier ni dépendre de son
            comportement interne.
          </p>

          <div className="grid gap-3">
            {AGENTS.map((a) => (
              <div
                key={a.code}
                className="bg-white border border-zinc-200 rounded-lg p-5 flex items-center gap-5 hover:shadow-md transition-shadow"
              >
                <div
                  className={`${a.color} text-white w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold text-sm`}
                >
                  {a.code}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-bold text-[#0F2A47]">{a.name}</span>
                    <span className="text-xs font-mono text-zinc-500">
                      {a.model}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600">{a.role}</p>
                </div>
                <div className="text-xs font-bold text-zinc-400">
                  ○ pending
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#0A1C2F] text-zinc-400 py-6">
        <div className="max-w-6xl mx-auto px-8 text-xs flex justify-between items-center">
          <span>
            <span className="text-[#D4A574] font-bold">COMPTA MULTI-AGENTS</span>{" "}
            · Mai 2026
          </span>
          <span className="font-mono">Next.js 16 · Gemini · Vercel</span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PipelineStep } from "@/lib/types";

type StepState = {
  orchestrator?: Extract<PipelineStep, { kind: "orchestrator" }>;
  gem?: Extract<PipelineStep, { kind: "gem" }>;
  calculator?: Extract<PipelineStep, { kind: "calculator" }>;
  reviewer?: Extract<PipelineStep, { kind: "reviewer" }>;
  qualityGate?: Extract<PipelineStep, { kind: "quality-gate" }>;
  final?: Extract<PipelineStep, { kind: "final" }>;
  errors: Extract<PipelineStep, { kind: "error" }>[];
};

const EMPTY: StepState = { errors: [] };

const SAMPLE_QUESTIONS = [
  "J'ai vendu un appartement LMNP acquis en 2015 pour 220 000 €, revendu 320 000 € en 2026. Amortissements déduits : 45 000 €. Calcule la PV imposable.",
  "Quel est le seuil micro-BIC LMNP en 2025 ?",
  "Pour une SCI à l'IR, l'option pour l'IS est-elle réversible ?",
];

function Pill({
  color = "navy",
  children,
}: {
  color?: "navy" | "gold" | "blue" | "green" | "amber" | "red" | "purple";
  children: React.ReactNode;
}) {
  const map = {
    navy: "bg-[#0F2A47] text-white",
    gold: "bg-[#D4A574] text-white",
    blue: "bg-[#3B82F6] text-white",
    green: "bg-[#10B981] text-white",
    amber: "bg-[#F59E0B] text-white",
    red: "bg-[#EF4444] text-white",
    purple: "bg-[#8B5CF6] text-white",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${map[color]}`}
    >
      {children}
    </span>
  );
}

function TraceItem({
  index,
  title,
  model,
  latency,
  done,
  pending,
  children,
}: {
  index: string;
  title: string;
  model?: string;
  latency?: number;
  done?: boolean;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-zinc-200 pl-4 pb-4 relative">
      <div
        className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${
          done ? "bg-[#10B981]" : pending ? "bg-zinc-300 animate-pulse" : "bg-zinc-300"
        }`}
      />
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-mono text-[10px] text-zinc-400">{index}</span>
        <span className="font-bold text-xs text-[#0F2A47]">{title}</span>
        {latency !== undefined && (
          <span className="text-[10px] text-zinc-500 ml-auto font-mono">
            {(latency / 1000).toFixed(2)}s
          </span>
        )}
      </div>
      {model && (
        <div className="text-[10px] text-zinc-500 font-mono mb-1">{model}</div>
      )}
      {children}
    </div>
  );
}

function FormattedResponse({ text }: { text: string }) {
  // Split into paragraphs, render simply with line-breaks preserved.
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="prose prose-sm max-w-none text-zinc-800 leading-relaxed whitespace-pre-wrap">
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-3 last:mb-0">
          {p}
        </p>
      ))}
    </div>
  );
}

export function AskClient() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<StepState>(EMPTY);
  const [showTrace, setShowTrace] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const onAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || isLoading) return;
    setState({ errors: [] });
    setIsLoading(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.text();
        setState((s) => ({
          ...s,
          errors: [...s.errors, { kind: "error", stage: "http", message: body || `HTTP ${res.status}` }],
        }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let step: PipelineStep;
          try {
            step = JSON.parse(line) as PipelineStep;
          } catch {
            continue;
          }
          setState((prev) => updateState(prev, step));
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        errors: [
          ...s.errors,
          {
            kind: "error",
            stage: "client",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  }, [question, isLoading]);

  const onReset = useCallback(() => {
    abortRef.current?.abort();
    setQuestion("");
    setState(EMPTY);
    setIsLoading(false);
  }, []);

  const summary = useMemo(() => buildSummary(state), [state]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-3 group">
            <span className="text-[10px] font-bold tracking-[2px] text-[#D4A574]">
              COMPTA
            </span>
            <span className="font-bold text-[#0F2A47] group-hover:text-[#3B82F6]">
              Multi-Agents
            </span>
            <span className="text-xs text-zinc-500">v0.1 · MVP LMNP</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {summary.progress && (
              <span className="text-xs font-mono text-zinc-500">
                {summary.completedSteps} / {summary.totalSteps}
              </span>
            )}
            <button
              onClick={() => setShowTrace((v) => !v)}
              className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-100"
              type="button"
            >
              {showTrace ? "Masquer la trace" : "Afficher la trace"}
            </button>
            <button
              onClick={onReset}
              className="text-xs px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-100"
              type="button"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        <div
          className={`grid gap-6 ${
            showTrace ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1"
          }`}
        >
          {/* === LEFT — Question + Response === */}
          <section className="space-y-6 min-w-0">
            <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
              <label
                htmlFor="question"
                className="text-[10px] font-bold tracking-[1.5px] text-zinc-500 uppercase"
              >
                Posez votre question
              </label>
              <textarea
                id="question"
                className="mt-2 w-full min-h-[100px] p-3 text-sm border border-zinc-300 rounded font-sans focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent resize-y disabled:bg-zinc-50"
                placeholder="Ex. : J'ai vendu un appartement LMNP acquis 2015 220k€ revendu 320k€, amort. déduits 45k€. Calcule la PV."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onAsk();
                  }
                }}
              />
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button
                  onClick={onAsk}
                  disabled={!question.trim() || isLoading}
                  className="px-5 py-2 bg-[#0F2A47] text-white text-sm rounded font-medium hover:bg-[#0A1C2F] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Pipeline en cours..." : "Lancer (⌘↵)"}
                </button>
                {!isLoading && !state.final && (
                  <div className="text-[11px] text-zinc-500 flex gap-2 flex-wrap">
                    <span className="text-zinc-400">Exemples :</span>
                    {SAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuestion(q)}
                        className="text-[#3B82F6] hover:underline text-left"
                      >
                        {q.length > 50 ? q.slice(0, 50) + "…" : q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Final response card */}
            {(state.gem || state.final || isLoading) && (
              <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-100">
                  {summary.verdict && (
                    <Pill color={summary.verdictColor}>{summary.verdictLabel}</Pill>
                  )}
                  {state.final && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {(state.final.total_latency_ms / 1000).toFixed(2)}s ·{" "}
                      {state.final.cost_eur.toFixed(4)} €
                    </span>
                  )}
                  {isLoading && !state.final && (
                    <span className="text-xs text-zinc-500 animate-pulse">
                      pipeline en cours...
                    </span>
                  )}
                </div>

                {state.final ? (
                  <FormattedResponse text={state.final.response} />
                ) : state.gem ? (
                  <FormattedResponse text={state.gem.output.reponse_brute} />
                ) : (
                  <div className="text-sm text-zinc-400 italic">
                    En attente de la réponse du Gem…
                  </div>
                )}

                {state.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs">
                    {state.errors.map((e, i) => (
                      <div key={i} className="text-red-700">
                        <strong>[{e.stage}]</strong> {e.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* === RIGHT — Trace === */}
          {showTrace && (
            <aside className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm h-fit lg:sticky lg:top-[80px]">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[10px] font-bold tracking-[1.5px] text-zinc-500 uppercase">
                  Trace
                </h2>
                <span className="text-[10px] font-mono text-zinc-400">
                  {summary.completedSteps} / {summary.totalSteps}
                  {summary.allDone && " ✓"}
                </span>
              </div>

              {!state.orchestrator && !isLoading && (
                <p className="text-xs text-zinc-400 italic">
                  La trace s'affichera ici à chaque étape du pipeline.
                </p>
              )}

              <div className="space-y-1">
                <TraceItem
                  index="01"
                  title="Orchestrateur"
                  model={
                    state.orchestrator?.output._meta
                      ? `${formatProvider(state.orchestrator.output._meta)} · JSON`
                      : "JSON mode"
                  }
                  latency={state.orchestrator?.latency_ms}
                  done={!!state.orchestrator}
                  pending={isLoading && !state.orchestrator}
                >
                  {state.orchestrator && (
                    <div className="text-[11px] text-zinc-600 space-y-0.5 mt-1">
                      <div>
                        <span className="text-zinc-400">Domaine :</span>{" "}
                        <span className="font-mono">{state.orchestrator.output.domaine}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Criticité :</span>{" "}
                        <span className="font-mono">{state.orchestrator.output.criticite}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Calcul :</span>{" "}
                        <span className="font-mono">
                          {state.orchestrator.output.besoin_calcul ? "oui" : "non"}
                        </span>{" "}
                        <span className="text-zinc-400">· Irrév. :</span>{" "}
                        <span className="font-mono">
                          {state.orchestrator.output.irreversible ? "oui" : "non"}
                        </span>
                      </div>
                      <div className="text-zinc-500 italic mt-1">
                        {state.orchestrator.output.raison_courte}
                      </div>
                    </div>
                  )}
                </TraceItem>

                <TraceItem
                  index="02"
                  title="Gem cloné"
                  model="Gemini Flash · KB cachée"
                  latency={state.gem?.output.latency_ms}
                  done={!!state.gem}
                  pending={isLoading && !state.gem && !!state.orchestrator}
                >
                  {state.gem && (
                    <div className="text-[11px] text-zinc-600 space-y-0.5 mt-1">
                      <div>
                        <span className="text-zinc-400">Tokens IN/OUT :</span>{" "}
                        <span className="font-mono">
                          {state.gem.output.tokens_input.toLocaleString()} /{" "}
                          {state.gem.output.tokens_output.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Cache hit :</span>{" "}
                        <span className="font-mono">
                          {state.gem.output.cache_hit ? "✓" : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Millésime :</span>{" "}
                        <span className="font-mono">
                          {state.gem.output.millesime_detecte ?? "ABSENT"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Citations :</span>{" "}
                        <span className="font-mono">
                          {state.gem.output.citations_brutes.length}
                        </span>
                      </div>
                    </div>
                  )}
                </TraceItem>

                {(state.calculator ||
                  (state.orchestrator?.output.besoin_calcul &&
                    state.orchestrator?.output.domaine === "LMNP")) && (
                  <TraceItem
                    index="03"
                    title="Calculateur"
                    model={state.calculator?.output.formule ?? "FORM-002 (TS)"}
                    done={!!state.calculator}
                    pending={isLoading && !state.calculator && !!state.gem}
                  >
                    {state.calculator && (
                      <div className="text-[11px] text-zinc-600 space-y-0.5 mt-1">
                        <div>
                          <span className="text-zinc-400">Résultat :</span>{" "}
                          <span className="font-mono font-bold text-[#10B981]">
                            {state.calculator.output.resultat.toLocaleString("fr-FR")}{" "}
                            {state.calculator.output.unite}
                          </span>
                        </div>
                        <div className="text-zinc-500 italic">
                          {state.calculator.output.etapes.length} étapes — version{" "}
                          {state.calculator.output.version}
                        </div>
                      </div>
                    )}
                  </TraceItem>
                )}

                {(state.reviewer ||
                  (state.gem &&
                    state.orchestrator &&
                    (state.orchestrator.output.criticite !== "FAIBLE" ||
                      state.orchestrator.output.irreversible))) && (
                  <TraceItem
                    index="04"
                    title="Reviewer"
                    model={
                      state.reviewer?.output._meta
                        ? `${formatProvider(state.reviewer.output._meta)} · audit`
                        : "audit"
                    }
                    latency={state.reviewer?.latency_ms}
                    done={!!state.reviewer}
                    pending={isLoading && !state.reviewer && !!state.gem}
                  >
                    {state.reviewer && (
                      <div className="text-[11px] text-zinc-600 space-y-0.5 mt-1">
                        <div>
                          <span className="text-zinc-400">Verdict :</span>{" "}
                          <span
                            className={`font-mono font-bold ${
                              state.reviewer.output.verdict === "VALIDÉ"
                                ? "text-[#10B981]"
                                : state.reviewer.output.verdict === "À_CORRIGER"
                                  ? "text-[#F59E0B]"
                                  : "text-[#EF4444]"
                            }`}
                          >
                            {state.reviewer.output.verdict}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Score :</span>{" "}
                          <span className="font-mono">
                            {state.reviewer.output.score_confiance.toFixed(2)}
                          </span>
                        </div>
                        {state.reviewer.output.ecarts.length > 0 && (
                          <ul className="text-zinc-600 mt-1 space-y-0.5">
                            {state.reviewer.output.ecarts.slice(0, 3).map((e, i) => (
                              <li key={i} className="pl-2 border-l-2 border-amber-300">
                                {e}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </TraceItem>
                )}

                <TraceItem
                  index="QG"
                  title="Quality Gate"
                  model="TS · déterministe"
                  latency={state.qualityGate?.latency_ms}
                  done={!!state.qualityGate}
                  pending={isLoading && !state.qualityGate && !!state.gem}
                >
                  {state.qualityGate && (
                    <div className="text-[11px] text-zinc-600 space-y-0.5 mt-1">
                      <Check ok={state.qualityGate.output.format_ok}>Format</Check>
                      <Check ok={state.qualityGate.output.citations_invalides.length === 0}>
                        Citations CGI
                      </Check>
                      <Check ok={state.qualityGate.output.millesime_present}>
                        Millésime
                      </Check>
                      <Check ok={state.qualityGate.output.statuts_signales}>
                        Statuts signalés
                      </Check>
                      <Check ok={state.qualityGate.output.validation_requise_present}>
                        Validation requise
                      </Check>
                      {state.qualityGate.output.annotations.length > 0 && (
                        <div className="text-amber-700 italic mt-1">
                          {state.qualityGate.output.annotations.length} annotation
                          {state.qualityGate.output.annotations.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  )}
                </TraceItem>
              </div>

              {state.final && (
                <div className="mt-5 pt-4 border-t border-zinc-200 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Latence :</span>
                    <span>{(state.final.total_latency_ms / 1000).toFixed(2)} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Coût :</span>
                    <span>{state.final.cost_eur.toFixed(4)} €</span>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </main>

      <footer className="bg-[#0A1C2F] text-zinc-400 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-xs flex justify-between items-center">
          <span>
            <span className="text-[#D4A574] font-bold">COMPTA MULTI-AGENTS</span> · Mai 2026
          </span>
          <span className="font-mono">Next.js 16 · Gemini · Vercel</span>
        </div>
      </footer>
    </div>
  );
}

function formatProvider(meta: { provider: string; model: string }): string {
  const providerShort =
    meta.provider === "anthropic" ? "Claude" : "Gemini";
  // Model display: strip "claude-" / "gemini-" prefix and the date suffix.
  let modelShort = meta.model
    .replace(/^claude-/, "")
    .replace(/^gemini-/, "")
    .replace(/-2025\d{4}$/, "")
    .replace(/-2026\d{4}$/, "");
  // Keep Haiku/Sonnet/Opus or Flash/Pro labels short.
  return `${providerShort} ${modelShort}`;
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${
        ok ? "bg-[#10B981] text-white" : "bg-[#EF4444] text-white"
      }`}>
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-zinc-600" : "text-red-600 font-medium"}>
        {children}
      </span>
    </div>
  );
}

function buildSummary(state: StepState) {
  const totalSteps = 5;
  const completedSteps =
    Number(!!state.orchestrator) +
    Number(!!state.gem) +
    Number(!!state.calculator || !state.orchestrator?.output.besoin_calcul) +
    Number(
      !!state.reviewer ||
        (!!state.orchestrator &&
          state.orchestrator.output.criticite === "FAIBLE" &&
          !state.orchestrator.output.irreversible),
    ) +
    Number(!!state.qualityGate);

  const allDone = !!state.final;

  let verdictLabel = "Validée";
  let verdictColor: "green" | "amber" | "red" | "navy" = "green";
  let verdict = false;

  if (state.reviewer) {
    verdict = true;
    if (state.reviewer.output.verdict === "VALIDÉ") {
      verdictLabel = "✓ Validée";
      verdictColor = "green";
    } else if (state.reviewer.output.verdict === "À_CORRIGER") {
      verdictLabel = "⚠ À vérifier";
      verdictColor = "amber";
    } else {
      verdictLabel = "✗ Divergence";
      verdictColor = "red";
    }
  } else if (state.qualityGate && state.qualityGate.output.annotations.length > 0) {
    verdict = true;
    verdictLabel = "⚠ Annotations QG";
    verdictColor = "amber";
  } else if (state.final) {
    verdict = true;
    verdictLabel = "✓ Validée";
    verdictColor = "green";
  }

  return {
    progress: !!state.orchestrator,
    completedSteps: Math.min(totalSteps, completedSteps),
    totalSteps,
    allDone,
    verdict,
    verdictLabel,
    verdictColor,
  };
}

function updateState(prev: StepState, step: PipelineStep): StepState {
  switch (step.kind) {
    case "orchestrator":
      return { ...prev, orchestrator: step };
    case "gem":
      return { ...prev, gem: step };
    case "calculator":
      return { ...prev, calculator: step };
    case "reviewer":
      return { ...prev, reviewer: step };
    case "quality-gate":
      return { ...prev, qualityGate: step };
    case "final":
      return { ...prev, final: step };
    case "error":
      return { ...prev, errors: [...prev.errors, step] };
  }
}

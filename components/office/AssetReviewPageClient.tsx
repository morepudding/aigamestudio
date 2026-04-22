"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OFFICE_REVIEW_MODULES,
  REVIEW_STATUS_LABELS,
  type ReviewStatus,
} from "@/lib/config/officeAssetReview";
import {
  type AssetVariant,
  type OfficeAssetType,
} from "@/lib/services/officeAssetService";

type ReviewRow = {
  module_key: string;
  asset_type: OfficeAssetType;
  variant: AssetVariant;
  attempt: number;
  review_status: ReviewStatus;
  raw_url: string;
  approved_url: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewResponse = {
  rows?: ReviewRow[];
  error?: string;
};

type GenerationResult = {
  moduleKey: string;
  moduleLabel: string;
  generated: number;
  skipped: number;
  notes: string[];
  errors: string[];
};

type GenerationResponse = {
  ok?: boolean;
  attempts?: number;
  force?: boolean;
  results?: GenerationResult[];
  error?: string;
};

function sortRows(rows: ReviewRow[]) {
  return [...rows].sort((left, right) => {
    if (left.asset_type !== right.asset_type) {
      return left.asset_type.localeCompare(right.asset_type);
    }
    if (left.variant !== right.variant) {
      return left.variant - right.variant;
    }
    return left.attempt - right.attempt;
  });
}

function formatTimestamp(value: string | null) {
  if (!value) return "Jamais";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AssetReviewPageClient() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>("all");
  const [attempts, setAttempts] = useState<number>(4);
  const [forceGeneration, setForceGeneration] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationLog, setGenerationLog] = useState<GenerationResult[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({});

  const loadRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/office/asset-review", { cache: "no-store" });
      const data = (await response.json()) as ReviewResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de charger la review des assets.");
      }

      setRows(sortRows(data.rows ?? []));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const groupedRows = useMemo(() => {
    const grouped = new Map<string, ReviewRow[]>();

    for (const row of rows) {
      const key = `${row.asset_type}:${row.variant}`;
      const existing = grouped.get(key) ?? [];
      existing.push(row);
      grouped.set(key, existing);
    }

    for (const [key, value] of grouped.entries()) {
      grouped.set(
        key,
        [...value].sort((left, right) => right.attempt - left.attempt)
      );
    }

    return grouped;
  }, [rows]);

  const visibleModules = useMemo(() => {
    if (selectedModuleKey === "all") {
      return OFFICE_REVIEW_MODULES;
    }

    return OFFICE_REVIEW_MODULES.filter((moduleDef) => moduleDef.key === selectedModuleKey);
  }, [selectedModuleKey]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGenerationLog([]);

    try {
      const response = await fetch("/api/office/asset-review/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleKey: selectedModuleKey,
          attempts,
          force: forceGeneration,
        }),
      });

      const data = (await response.json()) as GenerationResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Impossible de lancer la generation.");
      }

      setGenerationLog(data.results ?? []);
      await loadRows();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Erreur inconnue.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDecision = async (row: ReviewRow, decision: ReviewStatus) => {
    const key = `${row.asset_type}:${row.variant}:${row.attempt}:${decision}`;
    setSavingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/office/asset-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleKey: row.module_key,
          assetType: row.asset_type,
          variant: row.variant,
          attempt: row.attempt,
          rawUrl: row.raw_url,
          decision,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible d'enregistrer la decision.");
      }

      await loadRows();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Erreur inconnue.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/70">
                Office Asset Review
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Raw vers approved
              </h1>
              <p className="text-sm leading-6 text-neutral-300">
                Genere des essais bruts par module, compare les angles et valide une version
                normalisee quand le rendu est suffisamment stable.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-end">
              <label className="flex min-w-56 flex-col gap-2 text-sm text-neutral-300">
                Module cible
                <select
                  value={selectedModuleKey}
                  onChange={(event) => setSelectedModuleKey(event.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="all">Tous les modules branches</option>
                  {OFFICE_REVIEW_MODULES.map((moduleDef) => (
                    <option key={moduleDef.key} value={moduleDef.key}>
                      {moduleDef.priority}. {moduleDef.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex w-28 flex-col gap-2 text-sm text-neutral-300">
                Essais
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={attempts}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setAttempts(Number.isFinite(nextValue) ? Math.max(1, Math.min(8, nextValue)) : 4);
                  }}
                  className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none"
                />
              </label>

              <label className="flex min-w-52 items-center gap-3 rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={forceGeneration}
                  onChange={(event) => setForceGeneration(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-emerald-400"
                />
                <span>Forcer une nouvelle generation</span>
              </label>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? "Generation..." : "Generer les essais"}
              </button>

              <button
                type="button"
                onClick={() => void loadRows()}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Actualiser
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {generationLog.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {generationLog.map((result) => (
                <div
                  key={result.moduleKey}
                  className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{result.moduleLabel}</p>
                    <p className="text-xs text-cyan-100/70">
                      +{result.generated} generes, {result.skipped} ignores
                    </p>
                  </div>
                  {forceGeneration ? (
                    <p className="mt-2 text-xs text-cyan-100/60">
                      Mode force actif: les essais existants sont regenes au lieu d&apos;etre relus depuis le cache brut.
                    </p>
                  ) : null}
                  {result.notes.length > 0 ? (
                    <p className="mt-2 text-xs text-cyan-100/80">{result.notes.join(" | ")}</p>
                  ) : null}
                  {result.errors.length > 0 ? (
                    <p className="mt-2 text-xs text-red-200">{result.errors.join(" | ")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </header>

        {loading ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-300">
            Chargement de la review en cours...
          </section>
        ) : (
          <section className="grid gap-6">
            {visibleModules.map((moduleDef) => (
              <article
                key={moduleDef.key}
                className="rounded-3xl border border-white/10 bg-white/3 p-5 shadow-xl shadow-black/10"
              >
                <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                        Priorite {moduleDef.priority}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        {moduleDef.key}
                      </span>
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{moduleDef.label}</h2>
                    <p className="mt-1 max-w-3xl text-sm text-neutral-300">{moduleDef.role}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-neutral-300">
                    <p className="font-semibold text-white">Variantes prevues</p>
                    <p className="mt-1">{moduleDef.plannedVariants.join(" | ")}</p>
                  </div>
                </div>

                {moduleDef.targets.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-neutral-400">
                    Module non branche au generateur. Les variantes prevues restent documentaires pour l&apos;instant.
                  </div>
                ) : (() => {
                  const activeKey = selectedTarget[moduleDef.key] ?? `${moduleDef.targets[0].assetType}:${moduleDef.targets[0].variant}`;
                  const activeTarget = moduleDef.targets.find((t) => `${t.assetType}:${t.variant}` === activeKey);
                  const targetRows = groupedRows.get(activeKey) ?? [];

                  return (
                    <div className="mt-5 flex flex-col gap-4">
                      <div className="flex flex-wrap gap-2">
                        {moduleDef.targets.map((target) => {
                          const targetKey = `${target.assetType}:${target.variant}`;
                          const isActive = activeKey === targetKey;
                          return (
                            <button
                              key={targetKey}
                              type="button"
                              onClick={() =>
                                setSelectedTarget((prev) => ({ ...prev, [moduleDef.key]: targetKey }))
                              }
                              className={[
                                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                                isActive
                                  ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                                  : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white",
                              ].join(" ")}
                            >
                              {target.label}
                            </button>
                          );
                        })}
                      </div>

                      {activeTarget ? (
                        <section className="rounded-2xl border border-white/10 bg-black/15 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{activeTarget.label}</h3>
                              <p className="text-xs text-neutral-400">
                                {activeTarget.assetType} — variante {activeTarget.variant}
                              </p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300">
                              v{activeTarget.variant}
                            </span>
                          </div>

                          {targetRows.length === 0 ? (
                            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 px-4 py-5 text-sm text-neutral-400">
                              Aucun essai reviewe pour cet angle. Lance une generation pour remplir ce panneau.
                            </div>
                          ) : (
                            <div className="mt-4 grid gap-4">
                              {targetRows.map((row) => {
                                const buttonPrefix = `${row.asset_type}:${row.variant}:${row.attempt}`;
                                const approved = row.review_status === "approved";

                                return (
                                  <div
                                    key={`${buttonPrefix}:${row.review_status}`}
                                    className="rounded-2xl border border-white/10 bg-white/3 p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                                      <div>
                                        <p className="text-sm font-semibold text-white">Attempt {row.attempt}</p>
                                        <p className="text-xs text-neutral-400">
                                          {REVIEW_STATUS_LABELS[row.review_status]} | Mise a jour {formatTimestamp(row.updated_at)}
                                        </p>
                                      </div>
                                      <span
                                        className={[
                                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                                          approved
                                            ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                                            : row.review_status === "rejected"
                                              ? "border border-red-400/30 bg-red-500/10 text-red-200"
                                              : "border border-amber-400/30 bg-amber-500/10 text-amber-100",
                                        ].join(" ")}
                                      >
                                        {REVIEW_STATUS_LABELS[row.review_status]}
                                      </span>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                          Raw
                                        </p>
                                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
                                          <img
                                            src={row.raw_url}
                                            alt={`${activeTarget.label} raw attempt ${row.attempt}`}
                                            className="aspect-square h-auto w-full object-contain"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                                          Approved
                                        </p>
                                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
                                          {row.approved_url ? (
                                            <img
                                              src={row.approved_url}
                                              alt={`${activeTarget.label} approved attempt ${row.attempt}`}
                                              className="aspect-square h-auto w-full object-contain"
                                            />
                                          ) : (
                                            <div className="flex aspect-square items-center justify-center px-4 text-center text-sm text-neutral-500">
                                              Aucune version normalisee enregistree.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void handleDecision(row, "approved")}
                                        disabled={savingKey === `${buttonPrefix}:approved`}
                                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingKey === `${buttonPrefix}:approved` ? "Validation..." : "Approve"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDecision(row, "rejected")}
                                        disabled={savingKey === `${buttonPrefix}:rejected`}
                                        className="rounded-xl bg-red-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingKey === `${buttonPrefix}:rejected` ? "Rejet..." : "Reject"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDecision(row, "raw")}
                                        disabled={savingKey === `${buttonPrefix}:raw`}
                                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {savingKey === `${buttonPrefix}:raw` ? "Reset..." : "Reset raw"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      ) : null}
                    </div>
                  );
                })()}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}



"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ConfirmImportDialog } from "@/components/admin/ConfirmImportDialog";
import { MAX_JSON_TEXT_BYTES } from "@/lib/terms-import-constants";
import type {
  AliasPreview,
  CommitSuccess,
  PreviewSuccess,
  TermPreview,
  ValidationIssue,
} from "@/lib/terms-import";

type ApiErrorBody = {
  ok?: false;
  code?: string;
  error?: string;
  issues?: ValidationIssue[];
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} Mo`;
  }
  return `${Math.ceil(bytes / 1024)} Ko`;
}

function termActionLabel(action: TermPreview["termAction"]): string {
  if (action === "create") {
    return "Création";
  }
  if (action === "keep") {
    return "Déjà présent (inchangé)";
  }
  return "Conflit";
}

function aliasActionLabel(action: AliasPreview["action"]): string {
  if (action === "create") {
    return "à créer";
  }
  if (action === "already_present") {
    return "déjà présent";
  }
  if (action === "redundant") {
    return "redondant";
  }
  if (action === "skipped") {
    return "ignoré";
  }
  return "conflit";
}

export function ImportTermsForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const [jsonText, setJsonText] = useState("");
  const [lastLoadedText, setLastLoadedText] = useState("");
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewSuccess | null>(null);
  const [commitResult, setCommitResult] = useState<CommitSuccess | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);

  const busy = previewing || committing;
  const hasWork =
    preview !== null &&
    preview.canCommit &&
    (preview.summary.newTerms > 0 || preview.summary.aliasesToCreate > 0);

  function clearFeedback(): void {
    setError(null);
    setIssues([]);
    setPreview(null);
    setCommitResult(null);
  }

  function applyApiError(data: ApiErrorBody, fallback: string): void {
    setError(data.error ?? fallback);
    setIssues(data.issues ?? []);
    setPreview(null);
    setCommitResult(null);
  }

  function handleJsonTextChange(value: string): void {
    setJsonText(value);
    setPreview(null);
    setCommitResult(null);
    setError(null);
    setIssues([]);
  }

  async function loadFile(file: File): Promise<void> {
    if (file.size > MAX_JSON_TEXT_BYTES) {
      setError(
        `Le fichier dépasse la taille maximale de ${formatBytes(MAX_JSON_TEXT_BYTES)}.`,
      );
      setIssues([]);
      setPreview(null);
      setCommitResult(null);
      return;
    }

    const text = await file.text();
    if (new TextEncoder().encode(text).length > MAX_JSON_TEXT_BYTES) {
      setError(
        `Le fichier dépasse la taille maximale de ${formatBytes(MAX_JSON_TEXT_BYTES)}.`,
      );
      setIssues([]);
      setPreview(null);
      setCommitResult(null);
      return;
    }

    setJsonText(text);
    setLastLoadedText(text);
    setLoadedFileName(file.name);
    clearFeedback();
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const modified =
      jsonText !== lastLoadedText && jsonText.trim().length > 0;

    if (modified) {
      const confirmed = window.confirm(
        `Remplacer le JSON actuel par le contenu de ${file.name} ?`,
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      await loadFile(file);
    } catch {
      setError("Impossible de lire le fichier.");
      setIssues([]);
    }
  }

  async function handlePreview(): Promise<void> {
    clearFeedback();

    if (jsonText.trim().length === 0) {
      setError("Collez un JSON ou chargez un fichier avant de prévisualiser.");
      return;
    }

    setPreviewing(true);

    try {
      const response = await fetch("/api/terms/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonText }),
      });
      const data = (await response.json()) as PreviewSuccess & ApiErrorBody;

      if (!response.ok) {
        applyApiError(data, "Impossible de prévisualiser l’import.");
        return;
      }

      setPreview(data);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirmImport(): Promise<void> {
    if (!preview || !hasWork) {
      return;
    }

    setError(null);
    setIssues([]);
    setCommitting(true);

    try {
      const response = await fetch("/api/terms/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonText,
          payloadHash: preview.payloadHash,
          catalogFingerprint: preview.catalogFingerprint,
        }),
      });
      const data = (await response.json()) as CommitSuccess & ApiErrorBody;

      if (!response.ok) {
        setConfirmOpen(false);
        applyApiError(data, "Impossible d’importer les termes.");
        return;
      }

      setConfirmOpen(false);
      setCommitResult(data);
      setPreview(null);
    } catch {
      setConfirmOpen(false);
      setError("Impossible de contacter le serveur.");
    } finally {
      setCommitting(false);
    }
  }

  const sourceStatus = loadedFileName
    ? jsonText === lastLoadedText
      ? `Contenu chargé depuis : ${loadedFileName}`
      : `JSON modifié dans la zone de texte (chargé depuis : ${loadedFileName})`
    : null;

  const inputClass =
    "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

  return (
    <>
      <div className="flex flex-col gap-5">
        {error ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{error}</p>
            {issues.length > 0 ? (
              <ul className="list-disc pl-5">
                {issues.map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    {issue.path ? `${issue.path} : ${issue.message}` : issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {commitResult ? (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            Import terminé : {commitResult.createdTerms} terme
            {commitResult.createdTerms > 1 ? "s" : ""} et{" "}
            {commitResult.createdAliases} alias créé
            {commitResult.createdAliases > 1 ? "s" : ""}
            {commitResult.unchangedTerms > 0
              ? `, ${commitResult.unchangedTerms} terme${commitResult.unchangedTerms > 1 ? "s" : ""} déjà présent${commitResult.unchangedTerms > 1 ? "s" : ""}`
              : ""}
            .{" "}
            <Link
              href="/admin/terms"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Retour à la liste des termes
            </Link>
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="import-file" className="text-sm font-medium text-stone-700">
            Fichier JSON
          </label>
          <input
            ref={fileInputRef}
            id="import-file"
            name="file"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => {
              void handleFileChange(event);
            }}
            className="block w-full text-sm text-stone-700 file:mr-4 file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-rose-800 hover:file:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="text-xs text-stone-500">
            Le fichier est lu dans le navigateur, copié dans la zone de texte,
            puis envoyé comme JSON. Taille maximale :{" "}
            {formatBytes(MAX_JSON_TEXT_BYTES)}.
          </p>
        </div>

        {sourceStatus ? (
          <p role="status" className="text-sm text-stone-600">
            {sourceStatus}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="import-json" className="text-sm font-medium text-stone-700">
            Coller le JSON
          </label>
          <textarea
            id="import-json"
            name="jsonText"
            rows={16}
            value={jsonText}
            spellCheck={false}
            disabled={busy}
            onChange={(event) => handleJsonTextChange(event.target.value)}
            className={`${inputClass} resize-y font-mono text-sm`}
          />
        </div>

        <button
          type="button"
          disabled={busy}
          aria-busy={previewing || undefined}
          className="w-full rounded-xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void handlePreview();
          }}
        >
          {previewing ? "Vérification…" : "Vérifier et prévisualiser"}
        </button>

        {preview ? (
          <section className="flex flex-col gap-4" aria-live="polite">
            {preview.canCommit && !hasWork ? (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                Tout est déjà à jour. Rien à importer.
              </p>
            ) : null}

            {!preview.canCommit ? (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                Des conflits empêchent l’import. Corrigez le JSON, puis
                prévisualisez à nouveau. Rien n’a été écrit.
              </p>
            ) : null}

            <ul className="grid grid-cols-1 gap-2 text-sm text-stone-700 sm:grid-cols-2">
              <li>Termes nouveaux : {preview.summary.newTerms}</li>
              <li>Termes existants inchangés : {preview.summary.unchangedTerms}</li>
              <li>Alias à créer : {preview.summary.aliasesToCreate}</li>
              <li>Alias déjà présents : {preview.summary.aliasesAlreadyPresent}</li>
              <li>Alias redondants : {preview.summary.redundantAliases}</li>
              <li>Conflits : {preview.summary.conflicts}</li>
              <li>Erreurs de validation : {preview.summary.validationErrors}</li>
            </ul>

            <div className="flex flex-col gap-3">
              {preview.terms.map((term) => (
                <article
                  key={`${term.index}-${term.code}`}
                  className={`rounded-xl border px-4 py-4 ${
                    term.termAction === "conflict"
                      ? "border-red-200 bg-red-50"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <p className="font-mono text-sm font-semibold text-rose-700">
                    {term.code}
                  </p>
                  <p className="text-base font-semibold text-stone-900">
                    {term.label}
                  </p>
                  <p className="text-sm text-stone-600">
                    {termActionLabel(term.termAction)}
                  </p>
                  {term.messages.map((message) => (
                    <p key={message} className="text-sm text-stone-700">
                      {message}
                    </p>
                  ))}
                  {term.aliases.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1 text-sm text-stone-700">
                      {term.aliases.map((alias) => (
                        <li key={`${alias.aliasNormalized}-${alias.action}`}>
                          <span className="font-mono">{alias.alias}</span>
                          {" — "}
                          {aliasActionLabel(alias.action)}
                          {alias.message ? ` : ${alias.message}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-stone-500">Aucun alias</p>
                  )}
                </article>
              ))}
            </div>

            {hasWork ? (
              <button
                ref={confirmButtonRef}
                type="button"
                disabled={busy}
                className="w-full rounded-xl border border-rose-700 bg-white px-6 py-4 text-base font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setConfirmOpen(true)}
              >
                Confirmer l’import
              </button>
            ) : null}
          </section>
        ) : null}
      </div>

      <ConfirmImportDialog
        open={confirmOpen}
        newTerms={preview?.summary.newTerms ?? 0}
        aliasesToCreate={preview?.summary.aliasesToCreate ?? 0}
        pending={committing}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          void handleConfirmImport();
        }}
        returnFocusRef={confirmButtonRef}
      />
    </>
  );
}

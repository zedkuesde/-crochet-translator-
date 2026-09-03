"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import { DeleteTermDialog } from "@/components/admin/DeleteTermDialog";
import type { TermField, TermFormValue } from "@/lib/term-types";

type TermFormProps =
  | { mode: "create" }
  | { mode: "edit"; term: TermFormValue };

type ApiErrorBody = {
  error?: string;
  field?: TermField;
};

const FIELD_IDS = {
  code: "term-code",
  label: "term-label",
  description: "term-description",
  imagePath: "term-image-path",
  alias: "term-alias-input",
} as const;

function fieldMessageId(field: TermField): string {
  return `term-error-${field}`;
}

export function TermForm(props: TermFormProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.term : null;

  const [code, setCode] = useState(initial?.code ?? "");
  const [savedCode, setSavedCode] = useState(initial?.code ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imagePath, setImagePath] = useState(initial?.imagePath ?? "");
  const [aliases, setAliases] = useState(
    initial?.aliases.map((alias) => ({
      id: alias.id,
      alias: alias.alias,
    })) ?? [],
  );
  const [draftAliases, setDraftAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState("");

  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TermField, string>>>(
    {},
  );
  const [savingTerm, setSavingTerm] = useState(false);
  const [savingAlias, setSavingAlias] = useState(false);
  const [deletingAliasId, setDeletingAliasId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTerm, setDeletingTerm] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const busy = savingTerm || savingAlias || deletingAliasId !== null || deletingTerm;

  function applyApiError(data: ApiErrorBody, fallback: string): void {
    const message = data.error ?? fallback;
    setSummaryError(message);
    if (data.field) {
      setFieldErrors({ [data.field]: message });
    } else {
      setFieldErrors({});
    }
  }

  function clearErrors(): void {
    setSummaryError(null);
    setFieldErrors({});
  }

  function addDraftAlias(): void {
    const next = aliasInput.trim();
    if (!next) {
      setFieldErrors({ alias: "L’alias ne peut pas être vide." });
      setSummaryError("L’alias ne peut pas être vide.");
      return;
    }

    setDraftAliases((current) => [...current, next]);
    setAliasInput("");
    setFieldErrors((current) => {
      const rest = { ...current };
      delete rest.alias;
      delete rest.aliases;
      return rest;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearErrors();
    setSavingTerm(true);

    try {
      if (isEdit && initial) {
        const response = await fetch(`/api/terms/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            label,
            description,
            imagePath,
          }),
        });
        const data = (await response.json()) as TermFormValue & ApiErrorBody;

        if (!response.ok) {
          applyApiError(data, "Impossible d’enregistrer le terme.");
          return;
        }

        setCode(data.code);
        setSavedCode(data.code);
        setLabel(data.label);
        setDescription(data.description ?? "");
        setImagePath(data.imagePath ?? "");
        router.refresh();
        return;
      }

      const response = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          label,
          description,
          imagePath,
          aliases: draftAliases,
        }),
      });
      const data = (await response.json()) as TermFormValue & ApiErrorBody;

      if (!response.ok) {
        applyApiError(data, "Impossible de créer le terme.");
        return;
      }

      router.push(`/admin/terms/${data.id}`);
      router.refresh();
    } catch {
      setSummaryError("Impossible de contacter le serveur.");
    } finally {
      setSavingTerm(false);
    }
  }

  async function handleAddAlias(): Promise<void> {
    if (!isEdit || !initial) {
      addDraftAlias();
      return;
    }

    clearErrors();
    setSavingAlias(true);

    try {
      const response = await fetch(`/api/terms/${initial.id}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: aliasInput }),
      });
      const data = (await response.json()) as TermFormValue & ApiErrorBody;

      if (!response.ok) {
        applyApiError(data, "Impossible d’ajouter l’alias.");
        return;
      }

      setAliases(data.aliases.map((alias) => ({ id: alias.id, alias: alias.alias })));
      setAliasInput("");
      router.refresh();
    } catch {
      setSummaryError("Impossible de contacter le serveur.");
    } finally {
      setSavingAlias(false);
    }
  }

  async function handleRemoveSavedAlias(aliasId: string): Promise<void> {
    if (!isEdit || !initial) {
      return;
    }

    clearErrors();
    setDeletingAliasId(aliasId);

    try {
      const response = await fetch(`/api/terms/${initial.id}/aliases/${aliasId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as TermFormValue & ApiErrorBody;

      if (!response.ok) {
        applyApiError(data, "Impossible de supprimer l’alias.");
        return;
      }

      setAliases(data.aliases.map((alias) => ({ id: alias.id, alias: alias.alias })));
      router.refresh();
    } catch {
      setSummaryError("Impossible de contacter le serveur.");
    } finally {
      setDeletingAliasId(null);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!isEdit || !initial) {
      return;
    }

    clearErrors();
    setDeletingTerm(true);

    try {
      const response = await fetch(`/api/terms/${initial.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { code?: string } & ApiErrorBody;

      if (!response.ok) {
        applyApiError(data, "Impossible de supprimer le terme.");
        setDeleteOpen(false);
        return;
      }

      router.push(`/admin/terms?deleted=${encodeURIComponent(data.code ?? savedCode)}`);
      router.refresh();
    } catch {
      setSummaryError("Impossible de contacter le serveur.");
      setDeleteOpen(false);
    } finally {
      setDeletingTerm(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";
  const errorInputClass = "border-red-300 focus:border-red-400 focus:ring-red-100";

  return (
    <>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5" noValidate>
        {summaryError ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {summaryError}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor={FIELD_IDS.code} className="text-sm font-medium text-stone-700">
            Code
          </label>
          <input
            id={FIELD_IDS.code}
            name="code"
            type="text"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={fieldErrors.code ? true : undefined}
            aria-describedby={fieldErrors.code ? fieldMessageId("code") : undefined}
            className={`${inputClass} font-mono ${fieldErrors.code ? errorInputClass : ""}`}
          />
          {fieldErrors.code ? (
            <p id={fieldMessageId("code")} className="text-sm text-red-700">
              {fieldErrors.code}
            </p>
          ) : (
            <p className="text-xs text-stone-500">
              Obligatoire. Normalisé en minuscules (ex. ms). Les points sont
              conservés : m.s. et ms sont différents.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={FIELD_IDS.label} className="text-sm font-medium text-stone-700">
            Libellé
          </label>
          <input
            id={FIELD_IDS.label}
            name="label"
            type="text"
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            aria-invalid={fieldErrors.label ? true : undefined}
            aria-describedby={fieldErrors.label ? fieldMessageId("label") : undefined}
            className={`${inputClass} ${fieldErrors.label ? errorInputClass : ""}`}
          />
          {fieldErrors.label ? (
            <p id={fieldMessageId("label")} className="text-sm text-red-700">
              {fieldErrors.label}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor={FIELD_IDS.description}
            className="text-sm font-medium text-stone-700"
          >
            Description (optionnelle)
          </label>
          <textarea
            id={FIELD_IDS.description}
            name="description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={
              fieldErrors.description ? fieldMessageId("description") : undefined
            }
            className={`${inputClass} resize-y ${fieldErrors.description ? errorInputClass : ""}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor={FIELD_IDS.imagePath}
            className="text-sm font-medium text-stone-700"
          >
            Chemin d’image (optionnel)
          </label>
          <input
            id={FIELD_IDS.imagePath}
            name="imagePath"
            type="text"
            value={imagePath}
            onChange={(event) => setImagePath(event.target.value)}
            placeholder="/stitches/ms.webp"
            aria-invalid={fieldErrors.imagePath ? true : undefined}
            aria-describedby={
              fieldErrors.imagePath
                ? fieldMessageId("imagePath")
                : "term-image-path-hint"
            }
            className={`${inputClass} font-mono text-sm ${fieldErrors.imagePath ? errorInputClass : ""}`}
          />
          <p id="term-image-path-hint" className="text-xs text-stone-500">
            Saisie manuelle uniquement, sans envoi de fichier.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white px-4 py-4">
          <legend className="px-1 text-sm font-medium text-stone-700">Alias</legend>

          {isEdit ? (
            aliases.length === 0 ? (
              <p className="text-sm text-stone-500">Aucun alias pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {aliases.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2"
                  >
                    <span className="font-mono text-sm text-stone-800">{item.alias}</span>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-sm font-semibold text-stone-600 underline-offset-2 hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void handleRemoveSavedAlias(item.id);
                      }}
                    >
                      {deletingAliasId === item.id ? "Suppression…" : "Supprimer l’alias"}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : draftAliases.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun alias ajouté pour l’instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {draftAliases.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2"
                >
                  <span className="font-mono text-sm text-stone-800">{item}</span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm font-semibold text-stone-600 underline-offset-2 hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      setDraftAliases((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      );
                    }}
                  >
                    Supprimer l’alias
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fieldErrors.aliases ? (
            <p id={fieldMessageId("aliases")} className="text-sm text-red-700">
              {fieldErrors.aliases}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <label htmlFor={FIELD_IDS.alias} className="text-sm font-medium text-stone-700">
              Nouvel alias
            </label>
            <input
              id={FIELD_IDS.alias}
              name="alias"
              type="text"
              value={aliasInput}
              onChange={(event) => setAliasInput(event.target.value)}
              aria-invalid={fieldErrors.alias ? true : undefined}
              aria-describedby={fieldErrors.alias ? fieldMessageId("alias") : undefined}
              className={`${inputClass} font-mono text-sm ${fieldErrors.alias ? errorInputClass : ""}`}
            />
            {fieldErrors.alias ? (
              <p id={fieldMessageId("alias")} className="text-sm text-red-700">
                {fieldErrors.alias}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleAddAlias();
              }}
            >
              {savingAlias ? "Ajout…" : "Ajouter un alias"}
            </button>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingTerm ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      {isEdit && initial ? (
        <section className="flex flex-col gap-3 border-t border-stone-200 pt-6">
          <button
            ref={deleteButtonRef}
            type="button"
            disabled={busy}
            className="w-full rounded-xl border border-red-300 bg-white px-6 py-4 text-base font-semibold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setDeleteOpen(true)}
          >
            Supprimer le terme
          </button>
          <DeleteTermDialog
            open={deleteOpen}
            code={savedCode}
            aliasCount={aliases.length}
            pending={deletingTerm}
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => {
              void handleConfirmDelete();
            }}
            returnFocusRef={deleteButtonRef}
          />
        </section>
      ) : null}
    </>
  );
}

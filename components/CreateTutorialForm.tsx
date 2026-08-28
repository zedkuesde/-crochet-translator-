"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const PLACEHOLDER = `R1: 6mc
R2: 2ms dans chaque maille (12)
R3: *1ms, 1aug* x6 (18)`;

export function CreateTutorialForm() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tutorials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          name: name.trim() || undefined,
        }),
      });

      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      if (!data.id) {
        setError("Réponse inattendue du serveur.");
        return;
      }

      router.push(`/tutorials/${data.id}`);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="rawText" className="text-sm font-medium text-stone-700">
          Colle ici ton patron (une ligne par rang)
        </label>
        <textarea
          id="rawText"
          name="rawText"
          rows={8}
          required
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder={PLACEHOLDER}
          className="w-full resize-y rounded-xl border border-stone-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-stone-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium text-stone-700">
          Nom du projet (optionnel)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex. Amigurumi chat"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Création en cours…" : "Créer le tuto"}
      </button>
    </form>
  );
}

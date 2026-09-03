"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import type { CrochetTermHelp } from "@/lib/crochet-terms";

type TermHelpModalProps = {
  term: CrochetTermHelp | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export function TermHelpModal({
  term,
  onClose,
  returnFocusRef,
}: TermHelpModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [term?.id, term?.imagePath]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (term) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [term]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  function closeTermHelp(): void {
    onClose();
  }

  function handleCancel(
    event: React.SyntheticEvent<HTMLDialogElement, Event>,
  ): void {
    event.preventDefault();
    closeTermHelp();
  }

  function handleClose(): void {
    if (term) {
      closeTermHelp();
    }
    returnFocusRef.current?.focus();
  }

  function handleBackdropClick(
    event: React.MouseEvent<HTMLDialogElement>,
  ): void {
    if (event.target === event.currentTarget) {
      closeTermHelp();
    }
  }

  const titleId = term ? `term-help-title-${term.id}` : "term-help-title";
  const showImage = Boolean(term?.imagePath) && !imageFailed;

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(100%-1.5rem,28rem)] max-h-[min(90vh,40rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 shadow-xl"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      {term ? (
        <div
          className="flex flex-col gap-4 px-5 py-5 sm:px-6"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id={titleId} className="flex flex-col gap-1">
            <span className="font-mono text-sm font-semibold tracking-wide text-rose-700">
              {term.code.toLocaleUpperCase("fr")}
            </span>
            <span className="text-xl font-bold text-stone-900">{term.label}</span>
          </h2>

          {term.description ? (
            <p className="text-base leading-relaxed text-stone-700">
              {term.description}
            </p>
          ) : null}

          {showImage ? (
            // Image pédagogique optionnelle : masquée si le chemin est invalide.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={term.imagePath ?? ""}
              alt={`Illustration : ${term.label}`}
              className="max-h-48 w-full rounded-xl object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : null}

          <button
            type="button"
            className="min-h-11 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-base font-semibold text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            onClick={closeTermHelp}
          >
            Fermer
          </button>
        </div>
      ) : null}
    </dialog>
  );
}

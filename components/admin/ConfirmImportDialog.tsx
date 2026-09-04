"use client";

import { useEffect, useRef, type RefObject } from "react";

type ConfirmImportDialogProps = {
  open: boolean;
  newTerms: number;
  aliasesToCreate: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

function importQuestion(newTerms: number, aliasesToCreate: number): string {
  const termsPart =
    newTerms === 1 ? "1 terme" : `${newTerms} termes`;
  const aliasesPart =
    aliasesToCreate === 1 ? "1 alias" : `${aliasesToCreate} alias`;
  return `Importer ${termsPart} et ${aliasesPart} ?`;
}

export function ConfirmImportDialog({
  open,
  newTerms,
  aliasesToCreate,
  pending,
  onCancel,
  onConfirm,
  returnFocusRef,
}: ConfirmImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = "confirm-import-title";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  function handleCancel(
    event: React.SyntheticEvent<HTMLDialogElement, Event>,
  ): void {
    event.preventDefault();
    if (!pending) {
      onCancel();
    }
  }

  function handleClose(): void {
    if (open) {
      onCancel();
    }
    returnFocusRef.current?.focus();
  }

  function handleBackdropClick(
    event: React.MouseEvent<HTMLDialogElement>,
  ): void {
    if (pending) {
      return;
    }

    if (event.target === event.currentTarget) {
      onCancel();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(100%-1.5rem,28rem)] max-h-[min(90vh,40rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 shadow-xl"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      {open ? (
        <div
          className="flex flex-col gap-4 px-5 py-5 sm:px-6"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id={titleId} className="text-xl font-bold text-stone-900">
            {importQuestion(newTerms, aliasesToCreate)}
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">
            Seuls les termes et alias nouveaux seront ajoutés. Les fiches
            existantes ne seront pas écrasées. Cette action est tout ou rien.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={pending}
              className="min-h-11 rounded-xl bg-rose-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onConfirm}
            >
              {pending ? "Import…" : "Confirmer l’import"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="min-h-11 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-base font-semibold text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onCancel}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

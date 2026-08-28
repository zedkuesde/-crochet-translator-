import Link from "next/link";

type PageShellProps = {
  children: React.ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}

type BackLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function BackLink({ href, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit text-sm font-medium text-stone-600 transition hover:text-rose-700"
    >
      {children}
    </Link>
  );
}

type PrimaryButtonLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function PrimaryButtonLink({ href, children }: PrimaryButtonLinkProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-center rounded-xl bg-rose-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-rose-700"
    >
      {children}
    </Link>
  );
}

type SecondaryButtonLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function SecondaryButtonLink({ href, children }: SecondaryButtonLinkProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-4 text-base font-semibold text-stone-800 transition hover:bg-stone-50"
    >
      {children}
    </Link>
  );
}

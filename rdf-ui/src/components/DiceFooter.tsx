import Image from "next/image";
import Link from "next/link";

export default function DiceFooter() {
  return (
    <footer className="mt-auto w-full pb-2 pt-10">
      <div className="flex justify-center py-8">
        <a
          aria-label="DICE research group"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950"
          href="https://dice-research.org/"
          rel="noreferrer"
          target="_blank"
        >
          <Image
            alt="DICE research group"
            className="h-auto dark:invert"
            height={48}
            src="/logo.svg"
            width={120}
          />
        </a>
      </div>

      <nav
        aria-label="Legal"
        className="flex items-center justify-center gap-2 border-t border-slate-200 py-5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:gap-3 sm:text-sm"
      >
        <Link className="transition hover:text-blue-600 dark:hover:text-blue-400" href="/privacy">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link className="transition hover:text-blue-600 dark:hover:text-blue-400" href="/cookies">
          Cookies
        </Link>
        <span aria-hidden="true">·</span>
        <Link className="transition hover:text-blue-600 dark:hover:text-blue-400" href="/terms">
          Terms of Use
        </Link>
      </nav>
    </footer>
  );
}

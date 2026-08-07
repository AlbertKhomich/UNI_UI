import Image from "next/image";
import { FiMoon, FiSun } from "react-icons/fi";

type SiteHeaderProps = {
  isDark: boolean;
  onToggleTheme: () => void;
  className?: string;
};

export default function SiteHeader({
  isDark,
  onToggleTheme,
  className = "",
}: SiteHeaderProps) {
  return (
    <header className={`flex items-start justify-between ${className}`}>
      <a
        aria-label="Open SPARQL endpoint"
        className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950"
        href="http://upbkg.data.dice-research.org/sparql"
        rel="noreferrer"
        target="_blank"
      >
        <Image
          alt="SPARQL endpoint"
          height={48}
          priority
          src="/sparql-96.png"
          width={48}
        />
      </a>
      <button
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isDark
            ? "border-gray-500 text-gray-100 hover:bg-gray-800"
            : "border-gray-300 text-gray-700 hover:bg-gray-100"
        }`}
        onClick={onToggleTheme}
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        type="button"
      >
        {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
      </button>
    </header>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { FiHome, FiLogIn, FiLogOut, FiMoon, FiSun } from "react-icons/fi";

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
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const headerButtonClass = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    isDark
      ? "border-gray-500 text-gray-100 hover:bg-gray-800"
      : "border-gray-300 text-gray-700 hover:bg-gray-100"
  }`;

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOut({ redirect: false, callbackUrl: "/" });
      router.replace("/");
    } catch {
      // Keep the user on the current page so they can retry.
    } finally {
      setIsSigningOut(false);
    }
  }

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
      <div className="flex items-center gap-2">
        <Link
          aria-label="Home"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            isDark
              ? "border-gray-500 text-gray-100 hover:bg-gray-800"
              : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          href="/"
          title="Home"
        >
          <FiHome aria-hidden="true" size={18} />
        </Link>
        {authStatus === "authenticated" ? (
          <button
            className={`${headerButtonClass} disabled:cursor-wait disabled:opacity-60`}
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            <FiLogOut aria-hidden="true" size={17} />
            <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
          </button>
        ) : authStatus === "unauthenticated" ? (
          <Link className={headerButtonClass} href="/login">
            <FiLogIn aria-hidden="true" size={17} />
            <span>Sign in</span>
          </Link>
        ) : null}
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
      </div>
    </header>
  );
}

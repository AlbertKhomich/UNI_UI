"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import DiceFooter from "@/components/DiceFooter";
import PageContainer from "@/components/PageContainer";
import SiteHeader from "@/components/SiteHeader";
import { useTheme } from "@/hooks/useTheme";
import { signInSchema, type SignInFormValues } from "@/lib/signIn";

export default function LoginPage() {
  const router = useRouter();
  const { isDark, setTheme } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submitSignIn(values: SignInFormValues) {
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: "/",
      });

      if (!result?.ok) {
        setError("root", {
          message: "The email or password you entered is incorrect.",
        });
        return;
      }

      router.replace("/");
    } catch {
      setError("root", {
        message: "Unable to sign in right now. Please try again.",
      });
    }
  }

  return (
    <PageContainer className="flex min-h-screen flex-col bg-white text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <SiteHeader
        isDark={isDark}
        onToggleTheme={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
      />

      <section className="mx-auto mt-10 w-full max-w-[480px] rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-7 sm:py-7 lg:mt-12">
        <div className="mb-5 text-center">
          <h1 className="text-[25px] font-bold tracking-[-0.025em] text-slate-950 dark:text-white sm:text-[27px]">
            Sign in
          </h1>
          <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400 sm:text-[15px]">
            Sign in to continue to your account
          </p>
        </div>

        <form className="space-y-3.5" noValidate onSubmit={handleSubmit(submitSignIn)}>
          <div>
            <label
              className="mb-2.5 block text-[15px] font-semibold text-slate-800 dark:text-slate-100"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative">
              <FiMail
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                size={21}
              />
              <input
                aria-describedby={errors.email ? "email-error" : undefined}
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                id="email"
                placeholder="you@example.com"
                type="email"
                {...register("email")}
              />
            </div>
            {errors.email ? (
              <p
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                id="email-error"
              >
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="mb-2.5 block text-[15px] font-semibold text-slate-800 dark:text-slate-100"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <FiLock
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                size={20}
              />
              <input
                aria-describedby={errors.password ? "password-error" : undefined}
                aria-invalid={Boolean(errors.password)}
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-11 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                id="password"
                placeholder="Enter your password"
                type={isPasswordVisible ? "text" : "password"}
                {...register("password")}
              />
              <button
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                type="button"
              >
                {isPasswordVisible ? <FiEye size={19} /> : <FiEyeOff size={19} />}
              </button>
            </div>
            {errors.password ? (
              <p
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                id="password-error"
              >
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {errors.root?.message ? (
            <p
              aria-live="polite"
              className="text-sm font-medium text-red-600 dark:text-red-400"
            >
              {errors.root.message}
            </p>
          ) : null}

          <button
            className="h-11 w-full rounded-lg bg-blue-600 text-[14px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-center text-[13px] text-slate-500 dark:text-slate-400">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span>Don&apos;t have an account?</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="text-center">
          <Link
            className="text-[14px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            href="/register"
          >
            Create one
          </Link>
        </div>
      </section>

      <DiceFooter />
    </PageContainer>
  );
}

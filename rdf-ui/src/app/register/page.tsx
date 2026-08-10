"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
} from "react-icons/fi";
import DiceFooter from "@/components/DiceFooter";
import PageContainer from "@/components/PageContainer";
import SiteHeader from "@/components/SiteHeader";
import PrivacyPolicy from "@/components/legal/PrivacyPolicy";
import TermsOfUse from "@/components/legal/TermsOfUse";
import { useTheme } from "@/hooks/useTheme";
import {
  registrationSchema,
  type RegistrationFormValues,
} from "@/lib/registration";

type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  registration: UseFormRegisterReturn;
  error?: string;
};

function PasswordField({
  id,
  label,
  placeholder,
  registration,
  error,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <label
        className="mb-2.5 block text-[15px] font-semibold text-slate-800 dark:text-slate-100"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <FiLock
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
          size={20}
        />
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="new-password"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-11 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          id={id}
          minLength={8}
          placeholder={placeholder}
          required
          type={isVisible ? "text" : "password"}
          {...registration}
        />
        <button
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={() => setIsVisible((visible) => !visible)}
          type="button"
        >
          {isVisible ? <FiEye size={19} /> : <FiEyeOff size={19} />}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { isDark, setTheme } = useTheme();
  const [showLegalTerms, setShowLegalTerms] = useState(false);
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  async function submitRegistration(values: RegistrationFormValues) {
    clearErrors("root");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        setError("root", {
          message:
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to create the account. Please try again.",
        });
        return;
      }

      try {
        const signInResult = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
          callbackUrl: "/",
        });

        if (!signInResult?.ok) {
          setError("root", {
            message: "Your account was created, but automatic sign-in failed. Please sign in.",
          });
          return;
        }

        router.replace("/");
      } catch {
        setError("root", {
          message: "Your account was created, but automatic sign-in failed. Please sign in.",
        });
      }
    } catch {
      setError("root", {
        message: "Unable to reach the server. Please try again.",
      });
    }
  }

  return (
    <PageContainer className="flex min-h-screen flex-col text-slate-950 transition-colors dark:text-white">
        <SiteHeader
          isDark={isDark}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        />

        <section className="mx-auto mt-10 w-full max-w-[480px] rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-7 sm:py-7 lg:mt-12">
          <div className="mb-5 text-center">
            <h1 className="text-[25px] font-bold tracking-[-0.025em] text-slate-950 dark:text-white sm:text-[27px]">
              Create an account
            </h1>
            <p className="mt-1 text-[14px] text-slate-500 dark:text-slate-400 sm:text-[15px]">
              Register to use attachments feature
            </p>
          </div>

          <form className="space-y-3.5" onSubmit={handleSubmit(submitRegistration)} noValidate>
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
                  required
                  type="email"
                  {...register("email")}
                />
              </div>
              {errors.email ? (
                <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" id="email-error">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <PasswordField
              error={errors.password?.message}
              id="password"
              label="Password"
              placeholder="Enter your password"
              registration={register("password")}
            />
            <PasswordField
              error={errors.confirmPassword?.message}
              id="confirmPassword"
              label="Confirm password"
              placeholder="Confirm your password"
              registration={register("confirmPassword")}
            />

            <div className="flex items-start gap-2.5 pt-1 text-[14px] font-medium text-slate-800 dark:text-slate-200">
              <input
                aria-describedby={errors.terms ? "terms-error" : undefined}
                aria-invalid={Boolean(errors.terms)}
                aria-label="Agree to the Terms of Use and acknowledge the Privacy Policy"
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
                id="terms"
                type="checkbox"
                {...register("terms")}
              />
              <button
                aria-controls="legal-terms"
                aria-expanded={showLegalTerms}
                className="text-left underline decoration-slate-500/50 underline-offset-2 transition hover:text-blue-700 dark:hover:text-blue-300"
                onClick={() => setShowLegalTerms((visible) => !visible)}
                type="button"
              >
                I agree to the Terms of Use and acknowledge the Privacy Policy
              </button>
            </div>
            {errors.terms ? (
              <p className="text-xs font-medium text-red-600 dark:text-red-400" id="terms-error">
                {errors.terms.message}
              </p>
            ) : null}

            {showLegalTerms ? (
              <div
                className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                id="legal-terms"
              >
                <TermsOfUse headingLevel="h2" />
                <PrivacyPolicy headingLevel="h2" />
              </div>
            ) : null}

            {errors.root?.message ? (
              <p aria-live="polite" className="text-sm font-medium text-red-600 dark:text-red-400">
                {errors.root.message}
              </p>
            ) : null}
            <button
              className="h-11 w-full rounded-lg bg-blue-600 text-[14px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating account..." : "Create an account"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-center text-[13px] text-slate-500 dark:text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span>Already have an account?</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="text-center">
            <Link
              className="text-[14px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </section>

        <DiceFooter />
    </PageContainer>
  );
}

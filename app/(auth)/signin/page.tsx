"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleBlur(field: string, value: string, label: string) {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [field]: `${label} Cannot Be Empty` }));
    } else {
      setErrors((prev) => {
        const copy = { ...prev };
        if (copy[field] === `${label} Cannot Be Empty`) delete copy[field];
        return copy;
      });
    }
  }

  function validateFields(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");

    if (!validateFields()) return;

    setIsSubmitting(true);

    // Server Action will be wired in separately.
    setIsSubmitting(false);
  }

  return (
    <>
      <div className="auth-card__header">
        <h1 className="auth-card__title">Sign in</h1>
        <p className="auth-card__subtitle">
          Welcome back
        </p>
      </div>

      {serverError && (
        <div className="message message--error" role="alert">
          {serverError}
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="signin-email" className="form-field__label">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            className={`form-field__input${errors.email ? " form-field__input--error" : ""}`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email === "Email Cannot Be Empty") {
                setErrors((prev) => { const copy = { ...prev }; delete copy.email; return copy; });
              }
            }}
            onBlur={() => handleBlur("email", email, "Email")}
            autoComplete="email"
            aria-describedby={errors.email ? "signin-email-error" : undefined}
          />
          {errors.email && (
            <span id="signin-email-error" className="form-field__error" role="alert">
              {errors.email}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="signin-password" className="form-field__label">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            className={`form-field__input${errors.password ? " form-field__input--error" : ""}`}
            placeholder="Your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password === "Password Cannot Be Empty") {
                setErrors((prev) => { const copy = { ...prev }; delete copy.password; return copy; });
              }
            }}
            onBlur={() => handleBlur("password", password, "Password")}
            autoComplete="current-password"
            aria-describedby={
              errors.password ? "signin-password-error" : undefined
            }
          />
          {errors.password && (
            <span id="signin-password-error" className="form-field__error" role="alert">
              {errors.password}
            </span>
          )}
        </div>

        <div style={{ textAlign: "right", marginTop: `calc(-1 * var(--spacing-medium-spacing))` }}>
          <Link href="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
        </div>

        <button
          id="signin-submit"
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="auth-link">
          Create account
        </Link>
      </p>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validateFields()) return;

    setIsSubmitting(true);

    // Server Action will be wired in separately.
    // On completion, always show the same generic message per FR-3.2.
    setIsSubmitted(true);
    setIsSubmitting(false);
  }

  if (isSubmitted) {
    return (
      <>
        <div className="auth-card__header">
          <h1 className="auth-card__title">Check your email</h1>
          <p className="auth-card__subtitle">
            If an account exists for that email, a reset link has been sent.
          </p>
        </div>

        <Link href="/signin" className="btn btn--primary" style={{ marginTop: `var(--spacing-large-spacing)` }}>
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="auth-card__header">
        <h1 className="auth-card__title">Forgot password</h1>
        <p className="auth-card__subtitle">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="forgot-email" className="form-field__label">
            Email
          </label>
          <input
            id="forgot-email"
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
            aria-describedby={errors.email ? "forgot-email-error" : undefined}
          />
          {errors.email && (
            <span id="forgot-email-error" className="form-field__error" role="alert">
              {errors.email}
            </span>
          )}
        </div>

        <button
          id="forgot-submit"
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="auth-footer">
        Remember your password?{" "}
        <Link href="/signin" className="auth-link">
          Sign in
        </Link>
      </p>
    </>
  );
}

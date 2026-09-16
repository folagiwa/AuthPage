"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // FR-4.1: If no token is in the URL, show error state
  if (!token) {
    return (
      <>
        <div className="auth-card__header">
          <h1 className="auth-card__title">Invalid link</h1>
          <p className="auth-card__subtitle">
            This reset link is invalid or has expired.
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="btn btn--primary"
          style={{ marginTop: `var(--spacing-large-spacing)` }}
        >
          Request a new link
        </Link>
      </>
    );
  }

  if (isSuccess) {
    return (
      <>
        <div className="auth-card__header">
          <h1 className="auth-card__title">Password reset</h1>
          <p className="auth-card__subtitle">
            Your password has been reset successfully.
          </p>
        </div>

        <Link
          href="/signin"
          className="btn btn--primary"
          style={{ marginTop: `var(--spacing-large-spacing)` }}
        >
          Sign in
        </Link>
      </>
    );
  }

  function validateFields(): boolean {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/[a-zA-Z]/.test(password)) {
      newErrors.password = "Password must contain at least one letter";
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = "Password must contain at least one number";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
    // FR-4.3: Token re-validated server-side at submission time.
    setIsSubmitting(false);
  }

  return (
    <>
      <div className="auth-card__header">
        <h1 className="auth-card__title">Reset password</h1>
        <p className="auth-card__subtitle">Enter your new password</p>
      </div>

      {serverError && (
        <div className="message message--error" role="alert">
          {serverError}
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="reset-password" className="form-field__label">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            className={`form-field__input${errors.password ? " form-field__input--error" : ""}`}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby={
              errors.password ? "reset-password-error" : undefined
            }
          />
          {errors.password && (
            <span id="reset-password-error" className="form-field__error" role="alert">
              {errors.password}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="reset-confirm-password" className="form-field__label">
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            className={`form-field__input${errors.confirmPassword ? " form-field__input--error" : ""}`}
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby={
              errors.confirmPassword ? "reset-confirm-error" : undefined
            }
          />
          {errors.confirmPassword && (
            <span id="reset-confirm-error" className="form-field__error" role="alert">
              {errors.confirmPassword}
            </span>
          )}
        </div>

        <button
          id="reset-submit"
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Resetting…" : "Reset password"}
        </button>
      </form>

      <p className="auth-footer">
        <Link href="/signin" className="auth-link">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }

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
    // For now, simulate form readiness.
    setIsSubmitting(false);
  }

  return (
    <>
      <div className="auth-card__header">
        <h1 className="auth-card__title">Create account</h1>
        <p className="auth-card__subtitle">
          Enter your details to get started
        </p>
      </div>

      {serverError && (
        <div className="message message--error" role="alert">
          {serverError}
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="signup-name" className="form-field__label">
            Name
          </label>
          <input
            id="signup-name"
            type="text"
            className={`form-field__input${errors.name ? " form-field__input--error" : ""}`}
            placeholder="Your name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name === "Name Cannot Be Empty") {
                setErrors((prev) => { const copy = { ...prev }; delete copy.name; return copy; });
              }
            }}
            onBlur={() => handleBlur("name", name, "Name")}
            autoComplete="name"
            aria-describedby={errors.name ? "signup-name-error" : undefined}
          />
          {errors.name && (
            <span id="signup-name-error" className="form-field__error" role="alert">
              {errors.name}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="signup-email" className="form-field__label">
            Email
          </label>
          <input
            id="signup-email"
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
            aria-describedby={errors.email ? "signup-email-error" : undefined}
          />
          {errors.email && (
            <span id="signup-email-error" className="form-field__error" role="alert">
              {errors.email}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="signup-password" className="form-field__label">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            className={`form-field__input${errors.password ? " form-field__input--error" : ""}`}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password === "Password Cannot Be Empty") {
                setErrors((prev) => { const copy = { ...prev }; delete copy.password; return copy; });
              }
            }}
            onBlur={() => handleBlur("password", password, "Password")}
            autoComplete="new-password"
            aria-describedby={errors.password ? "signup-password-error" : undefined}
          />
          {errors.password && (
            <span id="signup-password-error" className="form-field__error" role="alert">
              {errors.password}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="signup-confirm-password" className="form-field__label">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            type="password"
            className={`form-field__input${errors.confirmPassword ? " form-field__input--error" : ""}`}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword === "Confirm password Cannot Be Empty") {
                setErrors((prev) => { const copy = { ...prev }; delete copy.confirmPassword; return copy; });
              }
            }}
            onBlur={() => handleBlur("confirmPassword", confirmPassword, "Confirm password")}
            autoComplete="new-password"
            aria-describedby={
              errors.confirmPassword ? "signup-confirm-error" : undefined
            }
          />
          {errors.confirmPassword && (
            <span id="signup-confirm-error" className="form-field__error" role="alert">
              {errors.confirmPassword}
            </span>
          )}
        </div>

        <button
          id="signup-submit"
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account?{" "}
        <Link href="/signin" className="auth-link">
          Sign in
        </Link>
      </p>
    </>
  );
}

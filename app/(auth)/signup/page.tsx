"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAccount } from "@/lib/actions/create-account";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEmail(val);
    
    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setErrors((prev) => ({ ...prev, email: "Enter A Valid Email Address" }));
    } else {
      setErrors((prev) => {
        const copy = { ...prev };
        if (copy.email === "Enter A Valid Email Address" || copy.email === "Email Cannot Be Empty") {
          delete copy.email;
        }
        return copy;
      });
    }
  }

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

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    try {
      const result = await createAccount(formData);
      if (result.error) setServerError(result.error);
      if (result.fieldErrors) setErrors(result.fieldErrors);
      
      if (result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Submit error:", err);
      setServerError("A network error occurred. Please ensure you are connected and try again.");
      setIsSubmitting(false);
    }
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
            onChange={handleEmailChange}
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
          <div style={{ position: "relative" }}>
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
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
              style={{ paddingRight: "40px" }}
            />
            {password.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px"
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            )}
          </div>
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
          <div style={{ position: "relative" }}>
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
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
              style={{ paddingRight: "40px" }}
            />
            {confirmPassword.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px"
                }}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            )}
          </div>
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

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // FR-5.5: 60-second resend cooldown with visible countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Allow only single digits
      if (value && !/^\d$/.test(value)) return;

      const newDigits = [...digits];
      newDigits[index] = value;
      setDigits(newDigits);
      setError("");

      // Auto-advance to next input
      if (value && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      // Move to previous input on backspace when current is empty
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    const pastedDigits = pastedData.split("").filter((c) => /^\d$/.test(c));

    if (pastedDigits.length === 0) return;

    const newDigits = [...digits];
    for (let i = 0; i < CODE_LENGTH && i < pastedDigits.length; i++) {
      newDigits[i] = pastedDigits[i];
    }
    setDigits(newDigits);
    setError("");

    // Focus the next empty input or the last one
    const nextEmpty = newDigits.findIndex((d) => !d);
    const focusIndex = nextEmpty === -1 ? CODE_LENGTH - 1 : nextEmpty;
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setIsSubmitting(true);
    setError("");

    // Server Action will be wired in separately.
    // FR-5.2: On correct code → set emailVerified, create session, redirect to dashboard.
    // FR-5.3: On incorrect code → show inline error.
    // FR-5.4: On expired code → prompt to request a new one.
    setIsSubmitting(false);
  }

  async function handleResend() {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError("");

    // Server Action will be wired in separately.
    // FR-5.5: Invalidate previous code, issue new one with fresh 15-minute expiry.
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setIsResending(false);
  }

  return (
    <>
      <div className="auth-card__header">
        <h1 className="auth-card__title">Verify your email</h1>
        <p className="auth-card__subtitle">
          Enter the 6-digit code sent to your email
        </p>
      </div>

      {error && (
        <div className="message message--error" role="alert">
          {error}
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="code-input-group" role="group" aria-label="Verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              id={`verify-digit-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className="code-input-group__digit"
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              autoComplete="one-time-code"
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        <button
          id="verify-submit"
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting || digits.join("").length !== CODE_LENGTH}
        >
          {isSubmitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <div className="resend-control">
        {resendCooldown > 0 ? (
          <p className="resend-control__timer">
            Resend code in {resendCooldown}s
          </p>
        ) : (
          <button
            id="verify-resend"
            type="button"
            className="auth-link"
            onClick={handleResend}
            disabled={isResending}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {isResending ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>

      <p className="auth-footer">
        <Link href="/signin" className="auth-link">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

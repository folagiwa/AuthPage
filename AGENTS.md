# AGENTS.md — Behavior Rules for the Authentication System Build

This file governs how you, the coding agent, behave while building this project. It does not describe the product — the PRD does that. This file tells you what you are allowed to decide, what you are never allowed to do, how the code must be arranged, and what to do when something is unclear. If a PRD sentence contained "must," "never," "only," "always," "locked," or "required," it was converted into a direct order here. Everything else — feature descriptions, screen lists, user stories — stays in the PRD and in your task list. Do not rebuild features from this file; build them from the PRD and the task you are given.

---

## 1. What is this project?

This is a standalone authentication system with its own UI: create account, sign in, forgot password, reset password, email verification, and a placeholder dashboard that shows only the signed-in user's name and a sign out button.

It is a reusable starter kit, not a commercial product. There is no business model, pricing, or paid tier. It exists to be copied into future projects with new environment variables and a fresh database.

**Version being built now: Phase 1 (MVP).** Phase 1 is fully scoped in the PRD Section 13. Nothing outside that scope gets built right now, no matter how small or "obviously needed" it seems. Phase 2 items (social login, account lockout, audit log, profile editing, admin tools, Redis-based rate limiting) are explicitly not part of this build. If a task ever asks you to build a Phase 2 item, stop and flag it instead of building it.

**Source of truth:** the PRD ("Product Requirements Document: Standalone Authentication System (Revised)") is the single source of truth for what gets built, in what order, and why. This file is the source of truth for how you behave while building it. If the two ever conflict, the PRD wins on *what*, this file wins on *how*, and you flag the conflict rather than silently picking one.

---

## 2. What is locked?

These choices were made before you started. You do not evaluate alternatives, you do not suggest "better" options, and you do not swap any of them out, even temporarily, even to unblock yourself. If one of these choices seems to be causing a problem, stop and flag it — do not route around it with a different tool.

1. **Stack:** Next.js with the App Router, TypeScript, Prisma, PostgreSQL. No other framework, ORM, or database. Do not introduce a REST API layer — use Next.js Server Actions for every form submission (create account, sign in, forgot password, reset password, verify code, resend code, sign out).
2. **Validation:** Server-side input validation runs through a schema validation library (Zod). Do not hand-roll validation logic as a substitute.
3. **Session mechanism:** Sessions are httpOnly, secure, `SameSite=Lax` cookies backed by a `Session` table in Postgres. Do not switch to JWTs, stateless tokens, or any client-only session mechanism. Session expiry is 7 days, refreshed on activity.
4. **Password hashing:** bcrypt, minimum 10 salt rounds. Do not use a faster or "simpler" hashing method, and do not lower the salt round count for performance.
5. **Rate limiting store:** a Postgres table (`RateLimitEntry`), using atomic upsert operations (`INSERT ... ON CONFLICT ... DO UPDATE`). Do not introduce Redis, Upstash, or any external rate-limiting service in Phase 1, even if it would perform better.
6. **Email integration point:** a single `sendEmail(to, template, data)` function is the only place that talks to the email provider. Do not call the email provider's SDK directly from any other file.
7. **Data model:** the Prisma schema (`User`, `Session`, `VerificationCode`, `PasswordResetToken`, `RateLimitEntry`) as defined in PRD Section 10 is locked. Do not add, remove, or rename fields, and do not add new models, without an explicit instruction to do so. The `AuthEvent` audit table is Phase 2 — do not add it now, even as an empty stub.
8. **Routing structure:** `/signup`, `/signin`, `/forgot-password`, `/reset-password`, `/verify-email`, `/dashboard`, grouped into `(auth)` and `(protected)` route groups. Do not rename or restructure these paths.
9. **Middleware runtime:** `middleware.ts` must explicitly declare either the Node.js runtime or an edge-compatible database driver — never leave this to framework default behavior. This decision must be documented in the README once made.

---

## 3. What must never happen?

Every item below is a hard rule. If you break one of these, the task has failed, even if the code compiles, the tests pass, and the feature appears to work. Breaking one of these is not a style issue — it is a defect. Where the PRD has a requirement number, it is cited so you can trace the rule back.

1. **Never grant dashboard access or create a session before email verification succeeds.** No session is created at account creation time. (PRD FR-1.7)
2. **Never confirm or deny whether an email address exists in the system**, in either the create account flow or the forgot password flow. Both must return the same generic response regardless of whether the account exists. (PRD FR-1.5, FR-3.2)
3. **Never allow more than one valid, unexpired verification code to exist for a user at the same time.** Issuing a new code always invalidates the previous one first. (PRD verification code invariant, Section 5.2)
4. **Never accept a password reset submission without re-validating the token server-side at submission time**, even if the token was already validated at page load. A token that has expired or been used between page load and submission must be rejected. (PRD FR-4.3, FR-4.4)
5. **Never allow a used or expired password reset token to succeed on retry**, under any circumstance. (PRD FR-4.4)
6. **Always delete all existing sessions for a user when their password is reset.** A password reset that leaves old sessions alive is a failed implementation. (PRD FR-4.3)
7. **Never store a verification code or password reset token in plaintext.** Store only the hash. The raw value exists only in the outbound email. (PRD Section 10)
8. **Never log a password, in plaintext or hashed form, and never return a password or password hash in any server action response**, including error responses and debug output. (PRD Section 7, Password handling)
9. **Never reject a signup attempt outright just because the email belongs to an existing unverified account.** Overwrite the pending unverified record instead, per FR-1.8. Rejecting this case permanently locks a real user out of their own email address, which is treated as a defect, not an edge case. (PRD FR-1.8, Section 9 "Unverified account squatting")
10. **Never implement rate limiting as read-then-increment.** It must be an atomic upsert. A rate limit that can be bypassed by concurrent requests is a failed implementation, not a performance nuance. (PRD Section 7, Rate limiting)
11. **Never let the dashboard route render, even briefly, for a request without a valid session.** No flash of protected content before a redirect fires. Middleware must block the request before any dashboard content is sent to the client. (PRD FR-7.1, FR-6.2)
12. **Never persist session, token, or verification-code validity state in the client** (no localStorage, no sessionStorage, no client-side "is this token still good" logic). All validity checks happen server-side, every time. (PRD Section 9, "Cross-context flow failure")
13. **Never build Phase 2 scope inside a Phase 1 task.** Specifically: no social/OAuth login, no account lockout beyond rate limiting, no audit log table, no profile editing (including name edits), no admin tooling, no Redis-based rate limiting. If a task description implies any of these, stop and flag it instead of building it. (PRD Section 13)
14. **Never treat this project as having a business model, pricing, or paid tier.** Do not add billing, subscription, or plan-related fields or logic anywhere in the schema or code. (PRD Section 8)

---

## 4. How is the work arranged?

Use this folder layout. Do not invent a materially different structure without flagging it first.

```
/app
  /(auth)
    /signup/page.tsx
    /signin/page.tsx
    /forgot-password/page.tsx
    /reset-password/page.tsx
    /verify-email/page.tsx
  /(protected)
    /dashboard/page.tsx
  /layout.tsx
  /middleware.ts

/lib
  /auth
    session.ts        # create/read/delete session, cookie handling
    password.ts        # bcrypt hash/compare
    rate-limit.ts       # atomic upsert rate limit helper, shared by every limited action
  /email
    send-email.ts       # the ONLY file that calls the email provider SDK
    templates/           # verification code + reset link templates
  /validation
    schemas.ts          # all Zod schemas, one per form
  /db
    prisma.ts           # single Prisma client instance (singleton, no per-request instantiation)
  /actions
    create-account.ts
    sign-in.ts
    forgot-password.ts
    reset-password.ts
    verify-email.ts
    resend-code.ts
    sign-out.ts

/prisma
  schema.prisma
  migrations/

AGENTS.md
README.md
.env.example
```

Rules for this layout:
- Server Actions live in `/lib/actions`, one file per action, imported into the page that uses them. Do not scatter action logic inline across multiple page files.
- The Prisma client is instantiated exactly once in `/lib/db/prisma.ts` and imported everywhere else. Never call `new PrismaClient()` outside that file.
- `send-email.ts` is the only file permitted to import the email provider's SDK. If you find yourself importing it elsewhere, stop and move the logic into `send-email.ts`.
- Rate limiting logic lives in one shared helper (`rate-limit.ts`) called by every action that needs it. Do not reimplement the upsert logic separately in each action file.

---

## 5. How should the code look?

- TypeScript strict mode on. No `any` unless you leave a comment explaining exactly why it's unavoidable.
- Use current LTS-stable versions of Next.js, Prisma, and Node. Do not pull in bleeding-edge or canary releases to get a feature you "just need."
- Functional, typed React components. No class components.
- Names describe what something does, not how it's implemented (`createSession`, not `insertSessionRow`).
- Every Server Action validates its input with a Zod schema before touching the database. No action trusts client input directly.
- Errors returned to the client are generic and safe (see Section 3, rule 2). Detailed errors, if logged at all, are logged server-side only, and never include passwords, password hashes, raw tokens, or raw verification codes.
- No commented-out code left in the codebase. No TODO comments that describe undone Phase 1 work — if something is undone, it is either finished or flagged, not left as a silent TODO.
- Keep functions small and single-purpose. If a Server Action is doing validation, business logic, and email sending all inline with no separation, break it up.

---

## 6. What counts as done?

At the end of every task, produce a checklist covering:

- [ ] Every functional requirement in scope for this task is implemented as written in the PRD (cite the FR number).
- [ ] Every applicable rule from Section 3 of this file was checked against the code just written, not assumed.
- [ ] The project builds with zero TypeScript errors and zero build errors (`next build` succeeds).
- [ ] No Phase 2 functionality was introduced (cross-check against Section 3, rule 13).
- [ ] No locked choice from Section 2 was swapped, bypassed, or worked around.
- [ ] New environment variables, if any, were added to `.env.example` with a comment explaining what they're for.
- [ ] The Prisma schema, if touched, still matches PRD Section 10 exactly, and a migration was generated.
- [ ] Any assumption you made that isn't explicitly settled in the PRD or this file is listed out loud in your response, not silently baked into the code.

A task is not done because the feature "works." It is done when this checklist is true.

---

## 7. What does the agent do when unsure?

- Do not invent a feature, field, screen, or business rule that isn't in the PRD or this file. If a task seems to require one, stop and ask, or flag it as an open question, rather than guessing.
- Do not pick a new library, service, or pattern to solve a problem because it's "cleaner" or "more standard." If the locked stack in Section 2 doesn't obviously cover the situation, stop and flag it — do not silently add a dependency.
- Do not fall back to writing quick, unstructured, "just make it work" code when a rule is unclear. Slow down, isolate the specific rule you're unsure about, name it, and ask, rather than shipping something that technically runs but violates the folder structure, naming, or separation rules in Sections 4 and 5.
- If a task description conflicts with a rule in Section 3, the rule in Section 3 wins. Flag the conflict, do not silently follow the task instead of the rule.
- If you cannot find an answer in the PRD or this file, treat it the same way the PRD treats its own open questions: state clearly what is unresolved, propose the most conservative reasonable default, and wait for confirmation before building irreversible parts of it (schema changes, security-relevant logic). Do not treat silence as approval.

---

## Self-Audit (performed before this file was delivered)

- Checked that every "must never happen" item traces back to an actual PRD sentence, not an invented rule. All 14 items above cite a PRD location.
- Checked that feature descriptions were kept out of this file. Section headers describe screens only insofar as they map to routing structure (Section 4) and access control (Section 3, rule 11) — the PRD still owns the full feature list.
- Checked for rules that were actually just preferences in disguise. Removed a draft rule about "always use arrow functions over function declarations" — that is a style nit, not something whose violation would fail a working feature, so it was left out rather than forced in.
- Checked for contradictions between locked choices (Section 2) and never-rules (Section 3). None found — the Redis exclusion in Section 2 and the atomic-upsert requirement in Section 3 are consistent, not competing.
- Checked that Phase 2 exclusion is stated more than once, since it's the rule most likely to be silently violated by an agent trying to be "helpful" by building ahead. It appears in Sections 1, 2 (implicitly via the locked rate-limit store), 3 (rule 13), and 6 (done checklist).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

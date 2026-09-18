import { Resend } from "resend";
import { renderVerificationCodeEmail } from "./templates/verification-code";
import { renderResetLinkEmail } from "./templates/reset-link";

export type EmailTemplate = "verification-code" | "reset-link";

const EMAIL_FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

function renderEmail(
  template: EmailTemplate,
  data: Record<string, string>
): { subject: string; html: string } {
  switch (template) {
    case "verification-code":
      return renderVerificationCodeEmail({ code: data.code ?? "" });
    case "reset-link":
      return renderResetLinkEmail({ resetUrl: data.resetUrl ?? "" });
  }
}

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, string>
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n=================== EMAIL FALLBACK ===================`);
      console.log(`TO: ${to}`);
      console.log(`TEMPLATE: ${template}`);
      console.log(`DATA: ${JSON.stringify(data)}`);
      console.log(`======================================================\n`);
      return;
    }
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { subject, html } = renderEmail(template, data);

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

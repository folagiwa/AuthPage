export function renderResetLinkEmail(data: {
  resetUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Reset your password",
    html: [
      '<div style="font-family: sans-serif; line-height: 1.5; color: #1a1a1a;">',
      "<p>Click the link below to reset your password.</p>",
      '<p style="margin: 24px 0;">',
      `<a href="${data.resetUrl}" style="color: #2563eb;">Reset password</a>`,
      "</p>",
      "<p>This link expires in 1 hour.</p>",
      "</div>",
    ].join(""),
  };
}

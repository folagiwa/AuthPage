export function renderVerificationCodeEmail(data: {
  code: string;
}): { subject: string; html: string } {
  return {
    subject: "Your verification code",
    html: [
      '<div style="font-family: sans-serif; line-height: 1.5; color: #1a1a1a;">',
      "<p>Use the code below to verify your email address.</p>",
      `<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${data.code}</p>`,
      "<p>This code expires in 15 minutes.</p>",
      "</div>",
    ].join(""),
  };
}

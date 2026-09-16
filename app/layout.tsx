import type { Metadata } from "next";
import "../design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auth",
  description: "Standalone authentication system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

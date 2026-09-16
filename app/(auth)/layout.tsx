export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-wrapper">
      <div className="auth-card">{children}</div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "@/lib/actions/sign-out";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-shell">
        <h1 className="dashboard-shell__greeting">
          Welcome, {user.name}
        </h1>
        <form action={signOut}>
          <button
            id="dashboard-signout"
            type="submit"
            className="btn btn--secondary"
            style={{ width: "auto", display: "inline-flex" }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

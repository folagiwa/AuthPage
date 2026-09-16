export default function DashboardPage() {
  // Placeholder: user name will come from the session once auth is wired.
  // FR-6.1: Displays the signed-in user's name and a sign out button. No other content.
  const userName = "User";

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-shell">
        <h1 className="dashboard-shell__greeting">
          Welcome, {userName}
        </h1>
        <form>
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

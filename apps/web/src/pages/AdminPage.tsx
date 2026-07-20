import {
  Activity,
  Database,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

const adminNav = [
  [LayoutDashboard, "Overview", "/admin"],
  [Shield, "Gangs", "/gangs"],
  [Users, "Players", "/players"],
  [Trophy, "Tournaments", "/tournaments"],
  [Swords, "Matches", "/matches"],
  [ListChecks, "Rankings", "/rankings"],
] as const;

const metricLabels = {
  totalGangs: "Total gangs",
  activeGangs: "Active gangs",
  totalPlayers: "Players",
  activeTournaments: "Live tournaments",
  upcomingMatches: "Upcoming matches",
  awaitingResults: "Awaiting results",
  disputedMatches: "Disputed matches",
  pendingMedia: "Pending media",
} as const;

export default function AdminPage() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: api.adminOverview,
    retry: false,
  });

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          <span>M</span>
          <div>
            MAFIA NETWORK<small>Administration</small>
          </div>
        </Link>
        <nav>
          {adminNav.map(([Icon, label, to], index) => (
            <Link key={label} to={to} className={index === 0 ? "active" : ""}>
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-source">
          <Shield />
          All data is sourced from the API
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <span>Authenticated operations</span>
          <Button asChild variant="ghost">
            <Link to="/">Public site</Link>
          </Button>
        </header>

        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <h1>Command Center</h1>
              <p>
                Real-time operational overview of the criminal network platform.
              </p>
            </div>
            <Button asChild>
              <Link to="/tournaments">Open tournament registry</Link>
            </Button>
          </div>

          {overview.isPending ? (
            <PageSkeleton />
          ) : overview.isError ? (
            <section className="admin-access">
              <LockKeyhole />
              <h2>Administrative session required</h2>
              <p>
                The command center does not expose operational data without a
                server-authorized role.
              </p>
              <Button asChild>
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"}/api/v1/auth/discord`}
                >
                  Continue with Discord
                </a>
              </Button>
              <ErrorState compact retry={() => void overview.refetch()} />
            </section>
          ) : (
            <>
              <section className="admin-metrics" aria-label="Platform metrics">
                {Object.entries(overview.data.data.summary).map(
                  ([key, value]) => (
                    <article key={key}>
                      <span>
                        {metricLabels[key as keyof typeof metricLabels]}
                      </span>
                      <strong>{value.toLocaleString()}</strong>
                    </article>
                  ),
                )}
              </section>

              <section className="admin-grid">
                <div>
                  <h2>Recent audited activity</h2>
                  {overview.data.data.activity.length === 0 ? (
                    <EmptyState title="No audited activity yet" />
                  ) : (
                    <ol className="admin-activity">
                      {overview.data.data.activity.map((entry) => (
                        <li key={entry.id}>
                          <div>
                            <strong>{entry.action}</strong>
                            <span>{entry.entityType}</span>
                          </div>
                          <small>
                            {entry.actor?.displayName ?? "System"} ·{" "}
                            {new Date(entry.createdAt).toLocaleString()}
                          </small>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <h2>System health</h2>
                  <div className="health-list">
                    <span>
                      <Database />
                      Database<strong>Connected</strong>
                    </span>
                    <span>
                      <Activity />
                      API<strong>Healthy</strong>
                    </span>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

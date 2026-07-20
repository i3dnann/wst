import {
  ArrowRight,
  Crosshair,
  Shield,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const summaryItems = [
  [Users, "registeredGangs", "Registered gangs"],
  [UserRound, "registeredPlayers", "Registered players"],
  [Swords, "completedMatches", "Completed matches"],
  [Trophy, "activeTournament", "Active tournament"],
] as const;

export default function HomePage() {
  const home = useQuery({
    queryKey: ["home"],
    queryFn: api.home,
    retry: false,
  });
  const data = home.data?.data;

  return (
    <main>
      <section className="wst-hero">
        <img
          className="wst-hero-media"
          src="/assets/wst/world-star-banner.gif"
          alt="World Star patrol vehicles in a dark forest"
        />
        <div className="wst-hero-vignette" aria-hidden="true" />
        <div className="wst-tech-rail wst-tech-rail--left" aria-hidden="true" />
        <div
          className="wst-tech-rail wst-tech-rail--right"
          aria-hidden="true"
        />

        <div className="wst-hero-copy">
          <img
            className="wst-hero-mark"
            src="/assets/wst/wst-round.png"
            alt=""
          />
          <h1>WORLD STAR</h1>
          <p>Every name. Every crew. Every victory. Recorded.</p>
          <div className="wst-hero-actions">
            <Button asChild size="lg">
              <Link to="/gangs">
                Explore the Network <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/tournaments">
                View Tournaments <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>

        <div className="wst-summary-rail">
          {summaryItems.map(([Icon, key, label]) => (
            <div key={key} className="wst-summary-item">
              <Icon />
              <div>
                <strong>
                  {data ? data.summary[key].toLocaleString() : "—"}
                </strong>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="intelligence-section" id="network-intelligence">
        <div className="section-title-row">
          <div>
            <Crosshair />
            <h2>NETWORK INTELLIGENCE</h2>
          </div>
          <Link to="/rankings">
            Full Rankings <ArrowRight />
          </Link>
        </div>

        <div className="intelligence-grid">
          <section className="intel-table" aria-labelledby="leading-gangs">
            <h3 id="leading-gangs">Leading Gangs</h3>
            <div className="intel-table-head">
              <span>Rank</span>
              <span>Gang</span>
              <span>Members</span>
              <span>W/L</span>
              <span>Points</span>
            </div>
            {data?.rankings.length ? (
              <ol className="intel-ranking-list">
                {data.rankings.slice(0, 5).map((gang, index) => (
                  <li key={gang.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Link to={`/gangs/${gang.slug}`}>
                      {gang.logoUrl ? (
                        <img src={gang.logoUrl} alt="" />
                      ) : (
                        <Shield />
                      )}
                      <strong>{gang.name}</strong>
                    </Link>
                    <span>{gang.memberCount}</span>
                    <span>
                      {gang.wins}/{gang.losses}
                    </span>
                    <span>{gang.kills}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="wst-empty-state">
                <Crosshair />
                <p>No verified gang records yet.</p>
              </div>
            )}
          </section>

          <aside className="tournament-watch">
            <h3>Tournament Watch</h3>
            <img src="/assets/wst/wst-round.png" alt="World Star emblem" />
            <strong>
              {data?.summary.activeTournament
                ? `${String(data.summary.activeTournament)} active`
                : "No active tournament"}
            </strong>
            <Button asChild variant="outline">
              <Link to="/tournaments">View Tournaments</Link>
            </Button>
          </aside>
        </div>

        <section className="recent-results">
          <div>
            <h3>Recent Results</h3>
            <Link to="/matches">
              All Matches <ArrowRight />
            </Link>
          </div>
          <div className="wst-empty-state wst-empty-state--compact">
            <Swords />
            <p>
              {data?.recentMatches.length
                ? `${String(data.recentMatches.length)} finalized records available.`
                : "Finalized matches will appear here."}
            </p>
          </div>
        </section>
      </section>

      <section className="rules-band">
        <div>
          <Shield />
          <div>
            <h2>Rules of Engagement</h2>
            <p>
              Every published result, roster change, and ranking update follows
              one accountable record.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/rules">Read the Rules</Link>
        </Button>
      </section>
    </main>
  );
}

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/data/StatusState";
import { api } from "@/lib/api";

interface GangRef {
  id: string;
  name: string;
  tag?: string;
  logoUrl: string | null;
}

interface BracketMatchRecord {
  id: string;
  position: number | null;
  gangA: GangRef | null;
  gangB: GangRef | null;
  gangAScore: number | null;
  gangBScore: number | null;
  winnerGangId: string | null;
  status: string;
  scheduledAt: string | null;
}

interface BracketRoundRecord {
  id: string;
  name: string;
  roundNumber: number;
  matches: BracketMatchRecord[];
}

interface TournamentRecord {
  name: string;
  description: string | null;
  format: string;
  status: string;
  startAt: string;
  endAt: string | null;
  maximumParticipants: number;
  participants: unknown[];
  rules: string | null;
}

function TeamRow({
  gang,
  score,
  winner,
}: {
  gang: GangRef | null;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div
      className={winner ? "bracket-team bracket-team--winner" : "bracket-team"}
    >
      {gang?.logoUrl ? <img src={gang.logoUrl} alt="" /> : <Shield />}
      <span>{gang?.name ?? "TBD"}</span>
      <strong>{score ?? "—"}</strong>
    </div>
  );
}

export default function TournamentDetailPage() {
  const { slug = "" } = useParams();
  const [activeRound, setActiveRound] = useState(0);
  const [tournament, bracket] = useQueries({
    queries: [
      {
        queryKey: ["tournament", slug],
        queryFn: () => api.tournament(slug),
        enabled: Boolean(slug),
      },
      {
        queryKey: ["bracket", slug],
        queryFn: () => api.bracket(slug),
        enabled: Boolean(slug),
      },
    ],
  });
  if (tournament.isPending || bracket.isPending) return <PageSkeleton />;
  if (tournament.isError || bracket.isError) {
    return (
      <main className="page-shell">
        <ErrorState
          retry={() => {
            void tournament.refetch();
            void bracket.refetch();
          }}
        />
      </main>
    );
  }

  const data = tournament.data.data as unknown as TournamentRecord;
  const rounds = bracket.data.data.rounds as BracketRoundRecord[];
  const start = new Date(data.startAt).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
  const end = data.endAt
    ? new Date(data.endAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : null;

  return (
    <main className="gold-content-page tournament-detail-gold">
      <header className="tournament-gold-header">
        <div>
          <Button asChild variant="ghost">
            <Link to="/tournaments">
              <ArrowLeft /> Back to Tournaments
            </Link>
          </Button>
          <h1>{data.name}</h1>
          <div className="tournament-gold-meta">
            <span
              className={`event-status event-status--${data.status.toLowerCase()}`}
            >
              {data.status.replaceAll("_", " ")}
            </span>
            <span>
              <CalendarDays /> {start}
              {end ? ` — ${end}` : ""}
            </span>
            <span>
              <Users /> {data.maximumParticipants} entrant capacity
            </span>
            <span>
              <Swords /> {data.format.replaceAll("_", " ")}
            </span>
          </div>
        </div>
        <img src="/assets/wst/wst-logo.png" alt="World Star" />
      </header>

      {rounds.length ? (
        <>
          <nav className="bracket-round-tabs" aria-label="Bracket rounds">
            {rounds.map((round, index) => (
              <button
                type="button"
                className={activeRound === index ? "active" : ""}
                onClick={() => setActiveRound(index)}
                key={round.id}
              >
                {round.name}
              </button>
            ))}
          </nav>
          <section
            className="football-bracket"
            aria-label={`${data.name} tournament bracket`}
          >
            <div className="football-bracket-scroll">
              {rounds.map((round, roundIndex) => (
                <section
                  className={
                    activeRound === roundIndex
                      ? "bracket-round active"
                      : "bracket-round"
                  }
                  key={round.id}
                  aria-labelledby={`round-${round.id}`}
                >
                  <header>
                    <span>Round {round.roundNumber}</span>
                    <h2 id={`round-${round.id}`}>{round.name}</h2>
                  </header>
                  <div className="bracket-match-stack">
                    {round.matches.map((match) => (
                      <article
                        className={`football-match football-match--${match.status.toLowerCase()}`}
                        key={match.id}
                      >
                        <div className="football-match-status">
                          <span>{match.position ?? "—"}</span>
                          <strong>{match.status.replaceAll("_", " ")}</strong>
                        </div>
                        <TeamRow
                          gang={match.gangA}
                          score={match.gangAScore}
                          winner={match.winnerGangId === match.gangA?.id}
                        />
                        <TeamRow
                          gang={match.gangB}
                          score={match.gangBScore}
                          winner={match.winnerGangId === match.gangB?.id}
                        />
                        {match.scheduledAt ? (
                          <time dateTime={match.scheduledAt}>
                            {new Date(match.scheduledAt).toLocaleString()}
                          </time>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <p className="bracket-scroll-cue">
              Swipe or scroll horizontally to follow the road to the final.
            </p>
          </section>
        </>
      ) : (
        <section className="bracket-empty-gold">
          <Trophy />
          <h2>The bracket has not been seeded</h2>
          <p>
            The administrator can add any approved number of gangs, set their
            seeds, and generate the complete elimination bracket with automatic
            byes.
          </p>
        </section>
      )}

      <aside className="tournament-info-rail">
        <div>
          <Trophy />
          <span>Format</span>
          <strong>{data.format.replaceAll("_", " ")}</strong>
        </div>
        <div>
          <Users />
          <span>Entrants</span>
          <strong>
            {data.participants.length} / {data.maximumParticipants}
          </strong>
        </div>
        <div>
          <CalendarDays />
          <span>Start</span>
          <strong>{start}</strong>
        </div>
        <div>
          <Swords />
          <span>Bracket</span>
          <strong>
            {rounds.length
              ? `${String(rounds.length)} rounds`
              : "Not generated"}
          </strong>
        </div>
      </aside>
    </main>
  );
}

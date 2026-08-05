import { useState, type CSSProperties } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  Gift,
  Medal,
  Megaphone,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/data/StatusState";
import { ChampionCelebration } from "@/components/effects/ChampionCelebration";
import { MatchCountdown } from "@/components/matches/MatchCountdown";
import { useDragScroll } from "@/hooks/useDragScroll";
import { api } from "@/lib/api";

interface GangRef {
  id: string;
  name: string;
  tag?: string;
  logoUrl: string | null;
  primaryColor?: string | null;
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
  prizeDescription: string | null;
  prizes: TournamentPrizeRecord[];
}

interface TournamentPrizeRecord {
  id: string;
  placement: number;
  itemOrder?: number;
  title: string;
  amount: string;
  imageUrl: string | null;
}

interface BracketRecord {
  version: number;
  rounds: BracketRoundRecord[];
}

function TeamRow({
  gang,
  score,
  winner,
  revealDelay,
}: {
  gang: GangRef | null;
  score: number | null;
  winner: boolean;
  revealDelay: number;
}) {
  const gangColor = /^#[0-9a-f]{6}$/i.test(gang?.primaryColor ?? "")
    ? gang?.primaryColor
    : "#6c90c3";
  return (
    <div
      className={`bracket-team ${gang ? "bracket-team--gang" : "bracket-team--tbd"}${winner ? " bracket-team--winner" : ""}`}
      style={
        {
          "--gang-color": gangColor,
          "--team-reveal-delay": `${String(revealDelay)}ms`,
        } as CSSProperties
      }
    >
      {gang?.logoUrl ? (
        <img className="user-media-original" src={gang.logoUrl} alt="" />
      ) : (
        <Shield />
      )}
      <span className="bracket-team__name">{gang?.name ?? "TBD"}</span>
      <strong>{score ?? "—"}</strong>
    </div>
  );
}

export default function TournamentDetailPage() {
  const { slug = "" } = useParams();
  const [activeRound, setActiveRound] = useState(0);
  const { dragHandlers, isDragging } = useDragScroll<HTMLDivElement>();
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
  const bracketData = bracket.data.data as BracketRecord;
  const rounds = [...bracketData.rounds].sort(
    (left, right) => left.roundNumber - right.roundNumber,
  );
  const finalRound = rounds.reduce<BracketRoundRecord | undefined>(
    (latest, round) =>
      !latest || round.roundNumber > latest.roundNumber ? round : latest,
    undefined,
  );
  const finalMatch =
    finalRound?.matches.find((match) => match.winnerGangId !== null) ??
    finalRound?.matches[0];
  const champion = finalMatch
    ? finalMatch.winnerGangId === finalMatch.gangA?.id
      ? finalMatch.gangA
      : finalMatch.winnerGangId === finalMatch.gangB?.id
        ? finalMatch.gangB
        : null
    : null;
  const start = new Date(data.startAt).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
  const end = data.endAt
    ? new Date(data.endAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : null;
  const rules = (data.rules ?? "")
    .split(/\r?\n+/)
    .map((rule) => rule.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s*)/, ""))
    .filter(Boolean)
    .slice(0, 20);
  const prizes = [...(Array.isArray(data.prizes) ? data.prizes : [])]
    .filter((prize) => [1, 2, 3].includes(prize.placement))
    .sort(
      (left, right) =>
        left.placement - right.placement ||
        (left.itemOrder ?? 0) - (right.itemOrder ?? 0),
    );
  const placementLabel = (placement: number) =>
    placement === 1
      ? "First place"
      : placement === 2
        ? "Second place"
        : "Third place";
  const prizeGroups = [1, 2, 3]
    .map((placement) => ({
      placement,
      label: placementLabel(placement),
      items: prizes.filter((prize) => prize.placement === placement),
    }))
    .filter((group) => group.items.length > 0);
  const prizeAnnouncement = data.prizeDescription?.trim() ?? "";
  const prizeTickerStyle = {
    "--prize-ticker-duration": `${String(Math.max(18, Math.min(48, prizeAnnouncement.length * 0.2)))}s`,
  } as CSSProperties;

  return (
    <main className="gold-content-page tournament-detail-gold">
      {champion && finalMatch ? (
        <ChampionCelebration
          celebrationId={`${slug}:${String(bracketData.version)}:${finalMatch.id}:${champion.id}`}
          tournamentName={data.name}
          winnerName={champion.name}
        />
      ) : null}
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
            <button
              type="button"
              className={activeRound === rounds.length ? "active" : ""}
              onClick={() => setActiveRound(rounds.length)}
            >
              Winner
            </button>
          </nav>
          <section
            className="football-bracket"
            aria-label={`${data.name} tournament bracket`}
          >
            <div
              className={`football-bracket-scroll${isDragging ? " is-dragging" : ""}`}
              {...dragHandlers}
            >
              {rounds.map((round, roundIndex) => (
                <section
                  className={
                    activeRound === roundIndex
                      ? "bracket-round active"
                      : "bracket-round"
                  }
                  key={round.id}
                  aria-labelledby={`round-${round.id}`}
                  style={
                    {
                      "--round-match-count": round.matches.length,
                    } as CSSProperties
                  }
                >
                  <header>
                    <span>Round {round.roundNumber}</span>
                    <h2 id={`round-${round.id}`}>{round.name}</h2>
                  </header>
                  <div className="bracket-match-stack">
                    {round.matches.map((match, matchIndex) => (
                      <div className="bracket-match-cell" key={match.id}>
                        <article
                          className={`football-match football-match--${match.status.toLowerCase()}`}
                        >
                          <div className="football-match-status">
                            <span>{match.position ?? "—"}</span>
                            <strong>{match.status.replaceAll("_", " ")}</strong>
                          </div>
                          <TeamRow
                            gang={match.gangA}
                            score={match.gangAScore}
                            winner={match.winnerGangId === match.gangA?.id}
                            revealDelay={(roundIndex * 2 + matchIndex) * 55}
                          />
                          <TeamRow
                            gang={match.gangB}
                            score={match.gangBScore}
                            winner={match.winnerGangId === match.gangB?.id}
                            revealDelay={(roundIndex * 2 + matchIndex) * 55 + 35}
                          />
                          {match.scheduledAt ? (
                            <>
                              <time dateTime={match.scheduledAt}>
                                {new Date(match.scheduledAt).toLocaleString()}
                              </time>
                              <MatchCountdown scheduledAt={match.scheduledAt} compact />
                            </>
                          ) : null}
                        </article>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <section
                className={
                  activeRound === rounds.length
                    ? "bracket-champion-lane active"
                    : "bracket-champion-lane"
                }
                aria-labelledby="bracket-winner-heading"
              >
                <header>
                  <span>Tournament</span>
                  <h2 id="bracket-winner-heading">Winner</h2>
                </header>
                <div className="bracket-champion-track">
                  <article
                    className={
                      champion
                        ? "bracket-champion-card bracket-champion-card--decided"
                        : "bracket-champion-card"
                    }
                  >
                    <Trophy aria-hidden="true" />
                    <span>{champion ? "Champion" : "Final winner"}</span>
                    <strong>{champion?.name ?? "Awaiting final"}</strong>
                  </article>
                </div>
              </section>
            </div>
            <p className="bracket-scroll-cue">
              Drag, swipe, or scroll to follow the road to the final.
            </p>
          </section>
        </>
      ) : (
        <section className="bracket-empty-gold">
          <Trophy />
          <h2>The bracket has not been seeded</h2>
        </section>
      )}

      <section
        className={
          prizes.length
            ? "tournament-prizes-public"
            : "tournament-prizes-public tournament-prizes-public--empty"
        }
        aria-labelledby="tournament-prizes-heading"
      >
        {prizeAnnouncement ? (
          <aside
            className="tournament-prize-announcement"
            aria-label="Tournament prize announcement"
          >
            <span className="tournament-prize-announcement__label">
              <Megaphone aria-hidden="true" /> Prize update
            </span>
            <div className="tournament-prize-announcement__viewport">
              <div
                className="tournament-prize-announcement__track"
                style={prizeTickerStyle}
              >
                <span>{prizeAnnouncement}</span>
                <span aria-hidden="true">{prizeAnnouncement}</span>
              </div>
            </div>
          </aside>
        ) : null}
        <header>
          <span className="tournament-prizes-public__icon">
            <Gift aria-hidden="true" />
          </span>
          <div>
            <span>Official prize pool</span>
            <h2 id="tournament-prizes-heading">Tournament Prizes</h2>
            <p>The rewards waiting at the end of the bracket.</p>
          </div>
          <strong>
            {prizes.length ? `${String(prizes.length)} rewards` : "Pending"}
          </strong>
        </header>
        {prizes.length ? (
          <div className="tournament-prize-podium">
            {prizeGroups.map((group) => (
              <article
                className={`tournament-prize-card tournament-prize-card--place-${String(group.placement)}`}
                key={group.placement}
              >
                <header className="tournament-prize-card__header">
                  <span>{String(group.placement).padStart(2, "0")}</span>
                  <div>
                    <strong>{group.label}</strong>
                    <small>
                      {String(group.items.length)} reward
                      {group.items.length === 1 ? "" : "s"}
                    </small>
                  </div>
                  <Medal aria-hidden="true" />
                </header>
                <div className="tournament-prize-card__items">
                  {group.items.map((prize) => (
                    <section
                      className="tournament-prize-public-item"
                      key={
                        prize.id ||
                        `${String(prize.placement)}-${String(prize.itemOrder)}`
                      }
                    >
                      <div className="tournament-prize-public-item__media">
                        {prize.imageUrl ? (
                          <img
                            className="user-media-original"
                            src={prize.imageUrl}
                            alt={`${prize.title} prize`}
                          />
                        ) : (
                          <Gift aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <span>Reward {String((prize.itemOrder ?? 0) + 1)}</span>
                        <h3>{prize.title}</h3>
                        <strong>{prize.amount}</strong>
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tournament-prizes-public__empty">
            <Trophy aria-hidden="true" />
            <div>
              <strong>The prize pool will be announced soon</strong>
              <p>Check back for the first, second, and third place rewards.</p>
            </div>
          </div>
        )}
      </section>

      <section
        className={
          rules.length
            ? "tournament-rules-public"
            : "tournament-rules-public tournament-rules-public--empty"
        }
        aria-labelledby="tournament-rules-heading"
      >
        <header>
          <span className="tournament-rules-public__icon">
            <BookOpen aria-hidden="true" />
          </span>
          <div>
            <span>Official competition guide</span>
            <h2 id="tournament-rules-heading">Tournament Rules</h2>
            <p>
              Review the tournament requirements before registration and
              check-in.
            </p>
          </div>
          <strong>
            {rules.length
              ? `${String(rules.length)} ${rules.length === 1 ? "rule" : "rules"}`
              : "Pending"}
          </strong>
        </header>
        {rules.length ? (
          <ol>
            {rules.map((rule, index) => (
              <li key={`${String(index)}-${rule}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{rule}</p>
                <Check aria-hidden="true" />
              </li>
            ))}
          </ol>
        ) : (
          <div className="tournament-rules-public__empty">
            <BookOpen aria-hidden="true" />
            <div>
              <strong>Rules have not been published yet</strong>
              <p>
                The tournament administrator will publish the official rules
                here before competition begins.
              </p>
            </div>
          </div>
        )}
      </section>

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

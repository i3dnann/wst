import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Search,
  Shield,
  Swords,
  Trophy,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { ApiEnvelope } from "@mafia/shared";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

const labels = {
  players: [
    "Player Registry",
    "Verified players and authoritative seasonal statistics.",
  ],
  "player-profile": [
    "Player Dossier",
    "Public identity, competitive history, achievements, and MVP awards.",
  ],
  matches: [
    "Match Archive",
    "Scheduled, live, disputed, and finalized competitive records.",
  ],
  "match-detail": [
    "Match Record",
    "Rosters, result, player statistics, and audit-safe status.",
  ],
} as const;

type RecordRow = Record<string, unknown> & { id: string };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function value(
  row: Record<string, unknown> | null,
  key: string,
  fallback = "—",
) {
  const item = row?.[key];
  return typeof item === "string" && item ? item : fallback;
}

function numberValue(
  row: Record<string, unknown> | null | undefined,
  key: string,
  fallback = 0,
): number {
  const item = row?.[key];
  return typeof item === "number" && Number.isFinite(item) ? item : fallback;
}

function displayValue(item: unknown, fallback = "—"): string {
  return typeof item === "string" || typeof item === "number"
    ? String(item)
    : fallback;
}

function array(value: unknown): RecordRow[] {
  return Array.isArray(value)
    ? value.filter((item): item is RecordRow => Boolean(record(item)?.id))
    : [];
}

const matchFilters = [
  "ALL",
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
] as const;

type MatchFilter = (typeof matchFilters)[number];

function matchStatus(row: RecordRow): string {
  return value(row, "status", "SCHEDULED").toUpperCase();
}

function matchesFilter(status: string, filter: MatchFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "SCHEDULED") {
    return ["SCHEDULED", "CHECK_IN_OPEN", "READY", "AWAITING_RESULT"].includes(
      status,
    );
  }
  if (filter === "COMPLETED") {
    return ["COMPLETED", "FORFEIT"].includes(status);
  }
  return status === filter;
}

function readableStatus(status: string): string {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PlayerList({ rows }: { rows: RecordRow[] }) {
  return (
    <section className="public-directory-grid">
      {rows.map((player) => {
        const memberships = array(player.memberships);
        const membership = memberships[0];
        const gang = record(membership?.gang);
        const stats = array(player.seasonStats)[0];
        return (
          <Link
            className="public-directory-card"
            to={`/players/${value(player, "slug", "")}`}
            key={player.id}
          >
            {typeof player.avatarUrl === "string" ? (
              <img src={player.avatarUrl} alt="" />
            ) : (
              <UserRound />
            )}
            <div>
              <span>{value(player, "status")}</span>
              <h2>{value(player, "displayName")}</h2>
              <p>{value(gang, "name", "Independent player")}</p>
            </div>
            <dl>
              <div>
                <dt>Matches</dt>
                <dd>{numberValue(stats, "matchesPlayed")}</dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd>{numberValue(stats, "wins")}</dd>
              </div>
              <div>
                <dt>Kills</dt>
                <dd>{numberValue(stats, "kills")}</dd>
              </div>
              <div>
                <dt>MVP</dt>
                <dd>{numberValue(stats, "mvpAwards")}</dd>
              </div>
            </dl>
          </Link>
        );
      })}
    </section>
  );
}

function PlayerProfile({ row }: { row: RecordRow }) {
  const memberships = array(row.memberships);
  const current = memberships.find((item) => item.active === true);
  const currentGang = record(current?.gang);
  const stats = array(row.seasonStats)[0];
  const matchStats = array(row.matchStats);
  const awards = array(row.awards);
  return (
    <section className="public-dossier">
      <header>
        {typeof row.avatarUrl === "string" ? (
          <img src={row.avatarUrl} alt="" />
        ) : (
          <UserRound />
        )}
        <div>
          <span>{value(row, "status")}</span>
          <h2>{value(row, "displayName")}</h2>
          <p>{value(row, "biography", "No biography has been published.")}</p>
        </div>
      </header>
      <div className="public-dossier-stats">
        <article>
          <Activity />
          <span>Matches</span>
          <strong>
            {numberValue(stats, "matchesPlayed", matchStats.length)}
          </strong>
        </article>
        <article>
          <Trophy />
          <span>Wins</span>
          <strong>{numberValue(stats, "wins")}</strong>
        </article>
        <article>
          <Swords />
          <span>Kills / deaths</span>
          <strong>
            {numberValue(stats, "kills")} / {numberValue(stats, "deaths")}
          </strong>
        </article>
        <article>
          <Shield />
          <span>Current gang</span>
          <strong>{value(currentGang, "name", "Independent")}</strong>
        </article>
      </div>
      <section>
        <h3>Recent match statistics</h3>
        {matchStats.length ? (
          <div className="public-record-list">
            {matchStats.map((stat) => {
              const match = record(stat.match);
              const tournament = record(match?.tournament);
              return (
                <article key={stat.id}>
                  <strong>
                    {value(tournament, "name", "Independent match")}
                  </strong>
                  <span>
                    {numberValue(stat, "kills")} K ·{" "}
                    {numberValue(stat, "deaths")} D ·{" "}
                    {numberValue(stat, "assists")} A
                  </span>
                  {stat.mvp ? <b>MVP</b> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No match statistics"
            message="Finalized player results will appear here."
          />
        )}
      </section>
      <section>
        <h3>Awards</h3>
        {awards.length ? (
          <div className="public-record-list">
            {awards.map((award) => (
              <article key={award.id}>
                <Trophy />
                <strong>{value(award, "type", "MVP")}</strong>
                <span>{value(award, "reason", "Competitive award")}</span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No awards yet" />
        )}
      </section>
    </section>
  );
}

function MatchList({ rows }: { rows: RecordRow[] }) {
  const [filter, setFilter] = useState<MatchFilter>("ALL");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const { filteredRows, upcomingCount, completedCount } = useMemo(() => {
    let upcoming = 0;
    let completed = 0;
    const visible: RecordRow[] = [];

    for (const match of rows) {
      const status = matchStatus(match);
      if (matchesFilter(status, "SCHEDULED")) upcoming += 1;
      if (matchesFilter(status, "COMPLETED")) completed += 1;

      const gangA = record(match.gangA);
      const gangB = record(match.gangB);
      const tournament = record(match.tournament);
      const haystack = [
        value(gangA, "name", ""),
        value(gangA, "tag", ""),
        value(gangB, "name", ""),
        value(gangB, "tag", ""),
        value(tournament, "name", ""),
      ]
        .join(" ")
        .toLowerCase();

      if (
        matchesFilter(status, filter) &&
        (!deferredSearch || haystack.includes(deferredSearch))
      ) {
        visible.push(match);
      }
    }

    return {
      filteredRows: visible,
      upcomingCount: upcoming,
      completedCount: completed,
    };
  }, [deferredSearch, filter, rows]);

  return (
    <section className="match-archive">
      <header className="match-archive__header">
        <div>
          <h1>Match Archive</h1>
          <p>Scheduled, live, disputed, and finalized competitive records.</p>
        </div>
        <dl className="match-archive__summary" aria-label="Archive summary">
          <div>
            <CalendarDays aria-hidden="true" />
            <dd>{rows.length}</dd>
            <dt>Total matches</dt>
          </div>
          <div>
            <Clock3 aria-hidden="true" />
            <dd>{upcomingCount}</dd>
            <dt>Upcoming</dt>
          </div>
          <div>
            <CheckCircle2 aria-hidden="true" />
            <dd>{completedCount}</dd>
            <dt>Completed</dt>
          </div>
        </dl>
      </header>

      <div className="match-archive__toolbar">
        <label className="match-archive__search">
          <span className="sr-only">Search matches</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gangs or tournaments"
          />
        </label>
        <div
          className="match-archive__filters"
          role="group"
          aria-label="Filter matches by status"
        >
          {matchFilters.map((item) => (
            <button
              type="button"
              className={filter === item ? "is-active" : undefined}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              key={item}
            >
              {readableStatus(item)}
            </button>
          ))}
        </div>
      </div>

      {filteredRows.length ? (
        <div className="match-archive__feed">
          <div className="match-archive__columns" aria-hidden="true">
            <span>Tournament</span>
            <span>Matchup</span>
            <span>Status &amp; date</span>
          </div>
          {filteredRows.map((match) => {
            const gangA = record(match.gangA);
            const gangB = record(match.gangB);
            const tournament = record(match.tournament);
            const round = record(match.bracketRound);
            const gangAName = value(gangA, "name", "TBD");
            const gangBName = value(gangB, "name", "TBD");
            const hasScore =
              typeof match.gangAScore === "number" ||
              typeof match.gangBScore === "number";
            return (
              <Link
                className="match-archive__row"
                to={`/matches/${match.id}`}
                key={match.id}
              >
                <div className="match-archive__context">
                  <strong>
                    {value(tournament, "name", "Independent match")}
                  </strong>
                  {round ? (
                    <span>{value(round, "name", "Tournament")}</span>
                  ) : null}
                </div>
                <div className="match-archive__matchup">
                  <strong
                    className={gangAName === "TBD" ? "is-tbd" : undefined}
                  >
                    {gangAName}
                  </strong>
                  <span className="match-archive__versus">
                    {hasScore ? (
                      <>
                        <b>{displayValue(match.gangAScore, "0")}</b>
                        <i>:</i>
                        <b>{displayValue(match.gangBScore, "0")}</b>
                      </>
                    ) : (
                      "VS"
                    )}
                  </span>
                  <strong
                    className={gangBName === "TBD" ? "is-tbd" : undefined}
                  >
                    {gangBName}
                  </strong>
                </div>
                <div className="match-archive__meta">
                  <small>
                    {value(match, "status").replaceAll("_", " ")} ·{" "}
                    {typeof match.scheduledAt === "string"
                      ? new Date(match.scheduledAt).toLocaleString()
                      : "Not scheduled"}
                  </small>
                </div>
                <ChevronRight aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={rows.length ? "No matches found" : "No matches published"}
          message={
            rows.length
              ? "Try another search or status filter."
              : "Published match records will appear here."
          }
        />
      )}
    </section>
  );
}

function MatchDetail({ row }: { row: RecordRow }) {
  const gangA = record(row.gangA);
  const gangB = record(row.gangB);
  const winner = record(row.winnerGang);
  const tournament = record(row.tournament);
  const round = record(row.bracketRound);
  const stats = array(row.playerStats);
  return (
    <section className="public-dossier match-public-dossier">
      <header>
        <Swords />
        <div>
          <span>
            {value(tournament, "name", "Independent match")} ·{" "}
            {value(round, "name", "No round")}
          </span>
          <h2>
            {value(gangA, "name", "TBD")} vs {value(gangB, "name", "TBD")}
          </h2>
          <p>{value(row, "status").replaceAll("_", " ")}</p>
        </div>
      </header>
      <div className="public-match-score">
        <strong>{displayValue(row.gangAScore)}</strong>
        <span>
          {winner ? `${value(winner, "name")} won` : "Result pending"}
        </span>
        <strong>{displayValue(row.gangBScore)}</strong>
      </div>
      {typeof row.resultNotes === "string" ? <p>{row.resultNotes}</p> : null}
      <section>
        <h3>Player statistics</h3>
        {stats.length ? (
          <div className="public-record-list">
            {stats.map((stat) => {
              const player = record(stat.player);
              const gang = record(stat.gang);
              return (
                <article key={stat.id}>
                  <strong>{value(player, "displayName")}</strong>
                  <span>
                    {value(gang, "tag")} · {numberValue(stat, "kills")} K /{" "}
                    {numberValue(stat, "deaths")} D /{" "}
                    {numberValue(stat, "assists")} A
                  </span>
                  {stat.mvp ? <b>MVP</b> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No player statistics published" />
        )}
      </section>
    </section>
  );
}

export default function DirectoryPage({ type }: { type: keyof typeof labels }) {
  const params = useParams();
  const isMatch = type.startsWith("match");
  const isDetail = type.endsWith("detail") || type.endsWith("profile");
  const detailId = params.id ?? params.slug ?? "";
  const queryFn: () => Promise<ApiEnvelope<unknown>> = isMatch
    ? isDetail
      ? () => api.match(detailId)
      : api.matches
    : isDetail
      ? () => api.player(detailId)
      : api.players;
  const query = useQuery({ queryKey: [type, detailId], queryFn });
  const [title, description] = labels[type];
  if (query.isPending) return <PageSkeleton />;
  if (query.isError)
    return (
      <main className="page-shell">
        <ErrorState retry={() => void query.refetch()} />
      </main>
    );
  const rows = array(query.data.data);
  const detail = record(query.data.data) as RecordRow | null;
  const isMatchList = isMatch && !isDetail;
  return (
    <main className="page-shell">
      {!isMatchList ? (
        <header className="page-heading">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </header>
      ) : null}
      {isMatchList ? (
        <MatchList rows={rows} />
      ) : !isDetail && rows.length === 0 ? (
        <EmptyState title={`No ${isMatch ? "matches" : "players"} published`} />
      ) : isDetail && !detail ? (
        <EmptyState title="Record not found" />
      ) : isMatch ? (
        isDetail && detail ? (
          <MatchDetail row={detail} />
        ) : null
      ) : isDetail && detail ? (
        <PlayerProfile row={detail} />
      ) : (
        <PlayerList rows={rows} />
      )}
    </main>
  );
}

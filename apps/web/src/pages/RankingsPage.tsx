import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

function movement(
  current: number | null | undefined,
  previous: number | null | undefined,
) {
  if (!current || !previous) return 0;
  return previous - current;
}

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textValue(
  row: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const value = row[key];
  return typeof value === "string" && value ? value : fallback;
}

export default function RankingsPage() {
  const [mode, setMode] = useState("gangs");
  const [gangs, players] = useQueries({
    queries: [
      { queryKey: ["rankings", "gangs"], queryFn: api.rankings },
      { queryKey: ["rankings", "players"], queryFn: api.playerRankings },
    ],
  });
  const active = mode === "players" ? players : gangs;
  if (active.isPending) return <PageSkeleton />;
  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <h1>Competitive Rankings</h1>
          <p>
            Authoritative seasonal standings calculated from finalized match
            results and auditable ranking events.
          </p>
        </div>
      </header>
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="gangs">Gang ranking</TabsTrigger>
          <TabsTrigger value="players">Player ranking</TabsTrigger>
        </TabsList>
      </Tabs>
      {active.isError ? (
        <ErrorState retry={() => void active.refetch()} />
      ) : mode === "gangs" ? (
        gangs.data?.data.length ? (
          <div className="ranking-table">
            <div className="ranking-table-head">
              <span>Place</span>
              <span>Movement</span>
              <span>Gang</span>
              <span>Points</span>
              <span>Record</span>
              <span>Kill diff.</span>
              <span>Trophies</span>
            </div>
            {gangs.data.data.map((gang) => {
              const delta = movement(gang.currentRank, gang.previousRank);
              return (
                <div className="ranking-table-row" key={gang.id}>
                  <strong>{gang.currentRank ?? "—"}</strong>
                  <span>
                    {delta > 0 ? (
                      <ArrowUp />
                    ) : delta < 0 ? (
                      <ArrowDown />
                    ) : (
                      <Minus />
                    )}
                  </span>
                  <Link to={`/gangs/${gang.slug}`}>{gang.name}</Link>
                  <span>{gang.points}</span>
                  <span>
                    {gang.wins}–{gang.losses}
                  </span>
                  <span>{gang.killDifference}</span>
                  <span>{gang.trophies}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Gang standings not calculated"
            message="Activate a season and recalculate rankings from the admin panel."
          />
        )
      ) : players.data?.data.length ? (
        <div className="ranking-table">
          <div className="ranking-table-head">
            <span>Place</span>
            <span>Movement</span>
            <span>Player</span>
            <span>Points</span>
            <span>Record</span>
            <span>K/D</span>
            <span>MVP</span>
          </div>
          {players.data.data.map((row) => {
            const player =
              typeof row.player === "object" && row.player !== null
                ? (row.player as Record<string, unknown>)
                : {};
            const delta = movement(
              typeof row.currentRank === "number" ? row.currentRank : null,
              typeof row.previousRank === "number" ? row.previousRank : null,
            );
            const kills = numberValue(row, "kills");
            const deaths = numberValue(row, "deaths");
            return (
              <div className="ranking-table-row" key={textValue(row, "id")}>
                <strong>{numberValue(row, "currentRank") || "—"}</strong>
                <span>
                  {delta > 0 ? (
                    <ArrowUp />
                  ) : delta < 0 ? (
                    <ArrowDown />
                  ) : (
                    <Minus />
                  )}
                </span>
                <Link to={`/players/${textValue(player, "slug")}`}>
                  {textValue(player, "displayName", "Player")}
                </Link>
                <span>{numberValue(row, "points")}</span>
                <span>
                  {numberValue(row, "wins")}–{numberValue(row, "losses")}
                </span>
                <span>
                  {deaths ? (kills / deaths).toFixed(2) : kills.toFixed(2)}
                </span>
                <span>{numberValue(row, "mvpAwards")}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Player standings not calculated"
          message="Finalize player statistics and recalculate the active season."
        />
      )}
    </main>
  );
}

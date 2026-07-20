import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

export default function RankingsPage() {
  const rankings = useQuery({ queryKey: ["rankings"], queryFn: api.rankings });
  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <h1>Order of Power</h1>
          <p>
            Authoritative seasonal standings calculated from match results and
            auditable ranking events.
          </p>
        </div>
      </header>
      <Tabs defaultValue="gangs">
        <TabsList>
          <TabsTrigger value="gangs">Gang ranking</TabsTrigger>
          <TabsTrigger value="players">Player ranking</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
          <TabsTrigger value="all-time">All-time</TabsTrigger>
        </TabsList>
      </Tabs>
      {rankings.isPending ? (
        <PageSkeleton />
      ) : rankings.isError ? (
        <ErrorState retry={() => void rankings.refetch()} />
      ) : rankings.data.data.length === 0 ? (
        <EmptyState
          title="Standings not calculated"
          message="A season and verified ranking events are required before a table is published."
        />
      ) : (
        <div className="ranking-table">
          <div className="ranking-table-head">
            <span>Place</span>
            <span>Movement</span>
            <span>Gang</span>
            <span>Points</span>
            <span>Record</span>
            <span>K/D</span>
            <span>Win rate</span>
          </div>
          {rankings.data.data.map((gang) => {
            const movement = (gang.currentRank ?? 0) - (gang.currentRank ?? 0);
            return (
              <div className="ranking-table-row" key={gang.id}>
                <strong>{gang.currentRank ?? "—"}</strong>
                <span>
                  {movement > 0 ? (
                    <ArrowDown />
                  ) : movement < 0 ? (
                    <ArrowUp />
                  ) : (
                    <Minus />
                  )}
                </span>
                <Link to={`/gangs/${gang.slug}`}>{gang.name}</Link>
                <span>—</span>
                <span>
                  {gang.wins}–{gang.losses}
                </span>
                <span>—</span>
                <span>{gang.winRate}%</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

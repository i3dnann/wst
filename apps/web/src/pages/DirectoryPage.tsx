import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
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
    "Rosters, result, player statistics, evidence, and audit-safe status.",
  ],
} as const;

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
  const query = useQuery({
    queryKey: [type, detailId],
    queryFn,
  });
  const [title, description] = labels[type];
  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : Array.isArray(query.data.data) && query.data.data.length === 0 ? (
        <EmptyState
          title={`No ${isMatch ? "matches" : "players"} published`}
          message="This page is wired to the versioned API and will populate only from verified database records."
        />
      ) : (
        <section className="status-state">
          <strong>Verified record loaded</strong>
          <p>The complete profile uses only the shaped API response.</p>
        </section>
      )}
    </main>
  );
}

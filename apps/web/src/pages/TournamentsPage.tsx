import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Swords, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

interface TournamentItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  format: string;
  status: string;
  startAt: string;
  maximumParticipants: number;
  _count?: { participants: number };
}

export default function TournamentsPage() {
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("");
  const tournaments = useQuery({
    queryKey: ["tournaments"],
    queryFn: api.tournaments,
  });
  const all = useMemo(
    () => (tournaments.data?.data ?? []) as TournamentItem[],
    [tournaments.data?.data],
  );
  const filtered = useMemo(
    () =>
      all.filter(
        (item) =>
          (!status || item.status === status) &&
          (!format || item.format === format),
      ),
    [all, format, status],
  );
  return (
    <main className="page-shell tournaments-page">
      <header className="page-heading tournament-ledger-heading">
        <div>
          <h1>Tournament Ledger</h1>
          <p>
            Every bracket is a proving ground: gangs enter, rivalries are
            settled, and only one name leaves with the crown.
          </p>
        </div>
        <Trophy className="page-heading-icon" />
      </header>
      <section className="filter-rail">
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="REGISTRATION_OPEN">Registration open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>
        <label>
          <span>Format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="">All formats</option>
            <option value="SINGLE_ELIMINATION">Single elimination</option>
            <option value="DOUBLE_ELIMINATION">Double elimination</option>
            <option value="ROUND_ROBIN">Round robin</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setStatus("");
            setFormat("");
          }}
        >
          Reset filters
        </Button>
      </section>
      {tournaments.isPending ? (
        <PageSkeleton />
      ) : tournaments.isError ? (
        <ErrorState retry={() => void tournaments.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No tournaments published"
          message="Approved registration windows and brackets will appear here."
        />
      ) : (
        <section className="tournament-ledger-list">
          {filtered.map((item) => (
            <article key={item.id}>
              <div className="tournament-ledger-media">
                <img
                  src={item.bannerUrl ?? "/assets/wst-gold/sealed-dossier.png"}
                  alt=""
                />
                <span
                  className={`event-status event-status--${item.status.toLowerCase()}`}
                >
                  {item.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="tournament-ledger-copy">
                <h2>{item.name}</h2>
                <p>
                  {item.description ??
                    "Tournament details will be announced by the administrator."}
                </p>
                <div>
                  <span>
                    <CalendarDays />{" "}
                    {new Date(item.startAt).toLocaleDateString()}
                  </span>
                  <span>
                    <Users /> {item._count?.participants ?? 0} /{" "}
                    {item.maximumParticipants}
                  </span>
                  <span>
                    <Swords /> {item.format.replaceAll("_", " ")}
                  </span>
                </div>
                <Button asChild>
                  <Link to={`/tournaments/${item.slug}`}>
                    Open Bracket <ArrowRight />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

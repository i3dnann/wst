import { CalendarDays, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

export default function TournamentsPage() {
  const tournaments = useQuery({
    queryKey: ["tournaments"],
    queryFn: api.tournaments,
  });
  return (
    <main className="page-shell">
      <header className="page-heading">
        <div>
          <h1>Tournament Ledger</h1>
          <p>
            Registration windows, active brackets, participants, results, and
            champions.
          </p>
        </div>
        <Trophy className="page-heading-icon" />
      </header>
      <section className="filter-rail">
        <label>
          <span>Status</span>
          <select>
            <option>All statuses</option>
            <option>Registration open</option>
            <option>In progress</option>
            <option>Completed</option>
          </select>
        </label>
        <label>
          <span>Format</span>
          <select>
            <option>All formats</option>
            <option>Single elimination</option>
            <option>Double elimination</option>
            <option>Round robin</option>
          </select>
        </label>
        <label>
          <span>Date</span>
          <button type="button">
            <CalendarDays />
            Any date
          </button>
        </label>
      </section>
      {tournaments.isPending ? (
        <PageSkeleton />
      ) : tournaments.isError ? (
        <ErrorState retry={() => void tournaments.refetch()} />
      ) : tournaments.data.data.length === 0 ? (
        <EmptyState
          title="No tournaments published"
          message="Approved registration windows and brackets will appear here."
        />
      ) : null}
    </main>
  );
}

import { Accessibility, Minus, Move, Plus, Trophy } from "lucide-react";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

const tabs = [
  "Overview",
  "Bracket",
  "Participants",
  "Matches",
  "Standings",
  "Statistics",
  "MVP",
  "Rules",
  "Media",
  "Results",
];

export default function TournamentDetailPage() {
  const { slug = "" } = useParams();
  const [zoom, setZoom] = useState(1);
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
  if (tournament.isError || bracket.isError)
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
  const data = tournament.data.data;
  const name = typeof data.name === "string" ? data.name : "Tournament";
  return (
    <main className="tournament-page">
      <header className="tournament-header">
        <Trophy />
        <div>
          <h1>{name}</h1>
          <p>
            Format, registration, participants, organizer, prize, and champion
            data are supplied by the tournament API.
          </p>
        </div>
      </header>
      <Tabs defaultValue="Bracket" className="tournament-tabs">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger value={tab} key={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <section className="bracket-workspace">
        <div className="bracket-canvas">
          <div className="bracket-toolbar">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
              aria-label="Zoom in"
            >
              <Plus />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))}
              aria-label="Zoom out"
            >
              <Minus />
            </Button>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <div
            className="bracket-content"
            style={{ transform: `scale(${String(zoom)})` }}
          >
            {bracket.data.data.rounds.length ? (
              <p>Bracket rounds loaded.</p>
            ) : (
              <EmptyState
                title="Bracket not generated"
                message="Approved participants and an authorized generation action are required."
              />
            )}
          </div>
          <p className="pan-cue">
            <Move />
            Drag to pan · Scroll to zoom
          </p>
        </div>
        <aside className="match-inspector">
          <h2>Match details</h2>
          <EmptyState
            title="No match selected"
            message="Select a bracket match to inspect its verified status."
          />
          <Button variant="outline">
            <Accessibility data-icon="inline-start" />
            Accessible list view
          </Button>
        </aside>
      </section>
    </main>
  );
}

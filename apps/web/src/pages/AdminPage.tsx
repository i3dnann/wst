import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Shield,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/data/StatusState";
import { api } from "@/lib/api";

type RecordKind = "gang" | "player" | "tournament" | "match";

const adminNav = [
  [LayoutDashboard, "Overview", null],
  [Shield, "Gangs", "gang"],
  [Users, "Players", "player"],
  [Trophy, "Tournaments", "tournament"],
  [Swords, "Matches", "match"],
] as const;

const recordConfig = {
  gang: { label: "New Gang", icon: Shield },
  player: { label: "New Player", icon: UserRound },
  tournament: { label: "New Tournament", icon: Trophy },
  match: { label: "Record Match", icon: Swords },
} as const;

const metricLabels = {
  totalGangs: "Total gangs",
  activeGangs: "Active gangs",
  totalPlayers: "Total players",
  activeTournaments: "Active tournaments",
  upcomingMatches: "Upcoming matches",
  awaitingResults: "Awaiting results",
  disputedMatches: "Disputed matches",
  pendingMedia: "Pending media",
} as const;

function RecordForm({ kind, close }: { kind: RecordKind; close: () => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: async () => {
      if (kind === "gang")
        return api.createGang({
          name: values.name,
          slug: values.slug,
          tag: values.tag,
        });
      if (kind === "player")
        return api.createPlayer({
          displayName: values.displayName,
          slug: values.slug,
        });
      if (kind === "tournament")
        return api.createTournament({
          name: values.name,
          slug: values.slug,
          format: values.format || "SINGLE_ELIMINATION",
          status: "DRAFT",
          startAt: new Date(values.startAt ?? "").toISOString(),
          maximumParticipants: Number(values.maximumParticipants || 16),
        });
      return api.createMatch({
        tournamentId: values.tournamentId || undefined,
        gangAId: values.gangAId || undefined,
        gangBId: values.gangBId || undefined,
        bestOf: Number(values.bestOf || 1),
        scheduledAt: values.scheduledAt
          ? new Date(values.scheduledAt).toISOString()
          : undefined,
      });
    },
    onSuccess: () => {
      toast.success(`${recordConfig[kind].label} record created.`);
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      close();
    },
  });

  const field = (
    name: string,
    label: string,
    options?: { type?: string; required?: boolean },
  ) => (
    <label>
      {label}
      <input
        name={name}
        type={options?.type ?? "text"}
        required={options?.required ?? true}
        value={values[name] ?? ""}
        onChange={(event) =>
          setValues((current) => ({
            ...current,
            [name]: event.target.value,
          }))
        }
      />
    </label>
  );

  return (
    <form
      className="record-form"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="record-form-heading">
        <div>
          <span>Create published record</span>
          <h2>{recordConfig[kind].label}</h2>
        </div>
        <button type="button" onClick={close} aria-label="Close form">
          ×
        </button>
      </div>
      <div className="record-form-fields">
        {kind === "gang" ? (
          <>
            {field("name", "Gang name")}
            {field("slug", "URL slug")}
            {field("tag", "Tag")}
          </>
        ) : null}
        {kind === "player" ? (
          <>
            {field("displayName", "Display name")}
            {field("slug", "URL slug")}
          </>
        ) : null}
        {kind === "tournament" ? (
          <>
            {field("name", "Tournament name")}
            {field("slug", "URL slug")}
            {field("startAt", "Start date", { type: "datetime-local" })}
            {field("maximumParticipants", "Maximum participants", {
              type: "number",
            })}
            <label>
              Format
              <select
                value={values.format ?? "SINGLE_ELIMINATION"}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    format: event.target.value,
                  }))
                }
              >
                <option value="SINGLE_ELIMINATION">Single elimination</option>
                <option value="DOUBLE_ELIMINATION">Double elimination</option>
                <option value="ROUND_ROBIN">Round robin</option>
                <option value="GROUP_KNOCKOUT">Group knockout</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </label>
          </>
        ) : null}
        {kind === "match" ? (
          <>
            {field("tournamentId", "Tournament ID", { required: false })}
            {field("gangAId", "Gang A ID", { required: false })}
            {field("gangBId", "Gang B ID", { required: false })}
            {field("scheduledAt", "Scheduled date", {
              type: "datetime-local",
              required: false,
            })}
            {field("bestOf", "Best of", { type: "number" })}
          </>
        ) : null}
      </div>
      {create.isError ? (
        <p className="form-error" role="alert">
          {create.error.message}
        </p>
      ) : null}
      <div className="record-form-actions">
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Publish record"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [recordKind, setRecordKind] = useState<RecordKind | null>(null);
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: api.adminMe,
    retry: false,
  });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: api.adminOverview,
    retry: false,
    enabled: me.isSuccess,
  });
  const logout = useMutation({
    mutationFn: api.adminLogout,
    onSettled: () => {
      void navigate("/admin/login");
    },
  });

  if (me.isPending) return <PageSkeleton />;
  if (me.isError) return <Navigate to="/admin/login" replace />;

  const data = overview.data?.data;
  return (
    <div className="control-shell">
      <aside className="control-sidebar">
        <div className="control-brand">
          <img src="/assets/wst/wst-round.png" alt="World Star" />
          <strong>WORLD STAR CONTROL</strong>
        </div>
        <nav aria-label="Administrator navigation">
          {adminNav.map(([Icon, label, kind]) => (
            <button
              key={label}
              type="button"
              className={
                kind === recordKind || (!kind && !recordKind) ? "active" : ""
              }
              onClick={() => setRecordKind(kind)}
            >
              <Icon /> {label}
            </button>
          ))}
          <a href="#recent-content">
            <FileText /> Audit Log
          </a>
        </nav>
        <button
          type="button"
          className="control-logout"
          onClick={() => logout.mutate()}
        >
          <LogOut /> Log Out
        </button>
      </aside>

      <main className="control-main">
        <header className="control-heading">
          <div>
            <h1>COMMAND CENTER</h1>
            <p>Manual control of every published record.</p>
          </div>
          <div className="administrator-chip">
            <Shield />
            <span>
              Administrator<small>{me.data.data.email}</small>
            </span>
          </div>
          <Button onClick={() => setRecordKind("gang")}>
            <Plus /> Create Record
          </Button>
        </header>

        <section className="control-metrics" aria-label="Platform metrics">
          {(data
            ? Object.entries(data.summary)
            : Object.entries(metricLabels)
          ).map(([key, value]) => (
            <article key={key}>
              <span>{metricLabels[key as keyof typeof metricLabels]}</span>
              <strong>{data ? Number(value).toLocaleString() : "—"}</strong>
            </article>
          ))}
        </section>

        {recordKind ? (
          <RecordForm kind={recordKind} close={() => setRecordKind(null)} />
        ) : null}

        <div className="control-workspace">
          <section className="recent-content" id="recent-content">
            <h2>Recent Content</h2>
            <div className="content-table-head">
              <span>Type</span>
              <span>Record</span>
              <span>Administrator</span>
              <span>Updated</span>
            </div>
            {data?.activity.length ? (
              <ol>
                {data.activity.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.entityType}</span>
                    <strong>{entry.action}</strong>
                    <span>{entry.actor?.displayName ?? "System"}</span>
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="control-empty">
                <FileText />
                <strong>No records have been created.</strong>
              </div>
            )}
          </section>

          <aside className="quick-actions">
            <h2>Quick Actions</h2>
            {(Object.keys(recordConfig) as RecordKind[]).map((kind) => {
              const Icon = recordConfig[kind].icon;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setRecordKind(kind)}
                >
                  <Icon />
                  {recordConfig[kind].label}
                  <ArrowRight />
                </button>
              );
            })}
          </aside>
        </div>
      </main>
    </div>
  );
}

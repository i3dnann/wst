import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Gavel,
  LayoutDashboard,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/data/StatusState";
import { api } from "@/lib/api";

type AdminSection =
  | "overview"
  | "gang"
  | "player"
  | "tournament"
  | "bracket"
  | "event"
  | "stream"
  | "match"
  | "settings";
type RecordKind = "gang" | "player" | "tournament" | "match";

interface TournamentSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  maximumParticipants: number;
}

interface TournamentParticipant {
  id: string;
  seed: number | null;
  status: string;
  gang: { id: string; name: string; tag: string; logoUrl: string | null };
}

interface TournamentDetail {
  id: string;
  slug: string;
  name: string;
  maximumParticipants: number;
  participants: TournamentParticipant[];
}

interface BracketMatchAdmin {
  id: string;
  position: number | null;
  version: number;
  status: string;
  gangAScore: number | null;
  gangBScore: number | null;
  winnerGangId: string | null;
  gangA: { id: string; name: string } | null;
  gangB: { id: string; name: string } | null;
}

interface BracketRoundAdmin {
  id: string;
  name: string;
  matches: BracketMatchAdmin[];
}

const adminNav = [
  [LayoutDashboard, "Overview", "overview"],
  [Shield, "Gangs", "gang"],
  [Users, "Players", "player"],
  [Trophy, "Tournaments", "tournament"],
  [Gavel, "Bracket Manager", "bracket"],
  [CalendarDays, "Events", "event"],
  [Radio, "Live Streams", "stream"],
  [Swords, "Matches", "match"],
  [Settings, "Settings", "settings"],
] as const;

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

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = true,
  min,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        value={value}
        type={type}
        required={required}
        min={min}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

function RecordManager({ kind }: { kind: RecordKind }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({
    format: "SINGLE_ELIMINATION",
    maximumParticipants: "16",
  });
  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
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
          format: values.format,
          status: "DRAFT",
          startAt: new Date(values.startAt ?? "").toISOString(),
          maximumParticipants: Number(values.maximumParticipants),
        });
      return api.createMatch({
        tournamentId: values.tournamentId || undefined,
        gangAId: values.gangAId || undefined,
        gangBId: values.gangBId || undefined,
        scheduledAt: values.scheduledAt
          ? new Date(values.scheduledAt).toISOString()
          : undefined,
        bestOf: Number(values.bestOf || 1),
      });
    },
    onSuccess: () => {
      toast.success("Record published.");
      setValues({ format: "SINGLE_ELIMINATION", maximumParticipants: "16" });
      void queryClient.invalidateQueries();
    },
  });
  const labels = {
    gang: "Create Gang",
    player: "Create Player",
    tournament: "Create Tournament",
    match: "Create Match",
  };
  return (
    <section className="admin-manager-panel">
      <header>
        <div>
          <span>Manual Publishing</span>
          <h2>{labels[kind]}</h2>
        </div>
        <Plus />
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="admin-form-grid"
      >
        {kind === "gang" ? (
          <>
            <FormField
              label="Gang name"
              name="name"
              value={values.name ?? ""}
              onChange={setValue}
            />
            <FormField
              label="URL slug"
              name="slug"
              value={values.slug ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Tag"
              name="tag"
              value={values.tag ?? ""}
              onChange={setValue}
            />
          </>
        ) : null}
        {kind === "player" ? (
          <>
            <FormField
              label="Display name"
              name="displayName"
              value={values.displayName ?? ""}
              onChange={setValue}
            />
            <FormField
              label="URL slug"
              name="slug"
              value={values.slug ?? ""}
              onChange={setValue}
            />
          </>
        ) : null}
        {kind === "tournament" ? (
          <>
            <FormField
              label="Tournament name"
              name="name"
              value={values.name ?? ""}
              onChange={setValue}
            />
            <FormField
              label="URL slug"
              name="slug"
              value={values.slug ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Start"
              name="startAt"
              type="datetime-local"
              value={values.startAt ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Entrant capacity"
              name="maximumParticipants"
              type="number"
              min={2}
              value={values.maximumParticipants ?? "16"}
              onChange={setValue}
            />
            <label>
              Format
              <select
                value={values.format ?? "SINGLE_ELIMINATION"}
                onChange={(event) => setValue("format", event.target.value)}
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
            <FormField
              label="Tournament ID"
              name="tournamentId"
              required={false}
              value={values.tournamentId ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Gang A ID"
              name="gangAId"
              required={false}
              value={values.gangAId ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Gang B ID"
              name="gangBId"
              required={false}
              value={values.gangBId ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Scheduled"
              name="scheduledAt"
              type="datetime-local"
              required={false}
              value={values.scheduledAt ?? ""}
              onChange={setValue}
            />
            <FormField
              label="Best of"
              name="bestOf"
              type="number"
              min={1}
              value={values.bestOf ?? "1"}
              onChange={setValue}
            />
          </>
        ) : null}
        {create.isError ? (
          <p className="form-error" role="alert">
            {create.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Publishing…" : labels[kind]}
        </Button>
      </form>
    </section>
  );
}

function MatchAdvanceEditor({
  match,
  tournamentSlug,
}: {
  match: BracketMatchAdmin;
  tournamentSlug: string;
}) {
  const queryClient = useQueryClient();
  const [scoreA, setScoreA] = useState(String(match.gangAScore ?? 0));
  const [scoreB, setScoreB] = useState(String(match.gangBScore ?? 0));
  useEffect(() => {
    setScoreA(String(match.gangAScore ?? 0));
    setScoreB(String(match.gangBScore ?? 0));
  }, [match.gangAScore, match.gangBScore]);
  const advance = useMutation({
    mutationFn: (winnerGangId: string) =>
      api.advanceMatch(match.id, {
        winnerGangId,
        gangAScore: Number(scoreA),
        gangBScore: Number(scoreB),
        version: match.version,
      }),
    onSuccess: () => {
      toast.success("Winner advanced.");
      void queryClient.invalidateQueries({
        queryKey: ["bracket", tournamentSlug],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentSlug],
      });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <article className="admin-match-editor">
      <span>
        Match {match.position ?? "—"} · {match.status.replaceAll("_", " ")}
        {match.winnerGangId ? " · winner selected" : ""}
      </span>
      {[match.gangA, match.gangB].map((gang, index) => (
        <div key={gang?.id ?? `slot-${String(index)}`}>
          <strong>{gang?.name ?? "TBD"}</strong>
          <input
            aria-label={`${gang?.name ?? "TBD"} score`}
            type="number"
            min="0"
            value={index === 0 ? scoreA : scoreB}
            onChange={(event) =>
              index === 0
                ? setScoreA(event.target.value)
                : setScoreB(event.target.value)
            }
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!gang || advance.isPending}
            onClick={() => gang && advance.mutate(gang.id)}
          >
            Set Winner &amp; Advance
          </Button>
        </div>
      ))}
      {advance.isError ? (
        <p className="form-error">{advance.error.message}</p>
      ) : null}
    </article>
  );
}

export function BracketManager() {
  const queryClient = useQueryClient();
  const bracketCanvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<"canvas" | "list">("canvas");
  const [resetOpen, setResetOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<
    TournamentDetail["participants"][number] | null
  >(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [placement, setPlacement] = useState<"SEEDED" | "RANDOM">("SEEDED");
  const [tournaments, gangs] = useQueries({
    queries: [
      {
        queryKey: ["admin-records", "tournament"],
        queryFn: api.adminTournaments,
        retry: false,
      },
      {
        queryKey: ["gangs", "admin"],
        queryFn: () => api.gangs("pageSize=100&sort=name"),
        retry: false,
      },
    ],
  });
  const tournamentList = useMemo(
    () => (tournaments.data?.data ?? []) as unknown as TournamentSummary[],
    [tournaments.data?.data],
  );
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (!selectedId && tournamentList[0]) setSelectedId(tournamentList[0].id);
  }, [selectedId, tournamentList]);
  const selected = tournamentList.find((item) => item.id === selectedId);
  const detail = useQuery({
    queryKey: ["admin-tournament", selectedId],
    queryFn: () => api.adminTournament(selectedId),
    enabled: Boolean(selectedId),
    retry: false,
  });
  const tournament = detail.data?.data as unknown as
    TournamentDetail | undefined;
  const rounds =
    (detail.data?.data.rounds as BracketRoundAdmin[] | undefined) ?? [];
  const [gangId, setGangId] = useState("");
  const [seed, setSeed] = useState("1");
  const nextAvailableSeed = useMemo(() => {
    const used = new Set(
      (tournament?.participants ?? [])
        .map((participant) => participant.seed)
        .filter((value): value is number => typeof value === "number"),
    );
    const capacity = tournament?.maximumParticipants ?? 256;
    for (let value = 1; value <= capacity; value += 1) {
      if (!used.has(value)) return value;
    }
    return capacity;
  }, [tournament?.maximumParticipants, tournament?.participants]);
  useEffect(() => {
    const current = Number(seed);
    const used = new Set(
      (tournament?.participants ?? [])
        .map((participant) => participant.seed)
        .filter((value): value is number => typeof value === "number"),
    );
    if (!Number.isInteger(current) || current < 1 || used.has(current)) {
      setSeed(String(nextAvailableSeed));
    }
  }, [nextAvailableSeed, seed, tournament?.participants]);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin-tournament", selectedId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin-records", "tournament"],
      }),
      queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      queryClient.invalidateQueries({ queryKey: ["bracket"] }),
    ]);
  };
  const add = useMutation({
    mutationFn: () => {
      const requestedSeed = Number(seed);
      const normalizedSeed =
        Number.isInteger(requestedSeed) && requestedSeed > 0
          ? requestedSeed
          : nextAvailableSeed;
      return api.addTournamentParticipant(selectedId, {
        gangId,
        seed: normalizedSeed,
      });
    },
    onSuccess: () => {
      toast.success("Gang added to bracket.");
      setGangId("");
      setSeed(String(nextAvailableSeed + 1));
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (participantId: string) =>
      api.removeTournamentParticipant(selectedId, participantId),
    onSuccess: () => {
      toast.success("Gang removed.");
      setRemoveTarget(null);
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const reseed = useMutation({
    mutationFn: ({
      participantId,
      nextSeed,
    }: {
      participantId: string;
      nextSeed: number;
    }) =>
      api.updateTournamentParticipant(selectedId, participantId, {
        seed: nextSeed,
      }),
    onSuccess: () => {
      toast.success("Seed updated.");
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateParticipantStatus = useMutation({
    mutationFn: ({
      participantId,
      status,
    }: {
      participantId: string;
      status: string;
    }) =>
      api.updateTournamentParticipant(selectedId, participantId, { status }),
    onSuccess: () => {
      toast.success("Tournament gang status updated.");
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const generate = useMutation({
    mutationFn: (input: {
      confirmReset?: boolean;
      confirmationName?: string;
      placement?: "SEEDED" | "RANDOM";
    }) => api.generateBracket(selectedId, input),
    onSuccess: (result) => {
      toast.success(`${String(result.data.slotCount)}-slot bracket generated.`);
      setResetOpen(false);
      setConfirmationName("");
      void refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const availableGangs = useMemo(() => {
    const used = new Set(
      tournament?.participants.map((entry) => entry.gang.id) ?? [],
    );
    return (gangs.data?.data ?? []).filter((gang) => !used.has(gang.id));
  }, [gangs.data, tournament?.participants]);
  const completedMatches = rounds
    .flatMap((round) => round.matches)
    .filter((match) => match.status === "COMPLETED").length;
  return (
    <section className="bracket-admin-workspace">
      <header className="admin-manager-header">
        <div>
          <span>Tournament Control</span>
          <h2>Bracket Manager</h2>
          <p>
            Add or remove gangs, change seeds, regenerate rounds, and advance
            winners.
          </p>
        </div>
        <Trophy />
      </header>
      <div className="bracket-admin-toolbar">
        <label>
          Tournament
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Select tournament</option>
            {tournamentList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <strong>{tournament?.participants.length ?? 0}</strong>
          <span>of {tournament?.maximumParticipants ?? 0} entrants</span>
        </div>
        <Button
          disabled={!selectedId || generate.isPending}
          onClick={() =>
            rounds.length ? setResetOpen(true) : generate.mutate({ placement })
          }
        >
          <RefreshCw />{" "}
          {rounds.length ? "Regenerate Bracket" : "Generate Bracket"}
        </Button>
      </div>
      <div className="bracket-admin-columns">
        <section className="seed-manager">
          <header>
            <h3>Seeded Gangs</h3>
            <span>{tournament?.participants.length ?? 0}</span>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <select
              value={gangId}
              onChange={(event) => setGangId(event.target.value)}
              required
            >
              <option value="">Choose gang</option>
              {availableGangs.map((gang) => (
                <option key={gang.id} value={gang.id}>
                  {gang.name} [{gang.tag}]
                </option>
              ))}
            </select>
            <input
              aria-label="Seed"
              type="number"
              min="1"
              max={tournament?.maximumParticipants ?? 256}
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!selectedId || !gangId || add.isPending}
            >
              <Plus /> Add
            </Button>
          </form>
          <ol>
            {[...(tournament?.participants ?? [])]
              .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
              .map((participant) => (
                <li key={`${participant.id}-${String(participant.seed)}`}>
                  <input
                    aria-label={`${participant.gang.name} seed`}
                    type="number"
                    min="1"
                    defaultValue={participant.seed ?? ""}
                    onBlur={(event) => {
                      const nextSeed = Number(event.target.value);
                      if (!Number.isInteger(nextSeed) || nextSeed < 1) return;
                      reseed.mutate({
                        participantId: participant.id,
                        nextSeed,
                      });
                    }}
                  />
                  <div>
                    {participant.gang.logoUrl ? (
                      <img src={participant.gang.logoUrl} alt="" />
                    ) : (
                      <Shield />
                    )}
                    <strong>{participant.gang.name}</strong>
                    <small>{participant.gang.tag}</small>
                  </div>
                  <select
                    aria-label={`${participant.gang.name} tournament status`}
                    value={participant.status}
                    disabled={updateParticipantStatus.isPending}
                    onChange={(event) =>
                      updateParticipantStatus.mutate({
                        participantId: participant.id,
                        status: event.target.value,
                      })
                    }
                  >
                    {[
                      "PENDING",
                      "APPROVED",
                      "REJECTED",
                      "WITHDRAWN",
                      "ELIMINATED",
                      "CHAMPION",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${participant.gang.name}`}
                    onClick={() => setRemoveTarget(participant)}
                  >
                    <Trash2 />
                  </button>
                </li>
              ))}
          </ol>
        </section>
        <section className="admin-bracket-preview">
          <header>
            <h3>Generated Progression</h3>
            <div className="bracket-view-controls">
              <button
                type="button"
                onClick={() => setView(view === "canvas" ? "list" : "canvas")}
              >
                {view === "canvas" ? "List view" : "Canvas view"}
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(1.6, value + 0.1))}
              >
                +
              </button>
              <button type="button" onClick={() => setZoom(1)}>
                Fit
              </button>
              <button
                type="button"
                onClick={() =>
                  void bracketCanvasRef.current?.requestFullscreen()
                }
              >
                Fullscreen
              </button>
            </div>
          </header>
          {rounds.length ? (
            <div
              className={`admin-bracket-scroll admin-bracket-scroll--${view}`}
              ref={bracketCanvasRef}
            >
              <div
                className="admin-bracket-scale"
                style={{
                  transform: `scale(${String(zoom)})`,
                  transformOrigin: "top left",
                }}
              >
                {rounds.map((round) => (
                  <section key={round.id}>
                    <h4>{round.name}</h4>
                    {round.matches.map((match) => (
                      <MatchAdvanceEditor
                        match={match}
                        tournamentSlug={selected?.slug ?? ""}
                        key={match.id}
                      />
                    ))}
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className="gold-empty-copy compact">
              <Trophy />
              <strong>No bracket generated</strong>
              <p>Add approved gangs, then generate the bracket.</p>
            </div>
          )}
        </section>
      </div>
      {resetOpen ? (
        <div
          className="admin-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-bracket-title"
        >
          <form
            className="admin-confirm-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              generate.mutate({
                confirmReset: true,
                ...(completedMatches ? { confirmationName } : {}),
                placement,
              });
            }}
          >
            <h3 id="reset-bracket-title">Regenerate & Reset Bracket</h3>
            <p>
              This resets every bracket match, score, player statistic, and
              winner progression.{" "}
              {completedMatches
                ? `${String(completedMatches)} completed match result(s) will be removed.`
                : "The current opening slots will be replaced."}
            </p>
            <label>
              Placement
              <select
                value={placement}
                onChange={(event) =>
                  setPlacement(event.target.value as "SEEDED" | "RANDOM")
                }
              >
                <option value="SEEDED">Deterministic seeded placement</option>
                <option value="RANDOM">Randomize participants</option>
              </select>
            </label>
            {completedMatches ? (
              <label>
                Type <strong>{selected?.name}</strong> to confirm
                <input
                  required
                  value={confirmationName}
                  onChange={(event) => setConfirmationName(event.target.value)}
                />
              </label>
            ) : null}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="danger-button"
                disabled={
                  generate.isPending ||
                  Boolean(
                    completedMatches && confirmationName !== selected?.name,
                  )
                }
              >
                Yes, Reset Bracket
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {removeTarget ? (
        <div
          className="admin-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-participant-title"
        >
          <div className="admin-confirm-dialog">
            <h3 id="remove-participant-title">
              Remove {removeTarget.gang.name}?
            </h3>
            <p>
              This removes the gang from this tournament and recursively clears
              its bracket slots, scores, results, and invalid downstream winner
              progression. Historical gang and player records remain intact.
            </p>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="danger-button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(removeTarget.id)}
              >
                Remove Gang &amp; Reset Progression
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EventManager() {
  const queryClient = useQueryClient();
  const events = useQuery({
    queryKey: ["events"],
    queryFn: api.events,
    retry: false,
  });
  const [values, setValues] = useState<Record<string, string>>({
    status: "SCHEDULED",
  });
  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const create = useMutation({
    mutationFn: () => {
      const title = values.title?.trim() ?? "";
      const slug =
        values.slug?.trim() ||
        title
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      return api.createEvent({
        ...values,
        title,
        slug,
        startsAt: new Date(values.startsAt ?? "").toISOString(),
        endsAt: values.endsAt
          ? new Date(values.endsAt).toISOString()
          : undefined,
        featured: values.featured === "true",
      });
    },
    onSuccess: () => {
      toast.success("Event published.");
      setValues({ status: "SCHEDULED" });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateEvent(id, { status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["events"] }),
    onError: (error) => toast.error(error.message),
  });
  const archive = useMutation({
    mutationFn: api.archiveEvent,
    onSuccess: () => {
      toast.success("Event archived.");
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <section className="admin-manager-panel">
      <header>
        <div>
          <span>Published Schedule</span>
          <h2>Server Events</h2>
        </div>
        <CalendarDays />
      </header>
      <form
        className="admin-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <FormField
          label="Title"
          name="title"
          value={values.title ?? ""}
          onChange={setValue}
        />
        <FormField
          label="URL slug"
          name="slug"
          value={values.slug ?? ""}
          onChange={setValue}
          required={false}
        />
        <FormField
          label="Start"
          name="startsAt"
          type="datetime-local"
          value={values.startsAt ?? ""}
          onChange={setValue}
        />
        <FormField
          label="End"
          name="endsAt"
          type="datetime-local"
          required={false}
          value={values.endsAt ?? ""}
          onChange={setValue}
        />
        <FormField
          label="Location"
          name="location"
          required={false}
          value={values.location ?? ""}
          onChange={setValue}
        />
        <FormField
          label="Image URL"
          name="imageUrl"
          type="url"
          required={false}
          value={values.imageUrl ?? ""}
          onChange={setValue}
        />
        <label className="full-width">
          Description
          <textarea
            value={values.description ?? ""}
            onChange={(event) => setValue("description", event.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={values.status ?? "SCHEDULED"}
            onChange={(event) => setValue("status", event.target.value)}
          >
            <option value="DRAFT">DRAFT (hidden)</option>
            <option value="SCHEDULED">SCHEDULED (published)</option>
            <option value="LIVE">LIVE (published)</option>
            <option value="COMPLETED">COMPLETED (published)</option>
            <option value="CANCELLED">CANCELLED (published)</option>
          </select>
        </label>
        <Button type="submit" disabled={create.isPending}>
          Publish Event
        </Button>
      </form>
      <div className="admin-record-list">
        {(events.data?.data ?? []).map((event) => (
          <article key={event.id}>
            <div>
              <strong>{event.title}</strong>
              <small>{new Date(event.startsAt).toLocaleString()}</small>
            </div>
            <select
              value={event.status}
              onChange={(change) =>
                update.mutate({ id: event.id, status: change.target.value })
              }
            >
              <option>SCHEDULED</option>
              <option>LIVE</option>
              <option>COMPLETED</option>
              <option>CANCELLED</option>
            </select>
            <button
              type="button"
              onClick={() => archive.mutate(event.id)}
              aria-label={`Archive ${event.title}`}
            >
              <Trash2 />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function StreamManager() {
  const queryClient = useQueryClient();
  const [streams, tournaments] = useQueries({
    queries: [
      { queryKey: ["live-streams"], queryFn: api.liveStreams, retry: false },
      { queryKey: ["tournaments"], queryFn: api.tournaments, retry: false },
    ],
  });
  const [values, setValues] = useState<Record<string, string>>({
    platform: "TWITCH",
    status: "OFFLINE",
  });
  const setValue = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const create = useMutation({
    mutationFn: () =>
      api.createLiveStream({
        ...values,
        tournamentId: values.tournamentId || undefined,
        startsAt: values.startsAt
          ? new Date(values.startsAt).toISOString()
          : undefined,
        featured: values.featured === "true",
      }),
    onSuccess: () => {
      toast.success("Stream approved.");
      setValues({ platform: "TWITCH", status: "OFFLINE" });
      void queryClient.invalidateQueries({ queryKey: ["live-streams"] });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateLiveStream(id, { status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["live-streams"] }),
  });
  const archive = useMutation({
    mutationFn: api.archiveLiveStream,
    onSuccess: () => {
      toast.success("Stream archived.");
      void queryClient.invalidateQueries({ queryKey: ["live-streams"] });
    },
  });
  const tournamentList = useMemo(
    () => (tournaments.data?.data ?? []) as TournamentSummary[],
    [tournaments.data?.data],
  );
  return (
    <section className="admin-manager-panel">
      <header>
        <div>
          <span>Approved Broadcasters</span>
          <h2>Live Streams</h2>
        </div>
        <Radio />
      </header>
      <form
        className="admin-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <FormField
          label="Streamer name"
          name="streamerName"
          value={values.streamerName ?? ""}
          onChange={setValue}
        />
        <FormField
          label="URL slug"
          name="slug"
          value={values.slug ?? ""}
          onChange={setValue}
        />
        <FormField
          label="Channel URL"
          name="channelUrl"
          type="url"
          value={values.channelUrl ?? ""}
          onChange={setValue}
        />
        <FormField
          label="Embed URL"
          name="embedUrl"
          type="url"
          required={false}
          value={values.embedUrl ?? ""}
          onChange={setValue}
        />
        <FormField
          label="Thumbnail URL"
          name="thumbnailUrl"
          type="url"
          required={false}
          value={values.thumbnailUrl ?? ""}
          onChange={setValue}
        />
        <label>
          Platform
          <select
            value={values.platform}
            onChange={(event) => setValue("platform", event.target.value)}
          >
            <option>TWITCH</option>
            <option>YOUTUBE</option>
            <option>KICK</option>
            <option>OTHER</option>
          </select>
        </label>
        <label>
          Tournament
          <select
            value={values.tournamentId ?? ""}
            onChange={(event) => setValue("tournamentId", event.target.value)}
          >
            <option value="">No tournament</option>
            {tournamentList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={values.status}
            onChange={(event) => setValue("status", event.target.value)}
          >
            <option>OFFLINE</option>
            <option>SCHEDULED</option>
            <option>LIVE</option>
          </select>
        </label>
        <Button type="submit" disabled={create.isPending}>
          Approve Stream
        </Button>
      </form>
      <div className="admin-record-list">
        {(streams.data?.data ?? []).map((stream) => (
          <article key={stream.id}>
            <div>
              <strong>{stream.streamerName}</strong>
              <small>
                {stream.platform} · {stream.tournament?.name ?? "Independent"}
              </small>
            </div>
            <select
              value={stream.status}
              onChange={(change) =>
                update.mutate({ id: stream.id, status: change.target.value })
              }
            >
              <option>OFFLINE</option>
              <option>SCHEDULED</option>
              <option>LIVE</option>
            </select>
            <button
              type="button"
              onClick={() => archive.mutate(stream.id)}
              aria-label={`Archive ${stream.streamerName}`}
            >
              <Trash2 />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Overview({
  data,
}: {
  data: Awaited<ReturnType<typeof api.adminOverview>>["data"] | undefined;
}) {
  return (
    <>
      <section className="control-metrics" aria-label="Platform metrics">
        {Object.entries(metricLabels).map(([key, label]) => (
          <article key={key}>
            <span>{label}</span>
            <strong>
              {data
                ? data.summary[
                    key as keyof typeof data.summary
                  ].toLocaleString()
                : "—"}
            </strong>
          </article>
        ))}
      </section>
      <div className="control-workspace">
        <section className="recent-content">
          <h2>Recent Activity</h2>
          {data?.activity.length ? (
            <ol>
              {data.activity.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.entityType}</span>
                  <strong>{entry.action}</strong>
                  <span>{entry.actor?.displayName ?? "System"}</span>
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
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
        <aside className="admin-art-panel">
          <img
            src="/assets/wst-gold/admin-office.png"
            alt="World Star administrator office"
          />
          <div>
            <Shield />
            <strong>Administrator only</strong>
            <p>
              Every public record is controlled from this private workspace.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("overview");
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
    onSettled: () => void navigate("/admin/login"),
  });
  if (me.isPending) return <PageSkeleton />;
  if (me.isError) return <Navigate to="/admin/login" replace />;
  return (
    <div className="control-shell gold-control-shell">
      <aside className="control-sidebar">
        <div className="control-brand">
          <img src="/assets/wst-gold/wst-gold.png" alt="World Star" />
          <span>
            <strong>WORLD STAR</strong>
            <small>Admin Command Center</small>
          </span>
        </div>
        <nav aria-label="Administrator navigation">
          {adminNav.map(([Icon, label, value]) => (
            <button
              key={value}
              type="button"
              className={section === value ? "active" : ""}
              onClick={() => setSection(value)}
            >
              <Icon /> {label}
              <ChevronDown />
            </button>
          ))}
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
            <h1>
              {adminNav.find((item) => item[2] === section)?.[1] ??
                "Command Center"}
            </h1>
            <p>Manual control of every published World Star record.</p>
          </div>
          <div className="administrator-chip">
            <Shield />
            <span>
              Administrator<small>{me.data.data.email}</small>
            </span>
          </div>
        </header>
        {section === "overview" ? (
          <Overview data={overview.data?.data} />
        ) : null}
        {section === "gang" ||
        section === "player" ||
        section === "tournament" ||
        section === "match" ? (
          <RecordManager kind={section} />
        ) : null}
        {section === "bracket" ? <BracketManager /> : null}
        {section === "event" ? <EventManager /> : null}
        {section === "stream" ? <StreamManager /> : null}
        {section === "settings" ? (
          <section className="admin-manager-panel">
            <header>
              <div>
                <span>Platform Control</span>
                <h2>Settings</h2>
              </div>
              <Settings />
            </header>
            <div className="gold-empty-copy compact">
              <Settings />
              <strong>Settings remain protected</strong>
              <p>
                Platform settings are stored through the administrator-only API.
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

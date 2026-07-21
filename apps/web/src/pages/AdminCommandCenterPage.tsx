import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  FileClock,
  Gavel,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Swords,
  Trash2,
  Trophy,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  eventStatuses as sharedEventStatuses,
  matchStatuses as sharedMatchStatuses,
  recordStatuses as sharedRecordStatuses,
  tournamentStatuses as sharedTournamentStatuses,
  type PublicLiveStream,
} from "@mafia/shared";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/data/StatusState";
import {
  api,
  type AdminOverviewData,
  type AdministratorRecord,
  type AuditRecord,
} from "@/lib/api";
import { BracketManager } from "./AdminPage";
import LoginPage from "./LoginPage";
import {
  GangOrganizationManager,
  MediaManager,
  ResultsDisputesManager,
  RolesPermissionsManager,
  SeasonsManager,
  SystemHealthManager,
  WebsiteSettingsManager,
} from "./AdminExtendedSections";

type AdminSection =
  | "overview"
  | "gang"
  | "gang-organization"
  | "player"
  | "tournament"
  | "participant"
  | "bracket"
  | "match"
  | "result"
  | "event"
  | "stream"
  | "ranking"
  | "season"
  | "media"
  | "administrator"
  | "roles"
  | "audit"
  | "discord"
  | "settings"
  | "health";

class AdminSectionBoundary extends Component<
  { children: ReactNode; section: AdminSection | null },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidUpdate(previous: { section: AdminSection | null }) {
    if (previous.section !== this.props.section && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="admin-empty-state">
        <Shield />
        <h2>Admin section could not load</h2>
        <p>
          This section hit a data-format error instead of loading. Try
          refreshing; if it stays broken, check the API logs for the matching
          admin endpoint.
        </p>
        <code>{this.state.error.message}</code>
      </section>
    );
  }
}
type RecordKind = "gang" | "player" | "tournament" | "match" | "event";
type AdminRecord = Record<string, unknown> & { id: string };
type FormValues = Record<string, string | boolean>;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const adminRouteAliases: Record<string, AdminSection> = {
  gangs: "gang",
  players: "player",
  tournaments: "tournament",
  brackets: "bracket",
  matches: "match",
  events: "event",
  "live-streams": "stream",
  administrators: "administrator",
  "audit-log": "audit",
};

const adminSectionRoutes: Record<AdminSection, string> = {
  overview: "overview",
  gang: "gangs",
  "gang-organization": "gang-organization",
  player: "players",
  tournament: "tournaments",
  participant: "participant",
  bracket: "brackets",
  match: "matches",
  result: "result",
  event: "events",
  stream: "live-streams",
  ranking: "ranking",
  season: "season",
  media: "media",
  administrator: "administrators",
  roles: "roles",
  audit: "audit-log",
  discord: "discord",
  settings: "settings",
  health: "health",
};

function adminSectionFromPath(pathname: string): AdminSection | null {
  const slug = pathname.replace(/^\/admin\/?/, "").split("/")[0] || "overview";
  const alias = adminRouteAliases[slug];
  if (alias) return alias;
  const matched = Object.entries(adminSectionRoutes).find(
    ([, route]) => route === slug,
  );
  return (matched?.[0] as AdminSection | undefined) ?? null;
}

const navigation = [
  [LayoutDashboard, "Overview", "overview", "audit.read"],
  [Shield, "Gangs", "gang", "gang.read"],
  [
    Users,
    "Gang Roles & Members",
    "gang-organization",
    "gang.roster.manage.any",
  ],
  [Users, "Players", "player", "player.read"],
  [Trophy, "Tournaments", "tournament", "tournament.read"],
  [Gavel, "Participants", "participant", "tournament.bracket.manage"],
  [Gavel, "Bracket Manager", "bracket", "tournament.bracket.manage"],
  [Swords, "Matches", "match", "match.update"],
  [Swords, "Results & Disputes", "result", "match.finalize"],
  [CalendarDays, "Events", "event", "event.manage"],
  [Radio, "Live Streams", "stream", "stream.manage"],
  [Trophy, "Rankings", "ranking", "ranking.configure"],
  [CalendarDays, "Seasons", "season", "season.manage"],
  [Settings, "Media", "media", "media.moderate"],
  [UserCog, "Administrators", "administrator", "user.manage"],
  [UserCog, "Roles & Permissions", "roles", "role.manage"],
  [Settings, "Website Settings", "settings", "settings.manage"],
  [Radio, "Discord Integration", "discord", "audit.configure"],
  [FileClock, "Audit History", "audit", "audit.read"],
  [RefreshCw, "System Health", "health", "system.health.read"],
] as const;

const kindLabels: Record<RecordKind, { singular: string; plural: string }> = {
  gang: { singular: "Gang", plural: "Gangs" },
  player: { singular: "Player", plural: "Players" },
  tournament: { singular: "Tournament", plural: "Tournaments" },
  match: { singular: "Match", plural: "Matches" },
  event: { singular: "Event", plural: "Events" },
};

const recordStatuses: string[] = [...sharedRecordStatuses];
const tournamentStatuses: string[] = [...sharedTournamentStatuses];
const matchStatuses: string[] = [...sharedMatchStatuses];
const eventStatuses: string[] = [...sharedEventStatuses];

function valueOf(record: AdminRecord, key: string): string {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

function dateTimeInput(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function optional(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function Field({
  label,
  name,
  values,
  setValue,
  type = "text",
  required = false,
  full = false,
}: {
  label: string;
  name: string;
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
  type?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={full ? "full-width" : undefined}>
      {label}
      <input
        type={type}
        required={required}
        value={String(values[name] ?? "")}
        onChange={(event) => setValue(name, event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  values,
  setValue,
  options,
}: {
  label: string;
  name: string;
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  return (
    <label>
      {label}
      <select
        value={String(values[name] ?? "")}
        onChange={(event) => setValue(name, event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  name,
  values,
  setValue,
}: {
  label: string;
  name: string;
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
}) {
  return (
    <label className="admin-toggle-field">
      <input
        type="checkbox"
        checked={Boolean(values[name])}
        onChange={(event) => setValue(name, event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function blankValues(kind: RecordKind): FormValues {
  if (kind === "gang")
    return {
      status: "ACTIVE",
      recruitmentStatus: "CLOSED",
      primaryColor: "#b88a44",
      secondaryColor: "#2f241a",
      verified: false,
      featured: false,
    };
  if (kind === "player") return { status: "ACTIVE" };
  if (kind === "tournament")
    return {
      status: "DRAFT",
      format: "SINGLE_ELIMINATION",
      maximumParticipants: "16",
      publicVisible: true,
      featured: false,
    };
  if (kind === "match") return { status: "SCHEDULED", bestOf: "1" };
  return { status: "SCHEDULED", featured: false };
}

function valuesFromRecord(kind: RecordKind, record: AdminRecord): FormValues {
  if (kind === "gang")
    return {
      name: valueOf(record, "name"),
      slug: valueOf(record, "slug"),
      tag: valueOf(record, "tag"),
      motto: valueOf(record, "motto"),
      description: valueOf(record, "description"),
      history: valueOf(record, "history"),
      logoUrl: valueOf(record, "logoUrl"),
      bannerUrl: valueOf(record, "bannerUrl"),
      territory: valueOf(record, "territory"),
      primaryColor: valueOf(record, "primaryColor") || "#b88a44",
      secondaryColor: valueOf(record, "secondaryColor") || "#2f241a",
      foundedAt: dateTimeInput(record.foundedAt).slice(0, 10),
      status: valueOf(record, "status"),
      recruitmentStatus: valueOf(record, "recruitmentStatus"),
      verified: Boolean(record.verified),
      featured: Boolean(record.featured),
    };
  if (kind === "player")
    return {
      displayName: valueOf(record, "displayName"),
      slug: valueOf(record, "slug"),
      biography: valueOf(record, "biography"),
      avatarUrl: valueOf(record, "avatarUrl"),
      externalFivemId: valueOf(record, "externalFivemId"),
      status: valueOf(record, "status"),
    };
  if (kind === "tournament")
    return {
      name: valueOf(record, "name"),
      slug: valueOf(record, "slug"),
      description: valueOf(record, "description"),
      bannerUrl: valueOf(record, "bannerUrl"),
      format: valueOf(record, "format"),
      status: valueOf(record, "status"),
      startAt: dateTimeInput(record.startAt),
      endAt: dateTimeInput(record.endAt),
      registrationOpenAt: dateTimeInput(record.registrationOpenAt),
      registrationCloseAt: dateTimeInput(record.registrationCloseAt),
      seasonId: valueOf(record, "seasonId"),
      maximumParticipants: valueOf(record, "maximumParticipants"),
      rules: valueOf(record, "rules"),
      prizeDescription: valueOf(record, "prizeDescription"),
      featured: Boolean(record.featured),
      publicVisible: record.publicVisible !== false,
    };
  if (kind === "match") {
    const tournament = record.tournament as { id?: string } | null;
    const gangA = record.gangA as { id?: string } | null;
    const gangB = record.gangB as { id?: string } | null;
    const winnerGang = record.winnerGang as { id?: string } | null;
    return {
      tournamentId: tournament?.id ?? valueOf(record, "tournamentId"),
      gangAId: gangA?.id ?? valueOf(record, "gangAId"),
      gangBId: gangB?.id ?? valueOf(record, "gangBId"),
      bestOf: valueOf(record, "bestOf"),
      scheduledAt: dateTimeInput(record.scheduledAt),
      status: valueOf(record, "status"),
      gangAScore: valueOf(record, "gangAScore") || "0",
      gangBScore: valueOf(record, "gangBScore") || "0",
      winnerGangId: winnerGang?.id ?? valueOf(record, "winnerGangId"),
      version: valueOf(record, "version") || "0",
    };
  }
  return {
    title: valueOf(record, "title"),
    slug: valueOf(record, "slug"),
    description: valueOf(record, "description"),
    imageUrl: valueOf(record, "imageUrl"),
    location: valueOf(record, "location"),
    startsAt: dateTimeInput(record.startsAt),
    endsAt: dateTimeInput(record.endsAt),
    status: valueOf(record, "status"),
    featured: Boolean(record.featured),
  };
}

function payloadFor(kind: RecordKind, values: FormValues) {
  if (kind === "gang")
    return {
      name: String(values.name ?? ""),
      slug: String(values.slug ?? ""),
      tag: String(values.tag ?? ""),
      motto: optional(String(values.motto ?? "")),
      description: optional(String(values.description ?? "")),
      history: optional(String(values.history ?? "")),
      logoUrl: optional(String(values.logoUrl ?? "")),
      bannerUrl: optional(String(values.bannerUrl ?? "")),
      territory: optional(String(values.territory ?? "")),
      primaryColor: optional(String(values.primaryColor ?? "")),
      secondaryColor: optional(String(values.secondaryColor ?? "")),
      foundedAt: toIso(String(values.foundedAt ?? "")),
      status: String(values.status),
      recruitmentStatus: String(values.recruitmentStatus),
      verified: Boolean(values.verified),
      featured: Boolean(values.featured),
    };
  if (kind === "player")
    return {
      displayName: String(values.displayName ?? ""),
      slug: String(values.slug ?? ""),
      biography: optional(String(values.biography ?? "")),
      avatarUrl: optional(String(values.avatarUrl ?? "")),
      externalFivemId: optional(String(values.externalFivemId ?? "")),
      status: String(values.status),
    };
  if (kind === "tournament")
    return {
      name: String(values.name ?? ""),
      slug: String(values.slug ?? ""),
      description: optional(String(values.description ?? "")),
      bannerUrl: optional(String(values.bannerUrl ?? "")),
      format: String(values.format),
      status: String(values.status),
      startAt: toIso(String(values.startAt ?? "")),
      endAt: toIso(String(values.endAt ?? "")),
      registrationOpenAt: toIso(String(values.registrationOpenAt ?? "")),
      registrationCloseAt: toIso(String(values.registrationCloseAt ?? "")),
      seasonId: optional(String(values.seasonId ?? "")),
      maximumParticipants: Number(values.maximumParticipants),
      rules: optional(String(values.rules ?? "")),
      prizeDescription: optional(String(values.prizeDescription ?? "")),
      featured: Boolean(values.featured),
      publicVisible: Boolean(values.publicVisible),
    };
  if (kind === "match")
    return {
      tournamentId: optional(String(values.tournamentId ?? "")),
      gangAId: optional(String(values.gangAId ?? "")),
      gangBId: optional(String(values.gangBId ?? "")),
      bestOf: Number(values.bestOf),
      scheduledAt: toIso(String(values.scheduledAt ?? "")),
      status: matchStatuses.includes(String(values.status))
        ? String(values.status)
        : undefined,
    };
  return {
    title: String(values.title ?? ""),
    slug:
      optional(String(values.slug ?? "")) ??
      slugify(String(values.title ?? "")),
    description: optional(String(values.description ?? "")),
    imageUrl: optional(String(values.imageUrl ?? "")),
    location: optional(String(values.location ?? "")),
    startsAt: toIso(String(values.startsAt ?? "")),
    endsAt: toIso(String(values.endsAt ?? "")),
    status: String(values.status),
    featured: Boolean(values.featured),
  };
}

function RecordTableCells({
  kind,
  record,
}: {
  kind: RecordKind;
  record: AdminRecord;
}) {
  if (kind === "gang") {
    const count = record._count as { memberships?: number } | undefined;
    return (
      <>
        <td>
          <strong>{valueOf(record, "name")}</strong>
          <small>{valueOf(record, "motto") || "No motto"}</small>
        </td>
        <td>{valueOf(record, "tag")}</td>
        <td>
          <span
            className={`record-status ${valueOf(record, "status").toLowerCase()}`}
          >
            {valueOf(record, "status")}
          </span>
        </td>
        <td>{valueOf(record, "recruitmentStatus").replaceAll("_", " ")}</td>
        <td>{count?.memberships ?? 0}</td>
        <td>{valueOf(record, "currentRank") || "—"}</td>
      </>
    );
  }
  if (kind === "player") {
    const memberships = record.memberships as
      Array<{ gang?: { name?: string } }> | undefined;
    return (
      <>
        <td>
          <strong>{valueOf(record, "displayName")}</strong>
          <small>/{valueOf(record, "slug")}</small>
        </td>
        <td>
          <span
            className={`record-status ${valueOf(record, "status").toLowerCase()}`}
          >
            {valueOf(record, "status")}
          </span>
        </td>
        <td>{memberships?.[0]?.gang?.name ?? "Independent"}</td>
        <td>{new Date(valueOf(record, "updatedAt")).toLocaleDateString()}</td>
      </>
    );
  }
  if (kind === "tournament") {
    const count = record._count as
      { participants?: number; matches?: number } | undefined;
    return (
      <>
        <td>
          <strong>{valueOf(record, "name")}</strong>
          <small>{valueOf(record, "format").replaceAll("_", " ")}</small>
        </td>
        <td>
          <span className="record-status active">
            {valueOf(record, "status").replaceAll("_", " ")}
          </span>
        </td>
        <td>
          {count?.participants ?? 0} / {valueOf(record, "maximumParticipants")}
        </td>
        <td>{count?.matches ?? 0}</td>
        <td>{new Date(valueOf(record, "startAt")).toLocaleDateString()}</td>
      </>
    );
  }
  if (kind === "match") {
    const gangA = record.gangA as { name?: string } | null;
    const gangB = record.gangB as { name?: string } | null;
    const winner = record.winnerGang as { name?: string } | null;
    const tournament = record.tournament as { name?: string } | null;
    return (
      <>
        <td>
          <strong>
            {gangA?.name ?? "TBD"} vs {gangB?.name ?? "TBD"}
          </strong>
          <small>
            {tournament?.name ?? "Independent match"}
            {winner?.name
              ? ` · Winner: ${winner.name} (${valueOf(record, "gangAScore")}-${valueOf(record, "gangBScore")})`
              : ""}
          </small>
        </td>
        <td>
          <span className="record-status active">
            {valueOf(record, "status").replaceAll("_", " ")}
          </span>
        </td>
        <td>Best of {valueOf(record, "bestOf")}</td>
        <td>
          {valueOf(record, "scheduledAt")
            ? new Date(valueOf(record, "scheduledAt")).toLocaleString()
            : "Not scheduled"}
        </td>
      </>
    );
  }
  return (
    <>
      <td>
        <strong>{valueOf(record, "title")}</strong>
        <small>{valueOf(record, "location") || "Server-wide"}</small>
      </td>
      <td>
        <span className="record-status active">
          {valueOf(record, "status")}
        </span>
      </td>
      <td>{new Date(valueOf(record, "startsAt")).toLocaleString()}</td>
      <td>{record.featured ? "Featured" : "Standard"}</td>
    </>
  );
}

function RecordEditorFields({
  kind,
  values,
  setValue,
  gangs,
  tournaments,
  seasons,
}: {
  kind: RecordKind;
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
  gangs: AdminRecord[];
  tournaments: AdminRecord[];
  seasons: AdminRecord[];
}) {
  if (kind === "gang")
    return (
      <>
        <Field
          label="Gang name"
          name="name"
          values={values}
          setValue={setValue}
          required
          full
        />
        <Field
          label="Tag"
          name="tag"
          values={values}
          setValue={setValue}
          required
        />
        <Field
          label="URL slug"
          name="slug"
          values={values}
          setValue={setValue}
          required
        />
        <Field
          label="Logo URL / profile image"
          name="logoUrl"
          values={values}
          setValue={setValue}
          type="url"
          full
        />
        {values.logoUrl ? (
          <img
            className="admin-profile-preview"
            src={String(values.logoUrl)}
            alt="Gang profile preview"
          />
        ) : null}
        <Field
          label="Banner URL"
          name="bannerUrl"
          values={values}
          setValue={setValue}
          type="url"
          full
        />
        <Field
          label="Motto"
          name="motto"
          values={values}
          setValue={setValue}
          full
        />
        <label className="full-width">
          Description
          <textarea
            value={String(values.description ?? "")}
            onChange={(event) => setValue("description", event.target.value)}
          />
        </label>
        <label className="full-width">
          Gang history
          <textarea
            value={String(values.history ?? "")}
            onChange={(event) => setValue("history", event.target.value)}
          />
        </label>
        <Field
          label="Territory"
          name="territory"
          values={values}
          setValue={setValue}
          full
        />
        <Field
          label="Founded"
          name="foundedAt"
          values={values}
          setValue={setValue}
          type="date"
        />
        <Field
          label="Primary color"
          name="primaryColor"
          values={values}
          setValue={setValue}
          type="color"
        />
        <Field
          label="Secondary color"
          name="secondaryColor"
          values={values}
          setValue={setValue}
          type="color"
        />
        <SelectField
          label="Status"
          name="status"
          values={values}
          setValue={setValue}
          options={recordStatuses.map((value) => ({ value, label: value }))}
        />
        <SelectField
          label="Recruitment"
          name="recruitmentStatus"
          values={values}
          setValue={setValue}
          options={["OPEN", "CLOSED", "INVITE_ONLY"].map((value) => ({
            value,
            label: value.replaceAll("_", " "),
          }))}
        />
        <ToggleField
          label="Verified gang"
          name="verified"
          values={values}
          setValue={setValue}
        />
        <ToggleField
          label="Featured on public pages"
          name="featured"
          values={values}
          setValue={setValue}
        />
      </>
    );
  if (kind === "player")
    return (
      <>
        <Field
          label="Display name"
          name="displayName"
          values={values}
          setValue={setValue}
          required
          full
        />
        <Field
          label="URL slug"
          name="slug"
          values={values}
          setValue={setValue}
          required
          full
        />
        <Field
          label="Avatar URL / profile image"
          name="avatarUrl"
          values={values}
          setValue={setValue}
          type="url"
          full
        />
        <Field
          label="External FiveM identifier"
          name="externalFivemId"
          values={values}
          setValue={setValue}
          full
        />
        {values.avatarUrl ? (
          <img
            className="admin-profile-preview"
            src={String(values.avatarUrl)}
            alt="Player profile preview"
          />
        ) : null}
        <label className="full-width">
          Biography
          <textarea
            value={String(values.biography ?? "")}
            onChange={(event) => setValue("biography", event.target.value)}
          />
        </label>
        <SelectField
          label="Status"
          name="status"
          values={values}
          setValue={setValue}
          options={recordStatuses.map((value) => ({ value, label: value }))}
        />
      </>
    );
  if (kind === "tournament")
    return (
      <>
        <Field
          label="Tournament name"
          name="name"
          values={values}
          setValue={setValue}
          required
          full
        />
        <Field
          label="URL slug"
          name="slug"
          values={values}
          setValue={setValue}
          required
        />
        <Field
          label="Participant capacity"
          name="maximumParticipants"
          values={values}
          setValue={setValue}
          type="number"
          required
        />
        <Field
          label="Banner URL"
          name="bannerUrl"
          values={values}
          setValue={setValue}
          type="url"
          full
        />
        <SelectField
          label="Season"
          name="seasonId"
          values={values}
          setValue={setValue}
          options={[
            { value: "", label: "No season" },
            ...seasons.map((season) => ({
              value: season.id,
              label: valueOf(season, "name"),
            })),
          ]}
        />
        <SelectField
          label="Format"
          name="format"
          values={values}
          setValue={setValue}
          options={[
            "SINGLE_ELIMINATION",
            "DOUBLE_ELIMINATION",
            "ROUND_ROBIN",
            "GROUP_KNOCKOUT",
            "CUSTOM",
          ].map((value) => ({ value, label: value.replaceAll("_", " ") }))}
        />
        <SelectField
          label="Status"
          name="status"
          values={values}
          setValue={setValue}
          options={tournamentStatuses.map((value) => ({
            value,
            label: value.replaceAll("_", " "),
          }))}
        />
        <Field
          label="Starts"
          name="startAt"
          values={values}
          setValue={setValue}
          type="datetime-local"
          required
        />
        <Field
          label="Ends"
          name="endAt"
          values={values}
          setValue={setValue}
          type="datetime-local"
        />
        <Field
          label="Registration opens"
          name="registrationOpenAt"
          values={values}
          setValue={setValue}
          type="datetime-local"
        />
        <Field
          label="Registration closes"
          name="registrationCloseAt"
          values={values}
          setValue={setValue}
          type="datetime-local"
        />
        <label className="full-width">
          Description
          <textarea
            value={String(values.description ?? "")}
            onChange={(event) => setValue("description", event.target.value)}
          />
        </label>
        <label className="full-width">
          Rules
          <textarea
            value={String(values.rules ?? "")}
            onChange={(event) => setValue("rules", event.target.value)}
          />
        </label>
        <Field
          label="Prize description"
          name="prizeDescription"
          values={values}
          setValue={setValue}
          full
        />
        <ToggleField
          label="Featured tournament"
          name="featured"
          values={values}
          setValue={setValue}
        />
        <ToggleField
          label="Visible on public website"
          name="publicVisible"
          values={values}
          setValue={setValue}
        />
      </>
    );
  if (kind === "match")
    return (
      <>
        <SelectField
          label="Tournament"
          name="tournamentId"
          values={values}
          setValue={setValue}
          options={[
            { value: "", label: "Independent match" },
            ...tournaments.map((item) => ({
              value: item.id,
              label: valueOf(item, "name"),
            })),
          ]}
        />
        <SelectField
          label="Status"
          name="status"
          values={values}
          setValue={setValue}
          options={[
            ...(values.status && !matchStatuses.includes(String(values.status))
              ? [
                  {
                    value: String(values.status),
                    label: `${String(values.status).replaceAll("_", " ")} (manage in Results)`,
                    disabled: true,
                  },
                ]
              : []),
            ...matchStatuses.map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            })),
          ]}
        />
        <SelectField
          label="Gang A"
          name="gangAId"
          values={values}
          setValue={setValue}
          options={[
            { value: "", label: "TBD" },
            ...gangs.map((item) => ({
              value: item.id,
              label: valueOf(item, "name"),
            })),
          ]}
        />
        <SelectField
          label="Gang B"
          name="gangBId"
          values={values}
          setValue={setValue}
          options={[
            { value: "", label: "TBD" },
            ...gangs.map((item) => ({
              value: item.id,
              label: valueOf(item, "name"),
            })),
          ]}
        />
        <Field
          label="Best of"
          name="bestOf"
          values={values}
          setValue={setValue}
          type="number"
          required
        />
        <Field
          label="Scheduled"
          name="scheduledAt"
          values={values}
          setValue={setValue}
          type="datetime-local"
        />
        <p className="admin-form-note full-width">
          Scores, player statistics, winners, disputes, and corrections are
          managed in Results &amp; Disputes so bracket progression remains
          transactional.
        </p>
      </>
    );
  return (
    <>
      <Field
        label="Title"
        name="title"
        values={values}
        setValue={setValue}
        required
        full
      />
      <Field label="URL slug" name="slug" values={values} setValue={setValue} />
      <Field
        label="Location"
        name="location"
        values={values}
        setValue={setValue}
      />
      <Field
        label="Image URL"
        name="imageUrl"
        values={values}
        setValue={setValue}
        type="url"
        full
      />
      <Field
        label="Starts"
        name="startsAt"
        values={values}
        setValue={setValue}
        type="datetime-local"
        required
      />
      <Field
        label="Ends"
        name="endsAt"
        values={values}
        setValue={setValue}
        type="datetime-local"
      />
      <SelectField
        label="Status"
        name="status"
        values={values}
        setValue={setValue}
        options={eventStatuses.map((value) => ({
          value,
          label:
            value === "DRAFT"
              ? "DRAFT (hidden from website)"
              : value === "ARCHIVED"
                ? "ARCHIVED (hidden from website)"
                : `${value} (published)`,
        }))}
      />
      <ToggleField
        label="Featured event"
        name="featured"
        values={values}
        setValue={setValue}
      />
      <label className="full-width">
        Description
        <textarea
          value={String(values.description ?? "")}
          onChange={(event) => setValue("description", event.target.value)}
        />
      </label>
    </>
  );
}

function RecordsManager({ kind }: { kind: RecordKind }) {
  const queryClient = useQueryClient();
  const labels = kindLabels[kind];
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirming, setConfirming] = useState<AdminRecord | null>(null);
  const [values, setValues] = useState<FormValues>(() => blankValues(kind));
  const setValue = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));
  const records = useQuery({
    queryKey: ["admin-records", kind],
    queryFn: async (): Promise<AdminRecord[]> => {
      if (kind === "gang")
        return asArray<AdminRecord>((await api.adminGangs()).data);
      if (kind === "player")
        return asArray<AdminRecord>((await api.adminPlayers()).data);
      if (kind === "tournament")
        return asArray<AdminRecord>((await api.adminTournaments()).data);
      if (kind === "match")
        return asArray<AdminRecord>((await api.adminMatches()).data);
      return asArray<AdminRecord>((await api.adminEvents()).data);
    },
    retry: false,
  });
  const gangs = useQuery({
    queryKey: ["admin-records", "gang"],
    queryFn: api.adminGangs,
    enabled: kind === "match",
    retry: false,
  });
  const tournaments = useQuery({
    queryKey: ["admin-records", "tournament"],
    queryFn: api.adminTournaments,
    enabled: kind === "match",
    retry: false,
  });
  const seasons = useQuery({
    queryKey: ["public-seasons"],
    queryFn: api.publicSeasons,
    enabled: kind === "tournament",
    retry: false,
  });
  const rows = useMemo(() => asArray<AdminRecord>(records.data), [records.data]);
  const gangRows = asArray<AdminRecord>(gangs.data?.data);
  const tournamentRows = asArray<AdminRecord>(tournaments.data?.data);
  const seasonRows = asArray<AdminRecord>(seasons.data?.data);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term))
      : rows;
  }, [rows, search]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = payloadFor(kind, values);
      if (selected) {
        if (kind === "gang") return api.updateGang(selected.id, payload);
        if (kind === "player") return api.updatePlayer(selected.id, payload);
        if (kind === "tournament")
          return api.updateTournament(selected.id, payload);
        if (kind === "match") {
          return api.updateMatch(selected.id, payload);
        }
        return api.updateEvent(selected.id, payload);
      }
      if (kind === "gang") return api.createGang(payload);
      if (kind === "player") return api.createPlayer(payload);
      if (kind === "tournament") return api.createTournament(payload);
      if (kind === "match") return api.createMatch(payload);
      return api.createEvent(payload);
    },
    onSuccess: () => {
      toast.success(`${labels.singular} saved.`);
      setEditorOpen(false);
      setSelected(null);
      setValues(blankValues(kind));
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (record: AdminRecord) => {
      if (record.status === "ARCHIVED" && kind !== "match") {
        const resource =
          kind === "gang"
            ? "gangs"
            : kind === "player"
              ? "players"
              : kind === "tournament"
                ? "tournaments"
                : "events";
        return api.restoreRecord(resource, record.id);
      }
      if (kind === "gang") return api.archiveGang(record.id);
      if (kind === "player") return api.archivePlayer(record.id);
      if (kind === "tournament") return api.archiveTournament(record.id);
      if (kind === "match") return api.deleteMatch(record.id);
      return api.archiveEvent(record.id);
    },
    onSuccess: () => {
      toast.success(`${labels.singular} visibility updated.`);
      setConfirming(null);
      setEditorOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const openNew = () => {
    setSelected(null);
    setValues(blankValues(kind));
    setEditorOpen(true);
  };
  const openEdit = (record: AdminRecord) => {
    setSelected(record);
    setValues(valuesFromRecord(kind, record));
    setEditorOpen(true);
  };
  const headers =
    kind === "gang"
      ? ["Gang", "Tag", "Status", "Recruitment", "Members", "Rank"]
      : kind === "player"
        ? ["Player", "Status", "Gang", "Updated"]
        : kind === "tournament"
          ? ["Tournament", "Status", "Entrants", "Matches", "Starts"]
          : kind === "match"
            ? ["Match", "Status", "Format", "Scheduled"]
            : ["Event", "Status", "Starts", "Visibility"];

  return (
    <section className="admin-dataset">
      <header className="admin-dataset-heading">
        <div>
          <h2>{labels.plural}</h2>
          <p>
            Create, edit, restore, and remove every{" "}
            {labels.singular.toLowerCase()} record.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus /> Add {labels.singular}
        </Button>
      </header>
      <div className="admin-table-toolbar">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${labels.plural.toLowerCase()}…`}
          />
        </label>
        <span>{visible.length} records</span>
      </div>
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((record) => (
              <tr key={record.id}>
                <RecordTableCells kind={kind} record={record} />
                <td className="admin-row-actions">
                  <button
                    type="button"
                    onClick={() => openEdit(record)}
                    aria-label={`Edit ${labels.singular}`}
                  >
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setConfirming(record)}
                    aria-label={`Remove ${labels.singular}`}
                  >
                    <Trash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? (
        <div className="gold-empty-copy compact">
          <Shield />
          <strong>No {labels.plural.toLowerCase()} found</strong>
          <p>Create the first record or change your search.</p>
        </div>
      ) : null}

      {editorOpen ? (
        <div
          className="admin-drawer-backdrop"
          onMouseDown={() => setEditorOpen(false)}
        >
          <aside
            className="admin-edit-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>
                  {selected
                    ? `Edit ${labels.singular}`
                    : `Add ${labels.singular}`}
                </h2>
                <p>Changes publish to the website immediately.</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)}>
                <X />
              </button>
            </header>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
              className="admin-drawer-form"
            >
              <RecordEditorFields
                kind={kind}
                values={values}
                setValue={setValue}
                gangs={gangRows}
                tournaments={tournamentRows}
                seasons={seasonRows}
              />
              {save.isError ? (
                <p className="form-error full-width">{save.error.message}</p>
              ) : null}
              <div className="admin-drawer-actions full-width">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save Changes"}
                </Button>
                {selected ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="danger-button"
                    onClick={() => setConfirming(selected)}
                  >
                    <Trash2 /> Remove
                  </Button>
                ) : null}
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {confirming ? (
        <div className="admin-confirm-backdrop">
          <div
            className="admin-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
          >
            <Trash2 />
            <h2>Remove this {labels.singular.toLowerCase()}?</h2>
            <p>
              This action will hide or delete the record. The audit log will
              record who performed it.
            </p>
            {remove.isError ? (
              <p className="form-error" role="alert">
                {remove.error.message}
              </p>
            ) : null}
            <div>
              <Button variant="outline" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                className="danger-button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirming)}
              >
                Yes, Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function streamEmbedUrl(stream: PublicLiveStream | null): string | null {
  if (!stream) return null;
  try {
    const url = stream.embedUrl ? new URL(stream.embedUrl) : null;
    if (url?.hostname === "player.twitch.tv") {
      url.searchParams.set("parent", window.location.hostname);
      url.searchParams.set("muted", "true");
      return url.toString();
    }
    if (
      url &&
      [
        "www.youtube-nocookie.com",
        "youtube-nocookie.com",
        "player.kick.com",
      ].includes(url.hostname)
    )
      return url.toString();
  } catch {
    return null;
  }
  return null;
}

function StreamManager() {
  const queryClient = useQueryClient();
  const streams = useQuery({
    queryKey: ["admin-streams"],
    queryFn: api.adminLiveStreams,
    retry: false,
  });
  const tournaments = useQuery({
    queryKey: ["admin-records", "tournament"],
    queryFn: api.adminTournaments,
    retry: false,
  });
  const rows = asArray<PublicLiveStream>(streams.data?.data);
  const tournamentRows = asArray<AdminRecord>(tournaments.data?.data);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    rows.find((item) => item.id === selectedId) ?? rows[0] ?? null;
  const [values, setValues] = useState<FormValues>({
    platform: "TWITCH",
    status: "OFFLINE",
    autoDetect: true,
    featured: false,
  });
  const [isNew, setIsNew] = useState(false);
  const setValue = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));
  useEffect(() => {
    if (!selected || isNew) return;
    setValues({
      streamerName: selected.streamerName,
      slug: selected.slug,
      platform: selected.platform,
      channelUrl: selected.channelUrl,
      embedUrl: selected.embedUrl ?? "",
      thumbnailUrl: selected.thumbnailUrl ?? "",
      providerChannelId: selected.providerChannelId ?? "",
      status: selected.status,
      autoDetect: selected.autoDetect,
      featured: selected.featured,
      tournamentId: selected.tournament?.id ?? "",
    });
  }, [selected, isNew]);
  const payload = () => ({
    streamerName: String(values.streamerName ?? ""),
    slug: String(values.slug ?? ""),
    platform: String(values.platform),
    channelUrl: String(values.channelUrl ?? ""),
    embedUrl: optional(String(values.embedUrl ?? "")),
    thumbnailUrl: optional(String(values.thumbnailUrl ?? "")),
    providerChannelId: optional(String(values.providerChannelId ?? "")),
    status: String(values.status),
    autoDetect: Boolean(values.autoDetect),
    featured: Boolean(values.featured),
    tournamentId: optional(String(values.tournamentId ?? "")),
  });
  const save = useMutation({
    mutationFn: () =>
      isNew || !selected
        ? api.createLiveStream(payload())
        : api.updateLiveStream(selected.id, payload()),
    onSuccess: (result) => {
      toast.success("Stream saved and monitoring enabled.");
      setIsNew(false);
      setSelectedId(result.data.id);
      void queryClient.invalidateQueries();
    },
  });
  const refresh = useMutation({
    mutationFn: async (id?: string) => {
      if (id) await api.refreshLiveStream(id);
      else await api.refreshAllLiveStreams();
    },
    onSuccess: () => {
      toast.success("Stream status refreshed.");
      void queryClient.invalidateQueries();
    },
  });
  const archive = useMutation({
    mutationFn: api.archiveLiveStream,
    onSuccess: () => {
      toast.success("Stream archived.");
      setSelectedId(null);
      void queryClient.invalidateQueries();
    },
  });
  const previewUrl = streamEmbedUrl(selected);
  return (
    <section className="stream-admin-layout">
      <header className="admin-dataset-heading">
        <div>
          <h2>Live Streams</h2>
          <p>
            Approve channels, preview broadcasts, and automatically detect live
            status.
          </p>
        </div>
        <div>
          <Button
            variant="outline"
            onClick={() => refresh.mutate(undefined)}
            disabled={refresh.isPending}
          >
            <RefreshCw /> Refresh Status
          </Button>
          <Button
            onClick={() => {
              setIsNew(true);
              setValues({
                platform: "TWITCH",
                status: "OFFLINE",
                autoDetect: true,
                featured: false,
              });
            }}
          >
            <Plus /> Add Stream
          </Button>
        </div>
      </header>
      <div className="stream-admin-grid">
        <div className="stream-admin-list">
          {rows.map((stream) => (
            <button
              type="button"
              key={stream.id}
              className={stream.id === selected?.id && !isNew ? "selected" : ""}
              onClick={() => {
                setIsNew(false);
                setSelectedId(stream.id);
              }}
            >
              <span
                className={`live-dot ${stream.status === "LIVE" ? "" : "offline-dot"}`}
              />
              <strong>{stream.streamerName}</strong>
              <small>
                {stream.platform} ·{" "}
                {stream.lastStatusError ? "CHECK FAILED" : stream.status}
              </small>
              <time>
                {stream.lastCheckedAt
                  ? new Date(stream.lastCheckedAt).toLocaleTimeString()
                  : "Not checked"}
              </time>
            </button>
          ))}
        </div>
        <div className="stream-admin-preview">
          <div className="live-player">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title={`${selected?.streamerName ?? "World Star"} preview`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="live-player-empty">
                <img
                  src={
                    selected?.thumbnailUrl ??
                    "/assets/wst-gold/city-overlook.png"
                  }
                  alt=""
                />
                <div>
                  <Radio />
                  <strong>
                    {selected
                      ? "Preview unavailable—open the channel or check its identifier"
                      : "Select a stream"}
                  </strong>
                </div>
              </div>
            )}
          </div>
          {selected ? (
            <div className="stream-preview-meta">
              <span
                className={
                  selected.status === "LIVE"
                    ? "live-indicator"
                    : "offline-indicator"
                }
              >
                {selected.status}
              </span>
              <strong>{selected.streamerName}</strong>
              <a href={selected.channelUrl} target="_blank" rel="noreferrer">
                Open channel
              </a>
              {selected.lastStatusError ? (
                <p className="form-error">{selected.lastStatusError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <form
          className="stream-admin-editor admin-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <h3 className="full-width">
            {isNew ? "Add Stream" : "Edit Stream Configuration"}
          </h3>
          <Field
            label="Streamer name"
            name="streamerName"
            values={values}
            setValue={setValue}
            required
          />
          <Field
            label="URL slug"
            name="slug"
            values={values}
            setValue={setValue}
            required
          />
          <SelectField
            label="Platform"
            name="platform"
            values={values}
            setValue={setValue}
            options={["TWITCH", "YOUTUBE", "KICK", "OTHER"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Field
            label="Provider channel ID / username"
            name="providerChannelId"
            values={values}
            setValue={setValue}
          />
          <Field
            label="Channel URL"
            name="channelUrl"
            values={values}
            setValue={setValue}
            type="url"
            required
            full
          />
          <Field
            label="Manual embed URL (optional)"
            name="embedUrl"
            values={values}
            setValue={setValue}
            type="url"
            full
          />
          <Field
            label="Thumbnail URL"
            name="thumbnailUrl"
            values={values}
            setValue={setValue}
            type="url"
            full
          />
          <SelectField
            label="Tournament"
            name="tournamentId"
            values={values}
            setValue={setValue}
            options={[
              { value: "", label: "Independent" },
              ...tournamentRows.map((item) => ({
                value: item.id,
                label: valueOf(item, "name"),
              })),
            ]}
          />
          <SelectField
            label="Manual status"
            name="status"
            values={values}
            setValue={setValue}
            options={["OFFLINE", "SCHEDULED", "LIVE"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <ToggleField
            label="Automatic live/offline detection"
            name="autoDetect"
            values={values}
            setValue={setValue}
          />
          <ToggleField
            label="Featured stream"
            name="featured"
            values={values}
            setValue={setValue}
          />
          {save.isError ? (
            <p className="form-error full-width">{save.error.message}</p>
          ) : null}
          <div className="admin-drawer-actions full-width">
            <Button type="submit" disabled={save.isPending}>
              Save Stream
            </Button>
            {selected && !isNew ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refresh.mutate(selected.id)}
                >
                  Check Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="danger-button"
                  onClick={() => archive.mutate(selected.id)}
                >
                  Archive
                </Button>
              </>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function AdministratorManager({
  currentUserId,
  canManageRoles,
}: {
  currentUserId: string;
  canManageRoles: boolean;
}) {
  const queryClient = useQueryClient();
  const administrators = useQuery({
    queryKey: ["administrators"],
    queryFn: api.administrators,
    retry: false,
  });
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: api.roles,
    enabled: canManageRoles,
    retry: false,
  });
  const [values, setValues] = useState<FormValues>({ status: "ACTIVE" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const administratorRows = asArray<AdministratorRecord>(
    administrators.data?.data,
  );
  const roleRows = asArray<AdminRecord>(
    (roles.data?.data as { roles?: unknown } | undefined)?.roles,
  );
  const selected =
    administratorRows.find((item) => item.id === selectedId) ?? null;
  const setValue = (name: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));
  const save = useMutation({
    mutationFn: async () => {
      if (selected) {
        const updated = await api.updateAdministrator(selected.id, {
          email: values.email,
          displayName: values.displayName,
          password: optional(String(values.password ?? "")),
          status: values.status,
        });
        if (canManageRoles && values.roleId) {
          await api.updateAdministratorRoles(selected.id, [
            String(values.roleId),
          ]);
        }
        return updated;
      }
      return api.createAdministrator({
        email: values.email,
        displayName: values.displayName,
        password: values.password,
        roleIds: [String(values.roleId)],
      });
    },
    onSuccess: () => {
      toast.success(
        selected ? "Administrator updated." : "Administrator added.",
      );
      setSelectedId(null);
      setValues({ status: "ACTIVE" });
      void queryClient.invalidateQueries();
    },
  });
  const remove = useMutation({
    mutationFn: api.removeAdministrator,
    onSuccess: () => {
      toast.success("Administrator removed.");
      void queryClient.invalidateQueries();
    },
  });
  const edit = (id: string) => {
    const item = administratorRows.find((entry) => entry.id === id);
    if (!item) return;
    setSelectedId(id);
    setValues({
      email: item.email ?? "",
      displayName: item.displayName,
      status: item.status,
      password: "",
      roleId: item.roles?.[0]?.role.id ?? "",
    });
  };
  return (
    <section className="admin-dataset">
      <header className="admin-dataset-heading">
        <div>
          <h2>Administrators</h2>
          <p>Add, update, disable, or remove website administrators.</p>
        </div>
        <Button
          onClick={() => {
            setSelectedId(null);
            setValues({ status: "ACTIVE" });
          }}
          disabled={!canManageRoles}
        >
          <Plus /> Add Administrator
        </Button>
      </header>
      <div className="administrator-admin-grid">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {administratorRows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.displayName}</strong>
                    <small>
                      {item.roles?.[0]?.role.name ?? "Super Administrator"}
                    </small>
                  </td>
                  <td>{item.email}</td>
                  <td>
                    <span
                      className={`record-status ${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.lastLoginAt
                      ? new Date(item.lastLoginAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="admin-row-actions">
                    <button type="button" onClick={() => edit(item.id)}>
                      <Pencil />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={item.id === currentUserId}
                      onClick={() => remove.mutate(item.id)}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="admin-account-form admin-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <h3 className="full-width">
            {selected ? "Edit Administrator" : "Add Administrator"}
          </h3>
          <Field
            label="Display name"
            name="displayName"
            values={values}
            setValue={setValue}
            required
            full
          />
          <Field
            label="Email"
            name="email"
            values={values}
            setValue={setValue}
            type="email"
            required
            full
          />
          <Field
            label={selected ? "New password (leave blank to keep)" : "Password"}
            name="password"
            values={values}
            setValue={setValue}
            type="password"
            required={!selected}
            full
          />
          {selected ? (
            <SelectField
              label="Status"
              name="status"
              values={values}
              setValue={setValue}
              options={recordStatuses.map((value) => ({ value, label: value }))}
            />
          ) : null}
          {canManageRoles ? (
            <SelectField
              label="Administrator role"
              name="roleId"
              values={values}
              setValue={setValue}
              options={[
                { value: "", label: "Select role" },
                ...roleRows
                  .filter((role) => role.status === "ACTIVE")
                  .map((role) => ({
                    value: role.id,
                    label: valueOf(role, "name"),
                  })),
              ]}
            />
          ) : null}
          {save.isError ? (
            <p className="form-error full-width">{save.error.message}</p>
          ) : null}
          <Button
            type="submit"
            disabled={
              save.isPending ||
              (!selected && (!canManageRoles || !values.roleId))
            }
          >
            {selected ? "Save Administrator" : "Create Administrator"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function AuditManager({ integration = false }: { integration?: boolean }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    entityId: "",
    from: "",
    to: "",
  });
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);
  const auditQuery = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
  const logs = useQuery({
    queryKey: ["audit-logs", auditQuery],
    queryFn: () => api.auditLogs(auditQuery),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["discord-audit"],
    queryFn: api.discordAuditSettings,
    enabled: integration,
    retry: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [categories, setCategories] = useState([
    "create",
    "update",
    "archive",
    "admin",
    "security",
  ]);
  useEffect(() => {
    if (!settings.data?.data) return;
    setEnabled(settings.data.data.enabled);
    setCategories(asArray<string>(settings.data.data.categories));
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      api.updateDiscordAuditSettings({
        enabled,
        webhookUrl: optional(webhookUrl),
        categories,
      }),
    onSuccess: () => {
      toast.success("Discord audit settings saved.");
      setWebhookUrl("");
      void queryClient.invalidateQueries({ queryKey: ["discord-audit"] });
    },
  });
  const test = useMutation({
    mutationFn: () => api.testDiscordAuditWebhook(optional(webhookUrl)),
    onSuccess: () => toast.success("Test log delivered to Discord."),
  });
  const auditRows = asArray<AuditRecord>(logs.data?.data);
  const toggleCategory = (category: string) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  return (
    <section className="audit-admin-layout">
      <header className="admin-dataset-heading">
        <div>
          <h2>Audit Log</h2>
          <p>See exactly who created, changed, or removed every record.</p>
        </div>
      </header>
      <div
        className={
          integration
            ? "audit-admin-grid"
            : "audit-admin-grid audit-admin-grid--logs-only"
        }
      >
        <div>
          <form
            className="admin-table-toolbar audit-filter-toolbar"
            onSubmit={(event) => event.preventDefault()}
          >
            <label>
              Action
              <input
                value={filters.action}
                onChange={(event) =>
                  setFilters((value) => ({
                    ...value,
                    action: event.target.value,
                  }))
                }
                placeholder="match.finalize"
              />
            </label>
            <label>
              Record type
              <input
                value={filters.entityType}
                onChange={(event) =>
                  setFilters((value) => ({
                    ...value,
                    entityType: event.target.value,
                  }))
                }
                placeholder="Match"
              />
            </label>
            <label>
              Record ID
              <input
                value={filters.entityId}
                onChange={(event) =>
                  setFilters((value) => ({
                    ...value,
                    entityId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              From
              <input
                type="datetime-local"
                value={filters.from}
                onChange={(event) =>
                  setFilters((value) => ({
                    ...value,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                value={filters.to}
                onChange={(event) =>
                  setFilters((value) => ({ ...value, to: event.target.value }))
                }
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setFilters({
                  action: "",
                  entityType: "",
                  entityId: "",
                  from: "",
                  to: "",
                })
              }
            >
              Clear
            </Button>
          </form>
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Record ID</th>
                  <th>Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong>{log.actor?.displayName ?? "System"}</strong>
                    </td>
                    <td>{log.action.replaceAll(".", " ")}</td>
                    <td>{log.entityType}</td>
                    <td>
                      <code>{log.entityId ?? "—"}</code>
                    </td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLog(log)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {integration ? (
          <form
            className="discord-settings-panel"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <header>
              <Radio />
              <div>
                <h3>Discord Webhook Logs</h3>
                <p>Send administrator activity to a private Discord channel.</p>
              </div>
            </header>
            <ToggleField
              label="Enable Discord audit logs"
              name="enabled"
              values={{ enabled }}
              setValue={(_, value) => setEnabled(Boolean(value))}
            />
            <label>
              Webhook URL
              <input
                type="password"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder={
                  settings.data?.data.maskedWebhookUrl ??
                  "https://discord.com/api/webhooks/…"
                }
              />
            </label>
            <fieldset>
              <legend>Event categories</legend>
              {["create", "update", "archive", "admin", "security"].map(
                (category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />{" "}
                    {category}
                  </label>
                ),
              )}
            </fieldset>
            {save.isError ? (
              <p className="form-error">{save.error.message}</p>
            ) : null}
            {test.isError ? (
              <p className="form-error">{test.error.message}</p>
            ) : null}
            <div>
              <Button type="submit">Save Settings</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => test.mutate()}
              >
                Test Webhook
              </Button>
            </div>
          </form>
        ) : null}
      </div>
      {selectedLog ? (
        <div
          className="admin-drawer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-details-title"
          onMouseDown={() => setSelectedLog(null)}
        >
          <aside
            className="admin-edit-drawer audit-details-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="audit-details-title">
                  {selectedLog.action.replaceAll(".", " ")}
                </h2>
                <p>
                  {selectedLog.entityType} ·{" "}
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close audit details"
                onClick={() => setSelectedLog(null)}
              >
                <X />
              </button>
            </header>
            {selectedLog.reason ? (
              <section>
                <h3>Reason</h3>
                <p>{selectedLog.reason}</p>
              </section>
            ) : null}
            <section>
              <h3>Before</h3>
              <pre>
                {selectedLog.beforeData === null ||
                selectedLog.beforeData === undefined
                  ? "No previous state recorded."
                  : JSON.stringify(selectedLog.beforeData, null, 2)}
              </pre>
            </section>
            <section>
              <h3>After</h3>
              <pre>
                {selectedLog.afterData === null ||
                selectedLog.afterData === undefined
                  ? "No resulting state recorded."
                  : JSON.stringify(selectedLog.afterData, null, 2)}
              </pre>
            </section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function Overview() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: api.adminOverview,
    retry: false,
  });
  const summary = overview.data?.data.summary;
  const activity = asArray<AdminOverviewData["activity"][number]>(
    overview.data?.data.activity,
  );
  const attention = overview.data?.data.attention;
  const nextMatches = asArray<AdminOverviewData["attention"]["nextMatches"][number]>(
    attention?.nextMatches,
  );
  const streamsWithErrors = asArray<
    AdminOverviewData["attention"]["streamsWithErrors"][number]
  >(attention?.streamsWithErrors);
  const labels = {
    totalGangs: "Total gangs",
    activeGangs: "Active gangs",
    totalPlayers: "Players",
    activeTournaments: "Live tournaments",
    upcomingMatches: "Upcoming matches",
    awaitingResults: "Awaiting results",
    disputedMatches: "Disputed matches",
    pendingMedia: "Pending media",
  } as const;
  return (
    <>
      <section className="control-metrics">
        {Object.entries(labels).map(([key, label]) => (
          <article key={key}>
            <span>{label}</span>
            <strong>
              {summary?.[key as keyof typeof summary] ?? "—"}
            </strong>
          </article>
        ))}
      </section>
      <div className="control-workspace">
        <section className="recent-content">
          <h2>Recent Activity</h2>
          <ol>
            {activity.map((item) => (
              <li key={item.id}>
                <span>{item.entityType}</span>
                <strong>{item.action}</strong>
                <span>{item.actor?.displayName ?? "System"}</span>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </section>
        <aside className="admin-attention-panel">
          <header>
            <Shield />
            <div>
              <strong>Operational attention</strong>
              <p>Live database checks requiring administrator review.</p>
            </div>
          </header>
          <article>
            <span>Approved entrants without seeds</span>
            <strong>
              {attention?.unseededParticipants ?? "—"}
            </strong>
          </article>
          <section>
            <h3>Next scheduled matches</h3>
            {nextMatches.length ? (
              <ol>
                {nextMatches.map((match) => (
                  <li key={match.id}>
                    <strong>
                      {match.gangA?.name ?? "TBD"} vs{" "}
                      {match.gangB?.name ?? "TBD"}
                    </strong>
                    <span>{match.tournament?.name ?? "Independent match"}</span>
                    <time>
                      {match.scheduledAt
                        ? new Date(match.scheduledAt).toLocaleString()
                        : "Not scheduled"}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No upcoming matches.</p>
            )}
          </section>
          <section>
            <h3>Stream detection errors</h3>
            {streamsWithErrors.length ? (
              <ol>
                {streamsWithErrors.map((stream) => (
                  <li key={stream.id}>
                    <strong>{stream.streamerName}</strong>
                    <span>{stream.platform}</span>
                    <p>{stream.lastStatusError}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No stream-provider errors.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function AdminCommandCenterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const requestedSection = adminSectionFromPath(location.pathname);
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: api.adminMe,
    retry: false,
  });
  const logout = useMutation({
    mutationFn: api.adminLogout,
    onSettled: () => void navigate("/admin/login"),
  });
  if (me.isPending) return <PageSkeleton />;
  if (me.isError) return <LoginPage />;
  if (location.pathname === "/admin" || location.pathname === "/admin/") {
    return <Navigate to="/admin/overview" replace />;
  }
  const grantedPermissions = asArray<string>(me.data.data.permissions);
  const visibleNavigation = navigation.filter((item) =>
    grantedPermissions.includes(item[3]),
  );
  const authorizedSection =
    requestedSection &&
    visibleNavigation.some((item) => item[2] === requestedSection);
  const effectiveSection = authorizedSection ? requestedSection : null;
  const title =
    navigation.find((item) => item[2] === effectiveSection)?.[1] ??
    "Unknown admin section";
  return (
    <div className="control-shell gold-control-shell command-center-v2">
      <aside className="control-sidebar">
        <div className="control-brand">
          <img src="/assets/wst-gold/wst-gold.png" alt="World Star" />
          <span>
            <strong>WORLD STAR</strong>
            <small>ADMIN COMMAND CENTER</small>
          </span>
        </div>
        <nav aria-label="Administrator navigation">
          {visibleNavigation.map(([Icon, label, value]) => (
            <Link
              key={value}
              className={effectiveSection === value ? "active" : ""}
              to={`/admin/${adminSectionRoutes[value]}`}
            >
              <Icon /> {label}
            </Link>
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
            <h1>{title}</h1>
            <p>Manage every World Star record from one protected workspace.</p>
          </div>
          <div className="administrator-chip">
            <Shield />
            <span>
              Administrator<small>{me.data.data.email}</small>
            </span>
          </div>
        </header>
        <AdminSectionBoundary section={effectiveSection}>
          {!effectiveSection ? (
            <section className="admin-empty-state">
              <h2>Admin section unavailable</h2>
              <p>
                This command-center route does not exist, or your administrator
                account does not have permission to open it.
              </p>
              <Button asChild>
                <Link to="/admin/overview">Return to overview</Link>
              </Button>
            </section>
          ) : null}
          {effectiveSection === "overview" ? <Overview /> : null}
          {effectiveSection === "gang" ||
          effectiveSection === "player" ||
          effectiveSection === "tournament" ||
          effectiveSection === "match" ||
          effectiveSection === "event" ? (
            <RecordsManager kind={effectiveSection} />
          ) : null}
          {effectiveSection === "gang-organization" ? (
            <GangOrganizationManager />
          ) : null}
          {effectiveSection === "bracket" ||
          effectiveSection === "participant" ? (
            <BracketManager />
          ) : null}
          {effectiveSection === "result" ? <ResultsDisputesManager /> : null}
          {effectiveSection === "stream" ? <StreamManager /> : null}
          {effectiveSection === "ranking" || effectiveSection === "season" ? (
            <SeasonsManager />
          ) : null}
          {effectiveSection === "media" ? <MediaManager /> : null}
          {effectiveSection === "administrator" ? (
            <AdministratorManager
              currentUserId={me.data.data.id}
              canManageRoles={grantedPermissions.includes("role.manage")}
            />
          ) : null}
          {effectiveSection === "roles" ? <RolesPermissionsManager /> : null}
          {effectiveSection === "settings" ? <WebsiteSettingsManager /> : null}
          {effectiveSection === "discord" ? <AuditManager integration /> : null}
          {effectiveSection === "audit" ? <AuditManager /> : null}
          {effectiveSection === "health" ? <SystemHealthManager /> : null}
        </AdminSectionBoundary>
      </main>
    </div>
  );
}

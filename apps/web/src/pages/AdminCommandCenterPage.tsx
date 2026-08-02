import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  FileClock,
  Gift,
  Gavel,
  LayoutDashboard,
  LogOut,
  Medal,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Swords,
  Trash2,
  Trophy,
  UserCog,
  Users,
  Activity,
  Eye,
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
import { CloudinaryUploadField } from "@/components/admin/CloudinaryUploadField";
import { ErrorState, PageSkeleton } from "@/components/data/StatusState";
import {
  api,
  type AdminOverviewData,
  type AdministratorRecord,
  type AuditRecord,
} from "@/lib/api";
import { BracketManager } from "./AdminPage";
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

function isRemovedRecord(record: AdminRecord): boolean {
  const rawStatus = record.status;
  const status =
    typeof rawStatus === "string" || typeof rawStatus === "number"
      ? String(rawStatus).toUpperCase()
      : "";
  return status === "ARCHIVED";
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

const navigationGroups: Array<{
  label: string;
  sections: AdminSection[];
}> = [
  { label: "Command", sections: ["overview"] },
  {
    label: "Registry",
    sections: ["gang", "gang-organization", "player", "match", "result"],
  },
  {
    label: "Competition",
    sections: ["tournament", "participant", "bracket", "ranking", "season"],
  },
  { label: "Publishing", sections: ["event", "stream", "media"] },
  {
    label: "Access & System",
    sections: [
      "settings",
      "administrator",
      "roles",
      "discord",
      "audit",
      "health",
    ],
  },
];

const kindLabels: Record<RecordKind, { singular: string; plural: string }> = {
  gang: { singular: "Gang", plural: "Gangs" },
  player: { singular: "Player", plural: "Players" },
  tournament: { singular: "Tournament", plural: "Tournaments" },
  match: { singular: "Match", plural: "Matches" },
  event: { singular: "Event", plural: "Events" },
};

const recordPermissionKeys: Record<
  RecordKind,
  { create: string; update: string; remove: string }
> = {
  gang: {
    create: "gang.create",
    update: "gang.update.any",
    remove: "gang.archive",
  },
  player: {
    create: "player.create",
    update: "player.update",
    remove: "player.archive",
  },
  tournament: {
    create: "tournament.create",
    update: "tournament.update",
    remove: "tournament.archive",
  },
  match: {
    create: "match.create",
    update: "match.update",
    remove: "match.update",
  },
  event: {
    create: "event.manage",
    update: "event.manage",
    remove: "event.manage",
  },
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

function showMutationError(error: Error): void {
  toast.error(error.message || "The action could not be completed.");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function kickChannelName(value: string): string {
  const input = value.trim();
  if (!input) return "";
  try {
    const url = new URL(
      input.includes("://") ? input : `https://kick.com/${input}`,
    );
    if (url.hostname !== "kick.com" && url.hostname !== "www.kick.com")
      return "";
    return (url.pathname.split("/").filter(Boolean)[0] ?? "")
      .replace(/^@/, "")
      .toLowerCase();
  } catch {
    return "";
  }
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

const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

function safeHexColor(value: unknown, fallback = "#6C90C3") {
  return typeof value === "string" && hexColorPattern.test(value)
    ? value.toUpperCase()
    : fallback;
}

function GangNameColorField({
  values,
  setValue,
}: {
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
}) {
  const value = String(values.primaryColor ?? "#6C90C3");
  const previewColor = safeHexColor(value);
  const previewName = String(values.name ?? "").trim() || "Gang Name";

  return (
    <section className="gang-name-color-field full-width">
      <header>
        <div>
          <strong>Gang name color</strong>
          <small>
            Match the public gang name to the logo, banner, or gang identity.
          </small>
        </div>
        <span
          className="gang-name-color-field__swatch"
          style={{ backgroundColor: previewColor }}
          aria-hidden="true"
        />
      </header>
      <div className="gang-name-color-field__controls">
        <label>
          Choose color
          <input
            aria-label="Gang name color picker"
            type="color"
            value={previewColor}
            onChange={(event) =>
              setValue("primaryColor", event.target.value.toUpperCase())
            }
          />
        </label>
        <label>
          Hex color
          <input
            aria-label="Gang name color hex"
            type="text"
            value={value}
            maxLength={7}
            pattern="^#[0-9a-fA-F]{6}$"
            placeholder="#6C90C3"
            title="Enter a six-digit hex color such as #6C90C3"
            onChange={(event) =>
              setValue("primaryColor", event.target.value.toUpperCase())
            }
          />
        </label>
      </div>
      <div className="gang-name-color-field__preview">
        <span>Public name preview</span>
        <strong style={{ color: previewColor }}>{previewName}</strong>
        <small>{previewColor}</small>
      </div>
    </section>
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

function TournamentRulesEditor({
  values,
  setValue,
}: {
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
}) {
  const serializedRules = String(values.rules ?? "");
  const rules = (serializedRules ? serializedRules.split(/\r?\n/) : [""]).slice(
    0,
    20,
  );
  const ruleCount = rules.filter((rule) => Boolean(rule.trim())).length;
  const hasRules = ruleCount > 0;
  const updateRules = (nextRules: string[]) =>
    setValue("rules", nextRules.slice(0, 20).join("\n"));
  const updateRule = (index: number, value: string) => {
    const nextRules = [...rules];
    nextRules[index] = value.replace(/\r?\n/g, " ");
    updateRules(nextRules);
  };
  const removeRule = (index: number) => {
    const nextRules = rules.filter((_, ruleIndex) => ruleIndex !== index);
    updateRules(nextRules.length ? nextRules : [""]);
  };
  const canAddRule =
    rules.length < 20 && Boolean(rules[rules.length - 1]?.trim());

  return (
    <section className="tournament-rules-editor full-width">
      <header>
        <span className="tournament-rules-editor__icon">
          <BookOpen aria-hidden="true" />
        </span>
        <div>
          <span className="tournament-rules-editor__eyebrow">
            Public tournament guide
          </span>
          <h3>Tournament Rules</h3>
          <p>
            Add up to 20 separate rules. They publish as a numbered guide on
            this tournament&apos;s public page.
          </p>
        </div>
        <span
          className={
            hasRules
              ? "tournament-rules-editor__status is-published"
              : "tournament-rules-editor__status"
          }
        >
          {hasRules ? `${String(ruleCount)} / 20 added` : "No rules added"}
        </span>
      </header>
      <div className="tournament-rule-list">
        {rules.map((rule, index) => (
          <article className="tournament-rule-row" key={String(index)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <label>
              <span>Rule {String(index + 1)}</span>
              <textarea
                aria-label={`Rule ${String(index + 1)}`}
                value={rule}
                rows={2}
                maxLength={950}
                onChange={(event) => updateRule(index, event.target.value)}
                placeholder={
                  index === 0
                    ? "Example: All gangs must check in 15 minutes before the match."
                    : "Write the next tournament rule."
                }
              />
            </label>
            <button
              type="button"
              aria-label={`Delete rule ${String(index + 1)}`}
              onClick={() => removeRule(index)}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
      <footer>
        <span>
          {String(ruleCount)} of 20 rules ·{" "}
          {serializedRules.length.toLocaleString()} characters
        </span>
        <div>
          <Button
            type="button"
            variant="outline"
            className="tournament-rules-editor__remove"
            disabled={!hasRules}
            onClick={() => setValue("rules", "")}
          >
            <Trash2 /> Delete all
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canAddRule}
            onClick={() => updateRules([...rules, ""])}
          >
            <Plus /> Add Rule
          </Button>
          <Button type="submit">
            <Save /> Save rules
          </Button>
        </div>
      </footer>
    </section>
  );
}

const tournamentPrizePlacements = [
  { placement: 1, label: "First place", shortLabel: "1st", tone: "first" },
  { placement: 2, label: "Second place", shortLabel: "2nd", tone: "second" },
  { placement: 3, label: "Third place", shortLabel: "3rd", tone: "third" },
] as const;

type TournamentPrizeFormItem = {
  placement: number;
  itemOrder: number;
  title: string;
  amount: string;
  imageUrl: string;
};

const maxTournamentPrizeItemsPerPlace = 10;

function parseTournamentPrizeItems(value: unknown): TournamentPrizeFormItem[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const source = item as Record<string, unknown>;
        const placement = Number(source.placement);
        const itemOrder = Number(source.itemOrder ?? index);
        if (
          ![1, 2, 3].includes(placement) ||
          !Number.isInteger(itemOrder) ||
          itemOrder < 0 ||
          itemOrder >= maxTournamentPrizeItemsPerPlace
        ) {
          return [];
        }
        return [
          {
            placement,
            itemOrder,
            title: typeof source.title === "string" ? source.title : "",
            amount: typeof source.amount === "string" ? source.amount : "",
            imageUrl:
              typeof source.imageUrl === "string" ? source.imageUrl : "",
          },
        ];
      })
      .sort(
        (left, right) =>
          left.placement - right.placement || left.itemOrder - right.itemOrder,
      );
  } catch {
    return [];
  }
}

function normalizeTournamentPrizeItems(
  items: TournamentPrizeFormItem[],
): TournamentPrizeFormItem[] {
  return tournamentPrizePlacements.flatMap(({ placement }) =>
    items
      .filter((item) => item.placement === placement)
      .slice(0, maxTournamentPrizeItemsPerPlace)
      .map((item, itemOrder) => ({ ...item, placement, itemOrder })),
  );
}

function TournamentPrizesEditor({
  values,
  setValue,
}: {
  values: FormValues;
  setValue: (name: string, value: string | boolean) => void;
}) {
  const prizeItems = parseTournamentPrizeItems(values.tournamentPrizesJson);
  const configuredCount = prizeItems.filter(
    (item) => item.title.trim() && item.amount.trim(),
  ).length;
  const updateItems = (items: TournamentPrizeFormItem[]) =>
    setValue(
      "tournamentPrizesJson",
      JSON.stringify(normalizeTournamentPrizeItems(items)),
    );

  return (
    <section className="tournament-prizes-editor full-width">
      <header>
        <span className="tournament-prizes-editor__icon">
          <Trophy aria-hidden="true" />
        </span>
        <div>
          <span className="tournament-prizes-editor__eyebrow">
            Tournament reward podium
          </span>
          <h3>Prizes</h3>
          <p>
            Add up to 10 separate rewards for each podium place. Empty reward
            items stay unpublished.
          </p>
        </div>
        <span className="tournament-prizes-editor__status">
          {String(configuredCount)} / 30 rewards
        </span>
      </header>

      <div className="tournament-prize-placement-list">
        {tournamentPrizePlacements.map(
          ({ placement, label, shortLabel, tone }) => {
            const placementItems = prizeItems.filter(
              (item) => item.placement === placement,
            );
            return (
              <article
                className={`tournament-prize-placement tournament-prize-placement--${tone}`}
                key={placement}
              >
                <header className="tournament-prize-placement__header">
                  <div className="tournament-prize-placement__place">
                    <Medal aria-hidden="true" />
                    <span>{shortLabel}</span>
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {String(placementItems.length)} / 10 reward items
                      </small>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Add reward to ${label}`}
                    disabled={
                      placementItems.length >= maxTournamentPrizeItemsPerPlace
                    }
                    onClick={() =>
                      updateItems([
                        ...prizeItems,
                        {
                          placement,
                          itemOrder: placementItems.length,
                          title: "",
                          amount: "",
                          imageUrl: "",
                        },
                      ])
                    }
                  >
                    <Plus /> Add reward
                  </Button>
                </header>

                {placementItems.length ? (
                  <div className="tournament-prize-item-list">
                    {placementItems.map((item, index) => {
                      const updateItem = (
                        key: "title" | "amount" | "imageUrl",
                        value: string,
                      ) =>
                        updateItems(
                          prizeItems.map((candidate) =>
                            candidate.placement === placement &&
                            candidate.itemOrder === item.itemOrder
                              ? { ...candidate, [key]: value }
                              : candidate,
                          ),
                        );
                      const hasContent = Boolean(
                        item.title || item.amount || item.imageUrl,
                      );
                      return (
                        <section
                          className="tournament-prize-item-editor"
                          key={`${String(placement)}-${String(item.itemOrder)}`}
                        >
                          <header>
                            <span>Reward {String(index + 1)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label={`Remove ${label} reward ${String(index + 1)}`}
                              onClick={() =>
                                updateItems(
                                  prizeItems.filter(
                                    (candidate) => candidate !== item,
                                  ),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </header>
                          <div className="tournament-prize-item-editor__fields">
                            <label>
                              Prize title
                              <input
                                aria-label={`${label} reward ${String(index + 1)} title`}
                                value={item.title}
                                required={hasContent}
                                maxLength={120}
                                onChange={(event) =>
                                  updateItem("title", event.target.value)
                                }
                                placeholder="Example: Championship package"
                              />
                            </label>
                            <label>
                              Amount or value
                              <input
                                aria-label={`${label} reward ${String(index + 1)} amount`}
                                value={item.amount}
                                required={hasContent}
                                maxLength={120}
                                onChange={(event) =>
                                  updateItem("amount", event.target.value)
                                }
                                placeholder="Example: $5,000 or custom vehicle"
                              />
                            </label>
                            <CloudinaryUploadField
                              label={`${label} reward ${String(index + 1)} image`}
                              value={item.imageUrl}
                              onChange={(url) => updateItem("imageUrl", url)}
                              category="tournament-prize"
                              full
                            />
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tournament-prize-placement__empty">
                    <Gift aria-hidden="true" />
                    <div>
                      <strong>No rewards added</strong>
                      <span>
                        Add the first reward for {label.toLowerCase()}.
                      </span>
                    </div>
                  </div>
                )}
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}

function blankValues(kind: RecordKind): FormValues {
  if (kind === "gang")
    return {
      status: "ACTIVE",
      recruitmentStatus: "CLOSED",
      primaryColor: "#6C90C3",
      secondaryColor: "#171f55",
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
      tournamentPrizesJson: "[]",
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
      primaryColor: valueOf(record, "primaryColor") || "#6C90C3",
      secondaryColor: valueOf(record, "secondaryColor") || "#171f55",
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
  if (kind === "tournament") {
    const prizes = Array.isArray(record.prizes)
      ? (record.prizes as Array<Record<string, unknown>>)
      : [];
    const prizeOrderByPlacement = new Map<number, number>();
    const prizeItems = prizes.flatMap((prize) => {
      const placement = Number(prize.placement);
      if (![1, 2, 3].includes(placement)) return [];
      const fallbackOrder = prizeOrderByPlacement.get(placement) ?? 0;
      const parsedOrder = Number(prize.itemOrder);
      const itemOrder = Number.isInteger(parsedOrder)
        ? parsedOrder
        : fallbackOrder;
      prizeOrderByPlacement.set(
        placement,
        Math.max(fallbackOrder + 1, itemOrder + 1),
      );
      return [
        {
          placement,
          itemOrder,
          title: typeof prize.title === "string" ? prize.title : "",
          amount: typeof prize.amount === "string" ? prize.amount : "",
          imageUrl: typeof prize.imageUrl === "string" ? prize.imageUrl : "",
        },
      ];
    });
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
      tournamentPrizesJson: JSON.stringify(
        normalizeTournamentPrizeItems(prizeItems),
      ),
    };
  }
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
    rules: valueOf(record, "rules"),
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
      slug:
        optional(String(values.slug ?? "")) ??
        slugify(String(values.name ?? "")),
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
      slug:
        optional(String(values.slug ?? "")) ??
        slugify(String(values.displayName ?? "")),
      biography: optional(String(values.biography ?? "")),
      avatarUrl: optional(String(values.avatarUrl ?? "")),
      externalFivemId: optional(String(values.externalFivemId ?? "")),
      status: String(values.status),
    };
  if (kind === "tournament") {
    const prizes = normalizeTournamentPrizeItems(
      parseTournamentPrizeItems(values.tournamentPrizesJson),
    )
      .filter(
        (item) =>
          item.title.trim() || item.amount.trim() || item.imageUrl.trim(),
      )
      .map((item) => ({
        placement: item.placement,
        itemOrder: item.itemOrder,
        title: item.title.trim(),
        amount: item.amount.trim(),
        imageUrl: optional(item.imageUrl.trim()) ?? null,
      }));
    return {
      name: String(values.name ?? ""),
      slug:
        optional(String(values.slug ?? "")) ??
        slugify(String(values.name ?? "")),
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
      rules: optional(String(values.rules ?? "")) ?? null,
      prizeDescription: optional(String(values.prizeDescription ?? "")),
      featured: Boolean(values.featured),
      publicVisible: Boolean(values.publicVisible),
      prizes,
    };
  }
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
    rules: optional(String(values.rules ?? "")),
    imageUrl: optional(String(values.imageUrl ?? "")),
    location: optional(String(values.location ?? "")),
    startsAt: toIso(String(values.startsAt ?? "")),
    endsAt: toIso(String(values.endsAt ?? "")),
    status: String(values.status),
    featured: Boolean(values.featured),
  };
}

function changedPayloadFor(
  kind: RecordKind,
  values: FormValues,
  record: AdminRecord,
): Record<string, unknown> {
  const next = payloadFor(kind, values) as Record<string, unknown>;
  const previous = payloadFor(kind, valuesFromRecord(kind, record)) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key]),
    ),
  );
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
          <strong
            style={{
              color: safeHexColor(valueOf(record, "primaryColor"), "#F7F9FC"),
            }}
          >
            {valueOf(record, "name")}
          </strong>
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
          label="URL slug (auto if blank)"
          name="slug"
          values={values}
          setValue={setValue}
        />
        <CloudinaryUploadField
          label="Gang logo"
          value={String(values.logoUrl ?? "")}
          onChange={(url) => setValue("logoUrl", url)}
          category="gang-logo"
          full
        />
        <CloudinaryUploadField
          label="Gang banner"
          value={String(values.bannerUrl ?? "")}
          onChange={(url) => setValue("bannerUrl", url)}
          category="gang-banner"
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
        <GangNameColorField values={values} setValue={setValue} />
        <Field
          label="Gang accent color"
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
          label="URL slug (auto if blank)"
          name="slug"
          values={values}
          setValue={setValue}
          full
        />
        <CloudinaryUploadField
          label="Player avatar"
          value={String(values.avatarUrl ?? "")}
          onChange={(url) => setValue("avatarUrl", url)}
          category="player-avatar"
          full
        />
        <Field
          label="External FiveM identifier"
          name="externalFivemId"
          values={values}
          setValue={setValue}
          full
        />
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
          label="URL slug (auto if blank)"
          name="slug"
          values={values}
          setValue={setValue}
        />
        <Field
          label="Participant capacity"
          name="maximumParticipants"
          values={values}
          setValue={setValue}
          type="number"
          required
        />
        <CloudinaryUploadField
          label="Tournament banner"
          value={String(values.bannerUrl ?? "")}
          onChange={(url) => setValue("bannerUrl", url)}
          category="tournament-banner"
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
        <TournamentRulesEditor values={values} setValue={setValue} />
        <TournamentPrizesEditor values={values} setValue={setValue} />
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
      <CloudinaryUploadField
        label="Event image or video"
        value={String(values.imageUrl ?? "")}
        onChange={(url) => setValue("imageUrl", url)}
        category="event-image"
        kind="image-or-video"
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
      <label className="full-width">
        Event rules
        <textarea
          value={String(values.rules ?? "")}
          onChange={(event) => setValue("rules", event.target.value)}
          placeholder="Publish attendance, participation, conduct, or tournament rules for this event."
        />
      </label>
    </>
  );
}

function RecordsManager({
  kind,
  permissions,
}: {
  kind: RecordKind;
  permissions: readonly string[];
}) {
  const queryClient = useQueryClient();
  const labels = kindLabels[kind];
  const permissionSet = new Set(permissions);
  const permissionKeys = recordPermissionKeys[kind];
  const canCreate = permissionSet.has(permissionKeys.create);
  const canUpdate = permissionSet.has(permissionKeys.update);
  const canRemove = permissionSet.has(permissionKeys.remove);
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
    queryKey: ["admin-record-options", "gang"],
    queryFn: api.adminGangs,
    enabled: kind === "match",
    retry: false,
  });
  const tournaments = useQuery({
    queryKey: ["admin-record-options", "tournament"],
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
  const rows = useMemo(
    () => asArray<AdminRecord>(records.data),
    [records.data],
  );
  const activeRows = useMemo(
    () => rows.filter((record) => !isRemovedRecord(record)),
    [rows],
  );
  const gangRows = asArray<AdminRecord>(gangs.data?.data).filter(
    (record) => !isRemovedRecord(record),
  );
  const tournamentRows = asArray<AdminRecord>(tournaments.data?.data).filter(
    (record) => !isRemovedRecord(record),
  );
  const seasonRows = asArray<AdminRecord>(seasons.data?.data);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? activeRows.filter((row) =>
          JSON.stringify(row).toLowerCase().includes(term),
        )
      : activeRows;
  }, [activeRows, search]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = selected
        ? changedPayloadFor(kind, values, selected)
        : payloadFor(kind, values);
      if (selected) {
        if (Object.keys(payload).length === 0) return null;
        if (kind === "gang") return api.updateGang(selected.id, payload);
        if (kind === "player") return api.updatePlayer(selected.id, payload);
        if (kind === "tournament") {
          const hasBannerUpdate = Object.prototype.hasOwnProperty.call(
            payload,
            "bannerUrl",
          );
          const bannerUrl =
            typeof payload.bannerUrl === "string" ? payload.bannerUrl : null;
          const tournamentPayload = { ...payload };
          delete tournamentPayload.bannerUrl;
          let result: unknown = null;
          if (Object.keys(tournamentPayload).length > 0) {
            result = await api.updateTournament(selected.id, tournamentPayload);
          }
          if (hasBannerUpdate) {
            result = await api.updateTournamentBanner(selected.id, bannerUrl);
          }
          return result;
        }
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
    onError: showMutationError,
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
    onError: showMutationError,
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
    <section
      className={`admin-dataset admin-records-manager admin-records-manager--${kind}`}
    >
      <header className="admin-dataset-heading">
        <div>
          <span className="admin-dataset-kicker">
            {labels.singular} directory
          </span>
          <h2>{labels.singular} records</h2>
          <p>
            Create, edit, and remove every {labels.singular.toLowerCase()}{" "}
            record. Removed records are hidden after refresh.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={openNew}>
            <Plus /> Add {labels.singular}
          </Button>
        ) : (
          <span className="admin-read-only-badge">Read-only access</span>
        )}
      </header>
      {records.isError ? (
        <ErrorState
          compact
          title={`${labels.plural} could not load`}
          message={records.error.message}
          retry={() => void records.refetch()}
        />
      ) : null}
      <div className="admin-table-toolbar">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${labels.plural.toLowerCase()}…`}
          />
        </label>
        <span className="admin-record-count">
          <strong>{visible.length}</strong>
          <small>
            {visible.length === 1 ? "record shown" : "records shown"}
          </small>
        </span>
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
                  {canUpdate ? (
                    <button
                      type="button"
                      onClick={() => openEdit(record)}
                      aria-label={`Edit ${labels.singular}`}
                    >
                      <Pencil />
                    </button>
                  ) : null}
                  {canRemove ? (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setConfirming(record)}
                      aria-label={`Remove ${labels.singular}`}
                    >
                      <Trash2 />
                    </button>
                  ) : null}
                  {!canUpdate && !canRemove ? <span>Read only</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && !records.isError ? (
        <div className="gold-empty-copy compact">
          <Shield />
          <strong>No {labels.plural.toLowerCase()} found</strong>
          <p>Create the first record or change your search.</p>
        </div>
      ) : null}

      {editorOpen ? (
        <div
          className="admin-drawer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected ? "Edit" : "Add"} ${labels.singular}`}
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
                <Button
                  type="submit"
                  disabled={
                    save.isPending || (selected ? !canUpdate : !canCreate)
                  }
                >
                  {save.isPending ? "Saving…" : "Save Changes"}
                </Button>
                {selected && canRemove ? (
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
    queryKey: ["admin-record-options", "tournament"],
    queryFn: api.adminTournaments,
    retry: false,
  });
  const rows = asArray<PublicLiveStream>(streams.data?.data).filter(
    (stream) => stream.status !== "ARCHIVED",
  );
  const tournamentRows = asArray<AdminRecord>(tournaments.data?.data).filter(
    (record) => !isRemovedRecord(record),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    rows.find((item) => item.id === selectedId) ?? rows[0] ?? null;
  const [values, setValues] = useState<FormValues>({
    platform: "KICK",
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
  const payload = () => {
    const streamerName = String(values.streamerName ?? "").trim();
    const kickName = kickChannelName(streamerName);
    if (isNew) {
      return {
        streamerName: streamerName.replace(/^@/, ""),
        slug: slugify(kickName),
        platform: "KICK",
        channelUrl: `https://kick.com/${kickName}`,
        embedUrl: `https://player.kick.com/${kickName}`,
        providerChannelId: kickName,
        status: "OFFLINE",
        autoDetect: true,
        featured: false,
      };
    }
    return {
      streamerName,
      slug: optional(String(values.slug ?? "")) ?? slugify(streamerName),
      platform: String(values.platform),
      channelUrl: String(values.channelUrl ?? ""),
      embedUrl: optional(String(values.embedUrl ?? "")),
      thumbnailUrl: optional(String(values.thumbnailUrl ?? "")),
      providerChannelId: optional(String(values.providerChannelId ?? "")),
      status: String(values.status),
      autoDetect: Boolean(values.autoDetect),
      featured: Boolean(values.featured),
      tournamentId: optional(String(values.tournamentId ?? "")),
    };
  };
  const save = useMutation({
    mutationFn: async () => {
      if (isNew || !selected) {
        const result = await api.createLiveStream(payload());
        try {
          await api.refreshLiveStream(result.data.id);
        } catch {
          // The record is already saved. Scheduled monitoring can retry Kick.
        }
        return result;
      }
      return api.updateLiveStream(selected.id, payload());
    },
    onSuccess: (result) => {
      toast.success("Stream saved and monitoring enabled.");
      setIsNew(false);
      setSelectedId(result.data.id);
      void queryClient.invalidateQueries();
    },
    onError: showMutationError,
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
    onError: showMutationError,
  });
  const archive = useMutation({
    mutationFn: api.archiveLiveStream,
    onSuccess: () => {
      toast.success("Stream archived.");
      setSelectedId(null);
      void queryClient.invalidateQueries();
    },
    onError: showMutationError,
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
                platform: "KICK",
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
      {streams.isError || tournaments.isError ? (
        <ErrorState
          compact
          title="Stream manager could not load"
          message={
            (streams.error ?? tournaments.error)?.message ??
            "The stream records could not be loaded."
          }
          retry={() => {
            void streams.refetch();
            void tournaments.refetch();
          }}
        />
      ) : null}
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
                  className={
                    selected?.thumbnailUrl ? "user-media-original" : undefined
                  }
                  src={
                    selected?.thumbnailUrl ??
                    "/assets/wst-red/city-overlook-red.jpg"
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
            label={isNew ? "Kick streamer name" : "Streamer name"}
            name="streamerName"
            values={values}
            setValue={setValue}
            required
            full={isNew}
          />
          {isNew ? (
            <p className="stream-quick-add-hint full-width">
              Enter only the Kick name, for example <strong>absi</strong>. The
              channel link, player, and automatic viewer tracking are created
              for you.
            </p>
          ) : (
            <>
              <Field
                label="URL slug (auto if blank)"
                name="slug"
                values={values}
                setValue={setValue}
              />
              <SelectField
                label="Platform"
                name="platform"
                values={values}
                setValue={setValue}
                options={["TWITCH", "YOUTUBE", "KICK", "OTHER"].map(
                  (value) => ({
                    value,
                    label: value,
                  }),
                )}
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
              <CloudinaryUploadField
                label="Stream thumbnail"
                value={String(values.thumbnailUrl ?? "")}
                onChange={(url) => setValue("thumbnailUrl", url)}
                category="stream-thumbnail"
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
            </>
          )}
          {save.isError ? (
            <p className="form-error full-width">{save.error.message}</p>
          ) : null}
          <div className="admin-drawer-actions full-width">
            <Button
              type="submit"
              disabled={
                save.isPending ||
                (isNew && !kickChannelName(String(values.streamerName ?? "")))
              }
            >
              {isNew ? "Add Kick Streamer" : "Save Stream"}
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
    onError: showMutationError,
  });
  const remove = useMutation({
    mutationFn: api.removeAdministrator,
    onSuccess: () => {
      toast.success("Administrator removed.");
      void queryClient.invalidateQueries();
    },
    onError: showMutationError,
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
      {administrators.isError || roles.isError ? (
        <ErrorState
          compact
          title="Administrator records could not load"
          message={
            (administrators.error ?? roles.error)?.message ??
            "The administrator records could not be loaded."
          }
          retry={() => {
            void administrators.refetch();
            if (canManageRoles) void roles.refetch();
          }}
        />
      ) : null}
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
    onError: showMutationError,
  });
  const test = useMutation({
    mutationFn: () => api.testDiscordAuditWebhook(optional(webhookUrl)),
    onSuccess: () => toast.success("Test log delivered to Discord."),
    onError: showMutationError,
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
      {logs.isError || settings.isError ? (
        <ErrorState
          compact
          title={
            integration
              ? "Discord integration could not load"
              : "Audit log could not load"
          }
          message={
            (logs.error ?? settings.error)?.message ??
            "The audit records could not be loaded."
          }
          retry={() => {
            void logs.refetch();
            if (integration) void settings.refetch();
          }}
        />
      ) : null}
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
  const nextMatches = asArray<
    AdminOverviewData["attention"]["nextMatches"][number]
  >(attention?.nextMatches);
  const streamsWithErrors = asArray<
    AdminOverviewData["attention"]["streamsWithErrors"][number]
  >(attention?.streamsWithErrors);
  const labels = {
    totalGangs: [Shield, "Total gangs"],
    activeGangs: [Activity, "Active gangs"],
    totalPlayers: [Users, "Players"],
    activeTournaments: [Trophy, "Live tournaments"],
    upcomingMatches: [CalendarDays, "Upcoming matches"],
    awaitingResults: [FileClock, "Awaiting results"],
    disputedMatches: [Gavel, "Disputed matches"],
    pendingMedia: [Eye, "Pending media"],
  } as const;
  if (overview.isError)
    return (
      <ErrorState
        title="Admin overview could not load"
        message={overview.error.message}
        retry={() => void overview.refetch()}
      />
    );
  return (
    <>
      <section className="control-metrics">
        {Object.entries(labels).map(([key, [Icon, label]]) => (
          <article key={key}>
            <Icon />
            <div>
              <span>{label}</span>
              <strong>{summary?.[key as keyof typeof summary] ?? "—"}</strong>
            </div>
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
            <strong>{attention?.unseededParticipants ?? "—"}</strong>
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
  const queryClient = useQueryClient();
  const requestedSection = adminSectionFromPath(location.pathname);
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: api.adminMe,
    retry: false,
  });
  const logout = useMutation({
    mutationFn: api.adminLogout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["admin-me"], exact: true });
      void navigate("/admin/login", { replace: true });
    },
    onError: showMutationError,
  });
  if (me.isPending) return <PageSkeleton />;
  if (me.isError)
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
    );
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
      <aside className="control-sidebar admin-sidebar">
        <Link
          className="control-brand admin-sidebar-brand"
          to="/"
          title="Open the World Star home page"
        >
          <img src="/assets/wst/wst-logo.png" alt="World Star" />
          <span>
            <strong>WORLD STAR</strong>
            <small>ADMIN COMMAND CENTER</small>
          </span>
        </Link>
        <nav aria-label="Administrator navigation">
          {navigationGroups.map((group) => {
            const items = visibleNavigation.filter((item) =>
              group.sections.includes(item[2]),
            );
            if (!items.length) return null;
            return (
              <section className="control-nav-group" key={group.label}>
                <strong>{group.label}</strong>
                {items.map(([Icon, label, value]) => (
                  <Link
                    key={value}
                    className={effectiveSection === value ? "active" : ""}
                    to={`/admin/${adminSectionRoutes[value]}`}
                    title={label}
                  >
                    <Icon />
                    <span>{label}</span>
                  </Link>
                ))}
              </section>
            );
          })}
        </nav>
        <div className="admin-sidebar-account">
          <Shield />
          <span>
            Administrator<small>{me.data.data.email}</small>
          </span>
        </div>
        <button
          type="button"
          className="control-logout"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <LogOut />
          <span>{logout.isPending ? "Logging out…" : "Log out"}</span>
        </button>
      </aside>
      <main className="control-main">
        <header className="control-heading">
          <div>
            <h1>{title}</h1>
            <p>Manage every World Star record from one protected workspace.</p>
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
            <RecordsManager
              kind={effectiveSection}
              permissions={grantedPermissions}
            />
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

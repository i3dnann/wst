import {
  ArrowLeft,
  Award,
  CalendarDays,
  Crosshair,
  MapPin,
  Shield,
  ShieldCheck,
  Swords,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback = "Not published",
) {
  return typeof record[key] === "string" && record[key]
    ? record[key]
    : fallback;
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value: unknown = record[key];
  return Array.isArray(value) ? value : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  fallback = 0,
) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatDate(value: unknown, fallback = "Not published") {
  if (typeof value !== "string" && !(value instanceof Date)) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? fallback
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(parsed);
}

function memberLabel(count: number) {
  return `${String(count)} active ${count === 1 ? "member" : "members"}`;
}

export default function GangDetailPage() {
  const { slug = "" } = useParams();
  const gang = useQuery({
    queryKey: ["gang", slug],
    queryFn: () => api.gang(slug),
    enabled: Boolean(slug),
  });
  if (gang.isPending) return <PageSkeleton />;
  if (gang.isError)
    return (
      <main className="page-shell">
        <ErrorState retry={() => void gang.refetch()} />
      </main>
    );

  const data = gang.data.data;
  const memberships = readArray(data, "memberships");
  const seasonStat = readRecord(readArray(data, "seasonStats")[0]);
  const matchesPlayed = readNumber(seasonStat, "matchesPlayed");
  const wins = readNumber(seasonStat, "wins");
  const trophies = readArray(data, "awards").filter(
    (award) =>
      readString(readRecord(award), "type", "") === "TOURNAMENT_VICTORY",
  ).length;
  const stats = [
    [Users, "Members", memberships.length],
    [Swords, "Matches", matchesPlayed],
    [Trophy, "Wins", wins],
    [Shield, "Losses", readNumber(seasonStat, "losses")],
    [Crosshair, "Kills", readNumber(seasonStat, "kills")],
    [
      TrendingUp,
      "Win rate",
      `${String(matchesPlayed ? Math.round((wins / matchesPlayed) * 1000) / 10 : 0)}%`,
    ],
    [Award, "Trophies", trophies],
  ] as const;
  const description = readString(
    data,
    "description",
    "No public description has been approved.",
  );
  const history = readString(data, "history", "");

  return (
    <main className="gang-profile-v3">
      <section className="gang-profile-v3__hero">
        {typeof data.bannerUrl === "string" ? (
          <img
            className="gang-profile-v3__banner"
            src={data.bannerUrl}
            alt=""
          />
        ) : null}
        <div className="gang-profile-v3__hero-fade" />
        <div className="gang-profile-v3__hero-inner">
          <Link className="gang-profile-v3__back" to="/gangs">
            <ArrowLeft aria-hidden="true" /> Gang Registry
          </Link>
          <div className="gang-profile-v3__identity">
            <div className="gang-profile-v3__crest">
              {typeof data.logoUrl === "string" ? (
                <img
                  src={data.logoUrl}
                  alt={`${readString(data, "name")} logo`}
                />
              ) : (
                <span>{readString(data, "tag", "M").slice(0, 1)}</span>
              )}
            </div>
            <div>
              <div className="gang-profile-v3__name">
                <h1>{readString(data, "name")}</h1>
                {data.verified === true ? (
                  <span>
                    <ShieldCheck aria-hidden="true" /> Verified
                  </span>
                ) : null}
              </div>
              <strong>[{readString(data, "tag")}]</strong>
              <p>{readString(data, "motto")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="gang-profile-v3__body">
        <dl className="gang-profile-v3__stats">
          {stats.map(([Icon, label, value]) => (
            <div key={label}>
              <Icon aria-hidden="true" />
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="gang-profile-v3__content">
          <section className="gang-profile-v3__overview">
            <h2>Overview</h2>
            <div className="gang-profile-v3__facts">
              <div>
                <MapPin aria-hidden="true" />
                <span>
                  <small>Territory</small>
                  <strong>{readString(data, "territory")}</strong>
                </span>
              </div>
              <div>
                <CalendarDays aria-hidden="true" />
                <span>
                  <small>Founded</small>
                  <strong>{formatDate(data.foundedAt)}</strong>
                </span>
              </div>
              <div>
                <Users aria-hidden="true" />
                <span>
                  <small>Active members</small>
                  <strong>{memberLabel(memberships.length)}</strong>
                </span>
              </div>
            </div>
            <div className="gang-profile-v3__story">
              <small>Description / History</small>
              <p>{description}</p>
              {history && history !== description ? <p>{history}</p> : null}
            </div>
          </section>

          <section className="gang-profile-v3__roster">
            <header>
              <div>
                <h2>Roster</h2>
                <p>{memberLabel(memberships.length)}</p>
              </div>
            </header>
            {memberships.length ? (
              <div className="gang-profile-v3__roster-table">
                <div
                  className="gang-profile-v3__roster-head"
                  aria-hidden="true"
                >
                  <span>Member</span>
                  <span>Role</span>
                  <span>Joined</span>
                  <span>Status</span>
                </div>
                {memberships.map((entry, index) => {
                  const membership = readRecord(entry);
                  const player = readRecord(membership.player);
                  const role = readRecord(membership.gangRole);
                  const displayName = readString(player, "displayName");
                  const callsign = readString(membership, "callsign", "");
                  return (
                    <article
                      className="gang-profile-v3__member"
                      key={
                        typeof membership.id === "string"
                          ? membership.id
                          : index
                      }
                    >
                      <div className="gang-profile-v3__member-identity">
                        <div>
                          {typeof player.avatarUrl === "string" ? (
                            <img src={player.avatarUrl} alt="" />
                          ) : (
                            <span>{displayName.slice(0, 1)}</span>
                          )}
                        </div>
                        <span>
                          <strong>{displayName}</strong>
                          {callsign ? <small>{callsign}</small> : null}
                        </span>
                      </div>
                      <span>{readString(role, "name", "Member")}</span>
                      <time>{formatDate(membership.joinedAt, "—")}</time>
                      <strong className="gang-profile-v3__member-status">
                        {readString(player, "status", "ACTIVE")}
                      </strong>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Roster not published"
                message="Approved public memberships will appear here."
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

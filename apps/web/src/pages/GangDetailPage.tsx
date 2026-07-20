import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
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

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item: unknown) => item);
}
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  return (
    <main className="gang-profile">
      <section
        className="profile-banner"
        style={
          typeof data.bannerUrl === "string"
            ? { backgroundImage: `url(${data.bannerUrl})` }
            : undefined
        }
      >
        <div className="profile-banner-shade" />
        <Button asChild variant="ghost">
          <Link to="/gangs">
            <ArrowLeft data-icon="inline-start" />
            Registry
          </Link>
        </Button>
        <div className="profile-title">
          <div className="gang-crest gang-crest--profile">
            {typeof data.logoUrl === "string" ? (
              <img src={data.logoUrl} alt="" />
            ) : (
              readString(data, "tag", "M").slice(0, 1)
            )}
          </div>
          <div>
            <h1>{readString(data, "name")}</h1>
            <p>{readString(data, "motto")}</p>
          </div>
          {data.verified === true ? (
            <ShieldCheck aria-label="Verified gang" />
          ) : null}
        </div>
      </section>
      <div className="profile-body">
        <section className="profile-overview">
          <h2>Overview</h2>
          <p>
            {readString(
              data,
              "description",
              "No public description has been approved.",
            )}
          </p>
          <div className="profile-facts">
            <span>
              <MapPin />
              {readString(data, "territory")}
            </span>
            <span>
              <CalendarDays />
              {readString(data, "foundedAt")}
            </span>
            <span>
              <Users />
              {memberships.length} active members
            </span>
          </div>
        </section>
        <section>
          <div className="section-heading">
            <h2>Roster</h2>
          </div>
          {memberships.length ? (
            <div className="roster-list">
              {memberships.map((entry, index) => {
                const membership = readRecord(entry);
                const player = readRecord(membership.player);
                const role = readRecord(membership.gangRole);
                return (
                  <article
                    className="roster-row"
                    key={
                      typeof membership.id === "string" ? membership.id : index
                    }
                  >
                    <div className="roster-avatar">
                      {readString(player, "displayName", "?").slice(0, 1)}
                    </div>
                    <div>
                      <strong>{readString(player, "displayName")}</strong>
                      <span>{readString(role, "name", "Member")}</span>
                    </div>
                    <span>{readString(player, "status", "ACTIVE")}</span>
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
    </main>
  );
}

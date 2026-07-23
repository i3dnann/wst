import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Crown,
  Radio,
  Shield,
  Swords,
  Trophy,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Ripple } from "@/components/ui/ripple";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { api } from "@/lib/api";
import { cloudinaryMediaKindFromUrl } from "@/lib/cloudinary";
import { usePublicWebsiteSettings } from "@/lib/website-settings";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const defaultHeroSubtitle =
  "Where every rivalry becomes history. Follow verified matches, live tournaments, gang rankings, events, and streams from one official command center.";

const defaultHeroTitle = "WORLD STAR CFW";

const legacyHeroTitles = new Set([
  "WORLD STAR",
  "Where gangs compete. Legends rule.",
]);

const legacyHeroSubtitle =
  "Live tournaments, verified match records, rankings, events, and streams—managed from one protected admin system.";

export default function HomePage() {
  const navigate = useNavigate();
  const website = usePublicWebsiteSettings();
  const [home, tournaments, events, streams] = useQueries({
    queries: [
      { queryKey: ["home"], queryFn: api.home, retry: false },
      { queryKey: ["tournaments"], queryFn: api.tournaments, retry: false },
      { queryKey: ["events"], queryFn: api.events, retry: false },
      { queryKey: ["live-streams"], queryFn: api.liveStreams, retry: false },
    ],
  });

  const summary = home.data?.data.summary;
  const leadingGangs = home.data?.data.rankings.slice(0, 5) ?? [];
  const tournamentList = (tournaments.data?.data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    startAt: string;
    status: string;
    maximumParticipants: number;
  }>;
  const featuredTournament = tournamentList[0];
  const upcomingEvents = events.data?.data.slice(0, 3) ?? [];
  const liveStreams =
    streams.data?.data.filter((stream) => stream.status === "LIVE") ?? [];
  const settings = website.data;
  const heroTitle =
    !settings?.homepage.heroTitle ||
    legacyHeroTitles.has(settings.homepage.heroTitle)
      ? defaultHeroTitle
      : settings.homepage.heroTitle;
  const heroSubtitle =
    !settings?.homepage.heroSubtitle ||
    settings.homepage.heroSubtitle === legacyHeroSubtitle
      ? defaultHeroSubtitle
      : settings.homepage.heroSubtitle;
  const heroMediaUrl =
    settings?.homepage.heroMediaUrl ||
    "/assets/wst-red/city-overlook-red.jpg";

  const stats = [
    [Trophy, "Tournaments", tournamentList.length],
    [CalendarDays, "Active Events", upcomingEvents.length],
    [Swords, "Completed Matches", summary?.completedMatches ?? 0],
    [Crown, "Top Gangs", summary?.registeredGangs ?? 0],
    [Radio, "Live Now", liveStreams.length],
  ] as const;

  return (
    <main className="gold-home">
      <section className="gold-hero">
        {cloudinaryMediaKindFromUrl(heroMediaUrl) === "video" ? (
          <video
            className="gold-hero-image"
            src={heroMediaUrl}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            className="gold-hero-image"
            src={heroMediaUrl}
            alt="A World Star figure overlooking the city at night"
          />
        )}
        <div className="gold-hero-shade" />
        <div className="gold-hero-content">
          <div className="gold-hero-emblem">
            <Ripple
              className="gold-hero-ripple"
              mainCircleSize={240}
              mainCircleOpacity={0.18}
              numCircles={5}
            />
            <img
              className="gold-hero-mark"
              src="/assets/wst/wst-logo.png"
              alt="World Star"
            />
          </div>
          <h1>{heroTitle}</h1>
          <p>{heroSubtitle}</p>
          <div className="gold-hero-actions">
            <ShimmerButton
              className="hero-shimmer-button"
              background="linear-gradient(135deg, #6f0d1c, #d2273f)"
              borderRadius="6px"
              shimmerColor="#ffb3bd"
              onClick={() => void navigate("/gangs")}
            >
              <Shield /> Explore the Gangs <ArrowRight />
            </ShimmerButton>
            <Button asChild size="lg" variant="outline">
              <Link to="/tournaments">
                <Trophy /> View Tournaments
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="gold-stat-rail" aria-label="World Star overview">
        {stats.map(([Icon, label, value]) => (
          <article key={label}>
            <Icon />
            <div>
              <strong>{label}</strong>
              <span>
                {value > 0 ? (
                  <NumberTicker value={value} />
                ) : (
                  "Awaiting records"
                )}
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="home-competition-band">
        <div className="home-feature-media">
          <img
            src="/assets/wst-red/sealed-dossier-red.jpg"
            alt="Sealed World Star dossier"
            loading="lazy"
            decoding="async"
          />
        </div>
        <article className="home-feature-summary">
          <header className="gold-section-heading">
            <div>
              <span>Featured Tournament</span>
              <h2>
                {(featuredTournament?.name ?? "The next showdown awaits").replace(
                  /(\d+)-/g,
                  "$1\u2011",
                )}
              </h2>
            </div>
          </header>
          {featuredTournament ? (
            <div className="gold-feature-copy">
              <p>
                {formatDate(featuredTournament.startAt)} ·{" "}
                {featuredTournament.maximumParticipants} gangs
              </p>
              <Button asChild>
                <Link to={`/tournaments/${featuredTournament.slug}`}>
                  Open Tournament <ArrowRight />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="gold-empty-copy">
              <strong>No tournament featured</strong>
              <p>The administrator has not published a tournament yet.</p>
              <Button asChild variant="outline">
                <Link to="/tournaments">View Tournaments</Link>
              </Button>
            </div>
          )}
        </article>

        <aside className="home-events-panel">
          <header className="gold-section-heading">
            <div>
              <span>Upcoming Events</span>
              <h2>What happens next</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/events">
                View All Events <ArrowRight />
              </Link>
            </Button>
          </header>
          {upcomingEvents.length ? (
            <ol className="gold-event-list">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.startsAt}>
                    {formatDate(event.startsAt)}
                  </time>
                  <strong>{event.title}</strong>
                  <p>
                    {event.description ?? "Details will be announced soon."}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="gold-empty-copy tall">
              <CalendarDays />
              <strong>No upcoming events</strong>
              <p>
                New server events will appear here when the administrator
                publishes them.
              </p>
            </div>
          )}
        </aside>
      </section>

      <section className="gold-registry-section">
        <header className="gold-section-heading">
          <div>
            <span>Leading Gangs</span>
            <h2>The gangs climbing the board</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/gangs">
              View All Gangs <ArrowRight />
            </Link>
          </Button>
        </header>
        <div className="gold-table" role="table" aria-label="Leading gangs">
          <div className="gold-table-row gold-table-head" role="row">
            <span>Rank</span>
            <span>Gang</span>
            <span>Members</span>
            <span>Wins</span>
            <span>Win rate</span>
          </div>
          {leadingGangs.length ? (
            leadingGangs.map((gang, index) => (
              <Link
                to={`/gangs/${gang.slug}`}
                className="gold-table-row"
                role="row"
                key={gang.id}
              >
                <strong>#{gang.currentRank ?? index + 1}</strong>
                <span className="gold-gang-name">
                  {gang.logoUrl ? (
                    <img src={gang.logoUrl} alt="" />
                  ) : (
                    <Shield />
                  )}
                  <b>{gang.name}</b>
                  <small>{gang.tag}</small>
                </span>
                <span>{gang.memberCount}</span>
                <span>{gang.wins}</span>
                <span>{gang.winRate}%</span>
              </Link>
            ))
          ) : (
            <div className="gold-empty-copy wide">
              <Crown />
              <strong>No gangs registered</strong>
              <p>
                Rankings will begin after the administrator publishes the first
                gangs.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="gold-live-strip">
        <div>
          <Radio />
          <span>Live Streamers</span>
          <h2>
            {liveStreams.length
              ? `${String(liveStreams.length)} approved stream${liveStreams.length === 1 ? "" : "s"} live now`
              : "No streams are live"}
          </h2>
          <p>
            Tournament coverage appears only after approval from the
            administrator.
          </p>
        </div>
        <Button asChild>
          <Link to="/live">
            Open Live Page <ArrowRight />
          </Link>
        </Button>
      </section>
    </main>
  );
}

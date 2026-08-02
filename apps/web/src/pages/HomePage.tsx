import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Crown,
  Radio,
  Shield,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Ripple } from "@/components/ui/ripple";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { api } from "@/lib/api";
import { cloudinaryMediaKindFromUrl } from "@/lib/cloudinary";
import { usePublicWebsiteSettings } from "@/lib/website-settings";

const defaultHeroSubtitle =
  "Where every rivalry becomes history. Follow verified matches, live tournaments, gang rankings, events, and streams from one official command center.";
const defaultHeroTitle = "WORLD STAR CFW";
const legacyHeroTitles = new Set([
  "WORLD STAR",
  "Where gangs compete. Legends rule.",
]);
const legacyHeroSubtitle =
  "Live tournaments, verified match records, rankings, events, and streams—managed from one protected admin system.";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

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
  const heroTitleWords = heroTitle.trim().split(/\s+/);
  const heroTitleAccent =
    heroTitleWords.length > 1 ? heroTitleWords.pop() : heroTitleWords[0];
  const heroTitlePrimary =
    heroTitleWords.length > 0 ? heroTitleWords.join(" ") : heroTitle;
  const heroMediaUrl =
    settings?.homepage.heroMediaUrl || "/assets/wst-red/city-overlook-red.jpg";

  const stats = [
    [Shield, "Registered Gangs", summary?.registeredGangs ?? 0, "Total"],
    [Users, "Registered Players", summary?.registeredPlayers ?? 0, "Total"],
    [Trophy, "Tournaments", tournamentList.length, "Total"],
    [Swords, "Matches Played", summary?.completedMatches ?? 0, "Total"],
    [Crown, "Ranked Gangs", leadingGangs.length, "Total"],
    [Radio, "Live Streamers", liveStreams.length, "Live now"],
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
          <h1 aria-label={heroTitle}>
            <span className="gold-hero-title-primary">{heroTitlePrimary}</span>
            <span className="gold-hero-title-accent">{heroTitleAccent}</span>
          </h1>
          <p>{heroSubtitle}</p>
          <div className="gold-hero-actions">
            <ShimmerButton
              className="hero-shimmer-button"
              background="linear-gradient(135deg, #171f55, #274272)"
              borderRadius="6px"
              shimmerColor="#6c90c3"
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
        {stats.map(([Icon, label, value, caption]) => (
          <article key={label}>
            <span className="home-stat-icon">
              <Icon />
            </span>
            <div>
              <strong>{label}</strong>
              <span className="home-stat-value">
                <NumberTicker value={value} />
              </span>
              <small>{caption}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="home-dashboard-grid">
        <section className="home-competition-band">
          <article className="home-feature-summary">
            <header className="gold-section-heading">
              <div>
                <span>Featured Tournament</span>
                <h2>Featured Tournament</h2>
              </div>
            </header>
            {featuredTournament ? (
              <div className="home-featured-tournament">
                <div className="home-command-icon" aria-hidden="true">
                  <Trophy />
                </div>
                <div>
                  <strong>
                    {featuredTournament.name.replace(/(\d+)-/g, "$1\u2011")}
                  </strong>
                  <p>
                    {formatDate(featuredTournament.startAt)} ·{" "}
                    {featuredTournament.maximumParticipants} gangs
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to={`/tournaments/${featuredTournament.slug}`}>
                    Open Tournament <ArrowRight />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="home-command-empty">
                <div className="home-command-icon" aria-hidden="true">
                  <Swords />
                </div>
                <strong>No tournament featured</strong>
                <p>A new featured tournament will be announced soon.</p>
                <Button asChild variant="outline">
                  <Link to="/tournaments">
                    View Tournaments <ArrowRight />
                  </Link>
                </Button>
              </div>
            )}
          </article>

          <aside className="home-events-panel">
            <header className="gold-section-heading">
              <div>
                <span>Upcoming Events</span>
                <h2>Upcoming Events</h2>
              </div>
            </header>
            {upcomingEvents.length ? (
              <>
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
                <Button asChild variant="outline">
                  <Link to="/events">
                    View All Events <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="home-command-empty">
                <div className="home-command-icon" aria-hidden="true">
                  <CalendarDays />
                </div>
                <strong>No upcoming events</strong>
                <p>There are no upcoming events scheduled at this time.</p>
                <Button asChild variant="outline">
                  <Link to="/events">
                    View All Events <ArrowRight />
                  </Link>
                </Button>
              </div>
            )}
          </aside>
        </section>

        <section className="gold-registry-section">
          <header className="gold-section-heading">
            <div>
              <span>Leading Gangs</span>
              <h2>Leading Gangs</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/rankings">
                <Crown /> View Rankings <ArrowRight />
              </Link>
            </Button>
          </header>
          <div
            className="home-rankings-table"
            role="table"
            aria-label="Leading gangs"
          >
            <div className="home-ranking-row home-ranking-head" role="row">
              <span>Rank</span>
              <span>Gang</span>
              <span>Points</span>
            </div>
            {leadingGangs.length
              ? leadingGangs.map((gang, index) => (
                  <Link
                    to={`/gangs/${gang.slug}`}
                    className="home-ranking-row"
                    role="row"
                    key={gang.id}
                  >
                    <strong>
                      {String(gang.currentRank ?? index + 1).padStart(2, "0")}
                    </strong>
                    <span className="home-ranking-gang">
                      {gang.logoUrl ? (
                        <img
                          className="user-media-original"
                          src={gang.logoUrl}
                          alt=""
                        />
                      ) : (
                        <img src="/assets/wst/wst-logo.png" alt="" />
                      )}
                      <b>{gang.name}</b>
                    </span>
                    <span>{gang.points}</span>
                  </Link>
                ))
              : Array.from({ length: 5 }, (_, index) => (
                  <div className="home-ranking-row" role="row" key={index}>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    <span className="home-ranking-gang">
                      <img src="/assets/wst/wst-logo.png" alt="" />
                      <b>No gang ranked</b>
                    </span>
                    <span>--</span>
                  </div>
                ))}
          </div>
          <Button asChild variant="outline" className="home-rankings-cta">
            <Link to="/rankings">
              View Full Rankings <ArrowRight />
            </Link>
          </Button>
        </section>
      </section>

      <section className="gold-live-strip">
        <div>
          <span>Live Streamers</span>
          <span className="home-live-icon">
            <Radio />
          </span>
          <h2>
            {liveStreams.length
              ? `${String(liveStreams.length)} approved stream${liveStreams.length === 1 ? "" : "s"} live now`
              : "No one is live right now"}
          </h2>
          <p>Check back later for live gang streams and matches.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live">
            View Live <ArrowRight />
          </Link>
        </Button>
      </section>
    </main>
  );
}

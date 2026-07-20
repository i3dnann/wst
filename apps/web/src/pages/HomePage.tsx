import {
  ArrowRight,
  Crown,
  Scale,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/data/StatusState";
import { api } from "@/lib/api";
import type { GangListItem } from "@mafia/shared";

const summaryItems = [
  ["registeredGangs", "Registered gangs", Users],
  ["registeredPlayers", "Registered players", ShieldCheck],
  ["completedMatches", "Completed matches", Swords],
  ["activeTournament", "Active tournament", Trophy],
] as const;

const honors: Array<[LucideIcon, string]> = [
  [Trophy, "Tournament champions"],
  [Crown, "All-time MVPs"],
  [Swords, "Best win streak"],
  [ShieldCheck, "Elite tacticians"],
];

function SectionHeading({
  title,
  href,
  action,
}: {
  title: string;
  href: string;
  action: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <Link to={href}>
        {action}
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

function GangDossier({
  gang,
  featured = false,
}: {
  gang: GangListItem;
  featured?: boolean;
}) {
  return (
    <Link to={`/gangs/${gang.slug}`} className="gang-dossier">
      {featured ? (
        <BorderBeam
          colorFrom="#7A1725"
          colorTo="#D0B36A"
          duration={9}
          size={90}
        />
      ) : null}
      <div className="gang-crest" aria-hidden="true">
        {gang.logoUrl ? (
          <img src={gang.logoUrl} alt="" />
        ) : (
          gang.tag.slice(0, 1)
        )}
      </div>
      <div className="gang-identity">
        <h3>{gang.name}</h3>
        <span>{gang.tag}</span>
      </div>
      <dl>
        <div>
          <dt>Rank</dt>
          <dd>{gang.currentRank ? `#${String(gang.currentRank)}` : "—"}</dd>
        </div>
        <div>
          <dt>Members</dt>
          <dd>{gang.memberCount}</dd>
        </div>
        <div>
          <dt>Wins</dt>
          <dd>{gang.wins}</dd>
        </div>
        <div>
          <dt>Win rate</dt>
          <dd>{String(gang.winRate)}%</dd>
        </div>
      </dl>
    </Link>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const home = useQuery({ queryKey: ["home"], queryFn: api.home });
  const data = home.data?.data;

  return (
    <main>
      <section className="hero-section">
        <div className="hero-grain" aria-hidden="true" />
        <BlurFade className="hero-copy" duration={0.65}>
          <h1>
            Every empire
            <br />
            leaves a record.
          </h1>
          <p>
            The official registry for gangs, tournaments, rankings, and match
            intelligence.
          </p>
          <div className="hero-actions">
            <ShimmerButton
              onClick={() => {
                void navigate("/gangs");
              }}
              background="linear-gradient(135deg, #7A1725, #3B0B12)"
              borderRadius="2px"
              shimmerColor="#D0B36A"
            >
              Explore Gangs <ArrowRight aria-hidden="true" />
            </ShimmerButton>
            <Button asChild variant="outline" size="lg">
              <Link to="/tournaments">
                View Tournaments
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </BlurFade>
        <BlurFade
          className="hero-art"
          direction="left"
          delay={0.08}
          duration={0.8}
        >
          <img
            src="/assets/mafia-dossier-hero.png"
            alt="Black leather intelligence dossier with an engraved Mafia insignia"
          />
        </BlurFade>
        <div className="summary-rail">
          {summaryItems.map(([key, label, Icon], index) => (
            <div className="summary-item" key={key}>
              {index === 3 ? (
                <BorderBeam
                  colorFrom="#7A1725"
                  colorTo="#D0B36A"
                  duration={10}
                />
              ) : null}
              <Icon aria-hidden="true" />
              <div>
                <strong>
                  {data ? <NumberTicker value={data.summary[key]} /> : "—"}
                </strong>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <BlurFade inView>
        <section className="content-section">
          <SectionHeading
            title="Featured Gangs"
            href="/gangs"
            action="View all gangs"
          />
          {home.isError ? (
            <ErrorState compact retry={() => void home.refetch()} />
          ) : data?.featuredGangs.length ? (
            <div className="gang-rail">
              {data.featuredGangs.map((gang, index) => (
                <GangDossier key={gang.id} gang={gang} featured={index === 0} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No featured gangs"
              message="Approved gangs marked as featured will appear in this dossier rail."
            />
          )}
        </section>
      </BlurFade>

      <BlurFade inView>
        <section className="tournament-watch">
          <div>
            <h2>Tournament Watch</h2>
            <p>
              The live bracket, participant registry, schedules, and finalized
              results are published from the tournament service.
            </p>
            <Button asChild variant="outline">
              <Link to="/tournaments">
                Open tournaments
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <div className="bracket-preview">
            <EmptyState
              title="No active tournament"
              message="The next approved tournament will appear here when registration or play begins."
            />
          </div>
        </section>
      </BlurFade>

      <BlurFade inView>
        <section className="content-section rankings-section">
          <SectionHeading
            title="Rankings"
            href="/rankings"
            action="Full rankings"
          />
          {home.isError ? (
            <ErrorState compact retry={() => void home.refetch()} />
          ) : data?.rankings.length ? (
            <div className="ranking-ledger">
              {data.rankings.map((gang) => (
                <div className="ranking-row" key={gang.id}>
                  <strong>
                    {gang.currentRank
                      ? String(gang.currentRank).padStart(2, "0")
                      : "—"}
                  </strong>
                  <div className="rank-mark">{gang.tag.slice(0, 1)}</div>
                  <Link to={`/gangs/${gang.slug}`}>{gang.name}</Link>
                  <span>
                    {gang.wins}–{gang.losses}
                  </span>
                  <span>{gang.kills} kills</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Rankings not calculated"
              message="The active season leaderboard will appear after verified ranking events exist."
            />
          )}
        </section>
      </BlurFade>

      <BlurFade inView>
        <section className="split-intelligence">
          <div>
            <SectionHeading
              title="Top Players"
              href="/players"
              action="View all players"
            />
            <EmptyState
              title="No players ranked yet"
              message="Verified player statistics will establish the first ranking."
            />
          </div>
          <div className="mvp-feature">
            <div className="mvp-insignia">
              <Crown aria-hidden="true" />
            </div>
            <div>
              <h2>Current MVP</h2>
              <EmptyState
                title="No MVP selected"
                message="An authorized award will appear with its statistics snapshot."
              />
            </div>
          </div>
        </section>
      </BlurFade>

      <BlurFade inView>
        <section className="activity-grid">
          <div>
            <SectionHeading
              title="Recent Match Results"
              href="/matches"
              action="View all matches"
            />
            <EmptyState
              title="No completed matches"
              message="Finalized results will appear exactly once."
            />
          </div>
          <div>
            <SectionHeading
              title="Gang Movement"
              href="/rankings"
              action="View activity"
            />
            <EmptyState
              title="No movement recorded"
              message="Ranking changes will appear after recalculation."
            />
          </div>
        </section>
      </BlurFade>

      <BlurFade inView>
        <section className="champions-strip">
          <SectionHeading
            title="Hall of Champions"
            href="/rankings"
            action="View history"
          />
          <div className="honor-grid">
            {honors.map(([Icon, label]) => (
              <div key={label}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
                <strong>No record yet</strong>
              </div>
            ))}
          </div>
        </section>
      </BlurFade>

      <BlurFade inView>
        <section className="rules-banner">
          <Scale aria-hidden="true" />
          <div>
            <h2>Rules of Engagement</h2>
            <p>
              Respect the code. Protect your crew. Every competitive action
              remains auditable.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/rules">
              Read the rules
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>
      </BlurFade>
    </main>
  );
}

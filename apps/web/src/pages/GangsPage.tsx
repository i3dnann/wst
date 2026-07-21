import { Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "@/components/data/StatusState";
import { api } from "@/lib/api";

export default function GangsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [recruitment, setRecruitment] = useState("");
  const [sort, setSort] = useState("rank");
  const deferredSearch = useDeferredValue(search);
  const queryString = new URLSearchParams({
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(status ? { status } : {}),
    ...(recruitment ? { recruitment } : {}),
    sort,
  }).toString();
  const gangs = useQuery({
    queryKey: ["gangs", queryString],
    queryFn: () => api.gangs(queryString),
  });

  const reset = () => {
    setSearch("");
    setStatus("ACTIVE");
    setRecruitment("");
    setSort("rank");
  };

  return (
    <main className="page-shell registry-page">
      <header className="page-heading">
        <div>
          <h1>Gang Registry</h1>
          <p>
            The official directory of approved gangs competing across the World
            Star community.
          </p>
        </div>
        <img className="registry-seal" src="/assets/wst/wst-logo.png" alt="" />
      </header>
      <section className="filter-rail" aria-label="Gang filters">
        <label className="search-control">
          <Search aria-hidden="true" />
          <span className="sr-only">Search gangs</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or tag"
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label>
          <span>Recruitment</span>
          <select
            value={recruitment}
            onChange={(event) => setRecruitment(event.target.value)}
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="INVITE_ONLY">Invite only</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="rank">Rank</option>
            <option value="name">Alphabetical</option>
            <option value="newest">Newest</option>
            <option value="wins">Wins</option>
            <option value="kills">Kills</option>
          </select>
        </label>
        <Button variant="ghost" onClick={reset}>
          <X data-icon="inline-start" />
          Reset
        </Button>
      </section>
      <div className="results-toolbar">
        <strong>{gangs.data?.meta.total ?? 0} results</strong>
      </div>
      {gangs.isPending ? (
        <PageSkeleton />
      ) : gangs.isError ? (
        <ErrorState retry={() => void gangs.refetch()} />
      ) : gangs.data.data.length === 0 ? (
        <EmptyState
          title="No gangs found"
          message="Try adjusting the search or filters. No unapproved gangs are exposed."
        />
      ) : (
        <section className="registry-list">
          {gangs.data.data.map((gang, index) => (
            <article className="registry-dossier" key={gang.id}>
              {index === 0 ? (
                <BorderBeam
                  colorFrom="#9f1d2f"
                  colorTo="#ef4058"
                  duration={10}
                  size={100}
                />
              ) : null}
              <div className="registry-rank">
                {gang.currentRank ? `#${String(gang.currentRank)}` : "—"}
              </div>
              <div className="gang-crest gang-crest--large">
                {gang.logoUrl ? (
                  <img src={gang.logoUrl} alt={`${gang.name} logo`} />
                ) : (
                  gang.tag.slice(0, 1)
                )}
              </div>
              <div className="registry-identity">
                <h2>{gang.name}</h2>
                <span>[{gang.tag}]</span>
                <div>
                  <Badge variant="secondary">{gang.status}</Badge>
                  {gang.verified ? <Badge>Verified</Badge> : null}
                </div>
              </div>
              <dl>
                {[
                  ["Members", gang.memberCount],
                  ["Matches", gang.matchesPlayed],
                  ["Wins", gang.wins],
                  ["Losses", gang.losses],
                  ["Kills", gang.kills],
                  ["Win rate", `${String(gang.winRate)}%`],
                  ["Trophies", gang.trophies],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <Button asChild variant="outline">
                <Link to={`/gangs/${gang.slug}`}>View dossier</Link>
              </Button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

import {
  ArrowRight,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  const resultCount = Math.max(
    gangs.data?.meta.total ?? 0,
    gangs.data?.data.length ?? 0,
  );

  const reset = () => {
    setSearch("");
    setStatus("ACTIVE");
    setRecruitment("");
    setSort("rank");
  };

  return (
    <main className="page-shell gang-registry-v3">
      <header className="gang-registry-v3__hero">
        <div>
          <h1>Gang Registry</h1>
          <p>
            The official directory of approved gangs competing across the World
            Star community.
          </p>
        </div>
        <img src="/assets/wst/wst-logo.png" alt="" />
      </header>

      <section className="gang-registry-v3__filters" aria-label="Gang filters">
        <label className="gang-registry-v3__search">
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
          </select>
        </label>
        <Button variant="ghost" onClick={reset}>
          <X data-icon="inline-start" /> Reset
        </Button>
      </section>

      <div className="gang-registry-v3__results">
        <strong>
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </strong>
        <span>Approved public records</span>
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
        <section className="gang-registry-v3__list">
          {gangs.data.data.map((gang) => {
            return (
              <article className="gang-registry-card" key={gang.id}>
                <div className="gang-registry-card__media">
                  {gang.bannerUrl ? (
                    <img
                      className="gang-registry-card__banner"
                      src={gang.bannerUrl}
                      alt=""
                    />
                  ) : null}
                  <div className="gang-registry-card__fade" />
                  <div className="gang-registry-card__identity">
                    <div className="gang-registry-card__crest">
                      {gang.logoUrl ? (
                        <img src={gang.logoUrl} alt={`${gang.name} logo`} />
                      ) : (
                        <span>{gang.tag.slice(0, 1)}</span>
                      )}
                    </div>
                    <div>
                      <Link to={`/gangs/${gang.slug}`}>
                        <h2>{gang.name}</h2>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                      <strong>[{gang.tag}]</strong>
                      <p>{gang.motto ?? "No motto published."}</p>
                      <div className="gang-registry-card__badges">
                        <span>{gang.status}</span>
                        {gang.verified ? (
                          <span>
                            <ShieldCheck aria-hidden="true" /> Verified
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className="gang-registry-card__rank">
                    {gang.currentRank
                      ? `Rank #${String(gang.currentRank)}`
                      : "Unranked"}
                  </span>
                </div>
                <div className="gang-registry-card__footer">
                  <Button asChild variant="outline">
                    <Link to={`/gangs/${gang.slug}`}>
                      View Gang <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

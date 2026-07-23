import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  Play,
  Radio,
  Tv2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { PublicLiveStream } from "@mafia/shared";

const viewerNumberFormatter = new Intl.NumberFormat();

function safeEmbedUrl(stream: PublicLiveStream | undefined): string | null {
  if (!stream) return null;
  try {
    let value = stream.embedUrl;
    const identifier = stream.providerChannelId?.trim();
    if (!value && stream.platform === "YOUTUBE" && stream.liveVideoId)
      value = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(stream.liveVideoId)}`;
    if (!value && stream.platform === "TWITCH" && identifier)
      value = `https://player.twitch.tv/?channel=${encodeURIComponent(identifier)}`;
    if (!value && stream.platform === "KICK" && identifier)
      value = `https://player.kick.com/${encodeURIComponent(identifier)}`;
    if (!value) return null;
    const url = new URL(value);
    const allowed = [
      "youtube.com",
      "youtube-nocookie.com",
      "twitch.tv",
      "kick.com",
    ];
    if (
      url.protocol !== "https:" ||
      !allowed.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    )
      return null;
    if (url.hostname === "player.twitch.tv") {
      url.searchParams.set("parent", window.location.hostname);
      url.searchParams.set("muted", "true");
    }
    return url.toString();
  } catch {
    return null;
  }
}

export default function LivePage() {
  const [streams, events] = useQueries({
    queries: [
      {
        queryKey: ["live-streams"],
        queryFn: api.liveStreams,
        retry: false,
        refetchInterval: 60_000,
      },
      { queryKey: ["events"], queryFn: api.events, retry: false },
    ],
  });
  const list = useMemo(() => streams.data?.data ?? [], [streams.data?.data]);
  const liveCount =
    streams.data?.meta.liveCount ??
    list.filter((stream) => stream.status === "LIVE").length;
  const totalViewers =
    streams.data?.meta.totalViewers ??
    list.reduce(
      (total, stream) =>
        total + (stream.status === "LIVE" ? stream.viewerCount : 0),
      0,
    );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () =>
      list.find((stream) => stream.id === selectedId) ??
      list.find((stream) => stream.status === "LIVE") ??
      list[0],
    [list, selectedId],
  );
  const embedUrl = safeEmbedUrl(selected);

  return (
    <main className="gold-content-page live-page">
      <header className="live-title">
        <Radio />
        <h1>LIVE FROM WORLD STAR</h1>
        <p>Watch approved streamers covering official tournaments.</p>
      </header>
      <section className="live-metrics" aria-label="Live stream totals">
        <article>
          <Eye aria-hidden="true" />
          <span>Total live viewers</span>
          <strong>{viewerNumberFormatter.format(totalViewers)}</strong>
        </article>
        <article>
          <Radio aria-hidden="true" />
          <span>Live now</span>
          <strong>{liveCount}</strong>
        </article>
        <article>
          <Tv2 aria-hidden="true" />
          <span>Approved channels</span>
          <strong>{list.length}</strong>
        </article>
      </section>
      <section className="live-layout">
        <div className="live-stage">
          <div className="live-player">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={`${selected?.streamerName ?? "World Star"} live stream`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="live-player-empty">
                <img
                  src="/assets/wst-red/city-overlook-red.jpg"
                  alt="World Star city at night"
                />
                <div>
                  <Play />
                  <strong>
                    {selected
                      ? "Open the approved channel to watch"
                      : "No stream is live"}
                  </strong>
                </div>
              </div>
            )}
          </div>
          <div className="live-stage-info">
            <img src="/assets/wst/wst-logo.png" alt="" />
            <div>
              <span
                className={
                  selected?.status === "LIVE"
                    ? "live-indicator"
                    : "offline-indicator"
                }
              >
                {selected?.status ?? "OFFLINE"}
              </span>
              <h2>{selected?.streamerName ?? "World Star Live"}</h2>
              <p>
                {selected?.streamTitle ??
                  selected?.tournament?.name ??
                  "Approved tournament coverage will appear here."}
              </p>
              {selected?.categoryName ? (
                <small className="live-category">{selected.categoryName}</small>
              ) : null}
            </div>
            {selected ? (
              <Button asChild variant="outline">
                <a href={selected.channelUrl} target="_blank" rel="noreferrer">
                  Watch on {selected.platform} <ArrowUpRight />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        <aside className="stream-rail">
          <h2>Approved Streams</h2>
          {list.length ? (
            list.map((stream) => (
              <button
                type="button"
                className={stream.id === selected?.id ? "selected" : ""}
                key={stream.id}
                onClick={() => setSelectedId(stream.id)}
              >
                <span
                  className={
                    stream.status === "LIVE" ? "live-dot" : "offline-dot"
                  }
                />
                <strong>{stream.streamerName}</strong>
                <small>
                  {stream.platform} / {stream.status}
                </small>
                <span className="stream-viewers">
                  <Eye aria-hidden="true" />
                  {stream.status === "LIVE"
                    ? viewerNumberFormatter.format(stream.viewerCount)
                    : "—"}
                </span>
              </button>
            ))
          ) : (
            <div className="gold-empty-copy compact">
              <Radio />
              <strong>No approved streams</strong>
              <p>Nothing is broadcasting right now.</p>
            </div>
          )}
        </aside>
      </section>
      <section className="live-events-preview">
        <div className="gold-section-heading">
          <div>
            <span>Server Events</span>
            <h2>Upcoming from World Star</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/events">View All Events</Link>
          </Button>
        </div>
        {(events.data?.data ?? []).length ? (
          <ol>
            {(events.data?.data ?? []).slice(0, 4).map((event) => (
              <li key={event.id}>
                <CalendarDays />
                <div>
                  <strong>{event.title}</strong>
                  <time>{new Date(event.startsAt).toLocaleString()}</time>
                </div>
                <span>{event.status}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="gold-empty-copy compact">
            <CalendarDays />
            <strong>No events scheduled</strong>
            <p>Check back after the administrator publishes the next event.</p>
          </div>
        )}
      </section>
    </main>
  );
}

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { api } from "@/lib/api";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));

export default function EventsPage() {
  const events = useQuery({
    queryKey: ["events"],
    queryFn: api.events,
    retry: false,
  });
  const list = events.data?.data ?? [];

  return (
    <main className="gold-content-page events-page">
      <header className="gold-page-hero events-page-hero">
        <div>
          <CalendarDays />
          <h1>WORLD STAR EVENTS</h1>
          <p>
            Official gatherings, tournament nights, and community events
            published by the administrator.
          </p>
        </div>
      </header>
      <section className="gold-page-section">
        <div className="gold-section-heading">
          <div>
            <span>Event Schedule</span>
            <h2>Upcoming occasions</h2>
          </div>
          <strong>{list.length} published</strong>
        </div>
        {list.length ? (
          <ol className="event-directory">
            {list.map((event) => (
              <li key={event.id}>
                <div className="event-date-block">
                  <span>
                    {new Date(event.startsAt).toLocaleDateString(undefined, {
                      month: "short",
                    })}
                  </span>
                  <strong>{new Date(event.startsAt).getDate()}</strong>
                </div>
                <div>
                  <span
                    className={`event-status event-status--${event.status.toLowerCase()}`}
                  >
                    {event.status.replaceAll("_", " ")}
                  </span>
                  <h2>{event.title}</h2>
                  <p>
                    {event.description ??
                      "Additional details will be published soon."}
                  </p>
                  <div className="event-meta">
                    <span>
                      <Clock /> {formatDate(event.startsAt)}
                    </span>
                    {event.location ? (
                      <span>
                        <MapPin /> {event.location}
                      </span>
                    ) : null}
                  </div>
                </div>
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt="" />
                ) : (
                  <img src="/assets/wst-gold/sealed-dossier.png" alt="" />
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="gold-empty-copy page-empty">
            <CalendarDays />
            <strong>No events scheduled</strong>
            <p>The administrator has not published an upcoming event yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Clock,
  MapPin,
  X,
} from "lucide-react";
import type { PublicEvent } from "@mafia/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cloudinaryMediaKindFromUrl } from "@/lib/cloudinary";

const fallbackEventImage = "/assets/wst-red/sealed-dossier-red.jpg";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));

function EventMedia({
  event,
  detailed = false,
}: {
  event: PublicEvent;
  detailed?: boolean;
}) {
  if (
    event.imageUrl &&
    cloudinaryMediaKindFromUrl(event.imageUrl) === "video"
  ) {
    return (
      <video
        src={event.imageUrl}
        controls={detailed}
        muted={!detailed}
        preload="metadata"
        playsInline
      />
    );
  }

  return (
    <img
      src={event.imageUrl ?? fallbackEventImage}
      alt={detailed ? `${event.title} event artwork` : ""}
      loading={detailed ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

function EventDetailsModal({
  event,
  onClose,
}: {
  event: PublicEvent;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="event-details-backdrop"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <section
        className="event-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`event-title-${event.id}`}
      >
        <div className="event-details-modal__media">
          <EventMedia event={event} detailed />
          <span
            className={`event-status event-status--${event.status.toLowerCase()}`}
          >
            {event.status.replaceAll("_", " ")}
          </span>
        </div>

        <div className="event-details-modal__content">
          <header>
            <div>
              <span className="event-details-modal__eyebrow">
                World Star event
              </span>
              <h2 id={`event-title-${event.id}`}>{event.title}</h2>
            </div>
            <Button
              ref={closeButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close event details"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="event-details-modal__meta">
            <span>
              <Clock aria-hidden="true" />
              <strong>Starts</strong>
              {formatDate(event.startsAt)}
            </span>
            {event.endsAt ? (
              <span>
                <CalendarDays aria-hidden="true" />
                <strong>Ends</strong>
                {formatDate(event.endsAt)}
              </span>
            ) : null}
            {event.location ? (
              <span>
                <MapPin aria-hidden="true" />
                <strong>Location</strong>
                {event.location}
              </span>
            ) : null}
          </div>

          <div className="event-details-modal__copy">
            <section>
              <span>About this event</span>
              <p>
                {event.description ??
                  "Additional event details will be published soon."}
              </p>
            </section>
            <section className="event-details-modal__rules">
              <span>
                <BookOpenText aria-hidden="true" />
                Event rules
              </span>
              <p>
                {event.rules ??
                  "No additional rules have been published for this event."}
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const events = useQuery({
    queryKey: ["events"],
    queryFn: api.events,
    retry: false,
  });
  const list = events.data?.data ?? [];
  const closeDetails = useCallback(() => setSelectedEvent(null), []);

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
                <button
                  type="button"
                  className="event-directory__trigger"
                  onClick={() => setSelectedEvent(event)}
                  aria-label={`Read more about ${event.title}`}
                >
                  <div className="event-date-block">
                    <span>
                      {new Date(event.startsAt).toLocaleDateString(undefined, {
                        month: "short",
                      })}
                    </span>
                    <strong>{new Date(event.startsAt).getDate()}</strong>
                  </div>
                  <div className="event-directory__summary">
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
                    <span className="event-directory__read-more">
                      Read event details <ArrowRight aria-hidden="true" />
                    </span>
                  </div>
                  <div className="event-directory__media">
                    <EventMedia event={event} />
                  </div>
                </button>
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
      {selectedEvent ? (
        <EventDetailsModal event={selectedEvent} onClose={closeDetails} />
      ) : null}
    </main>
  );
}

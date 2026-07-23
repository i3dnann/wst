import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "404 — Page Not Found | World Star";

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main
      className="not-found-page"
      data-disable-scroll-reveal
      aria-labelledby="not-found-title"
    >
      <img
        className="not-found-page__backdrop"
        src="/assets/wst-red/not-found-city-red.jpg"
        alt=""
        aria-hidden="true"
      />
      <div className="not-found-page__veil" aria-hidden="true" />

      <section className="not-found-page__content">
        <p className="not-found-page__eyebrow">404 Error</p>

        <div className="not-found-page__code" aria-hidden="true">
          <span>4</span>
          <span className="not-found-page__zero">0</span>
          <span>4</span>
        </div>

        <h1 id="not-found-title">
          Page <em>not</em> found
        </h1>
        <p className="not-found-page__message">
          The page you’re looking for doesn’t exist or has been moved.
        </p>

        <Button asChild size="lg" className="not-found-page__home">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            Go back home
          </Link>
        </Button>
      </section>
    </main>
  );
}

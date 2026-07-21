import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Scale,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicWebsiteSettings } from "@/lib/website-settings";

export default function InformationPage({
  kind,
}: {
  kind: "rules" | "about" | "dashboard";
}) {
  const website = usePublicWebsiteSettings();
  const pages = website.data?.pages;
  const content =
    kind === "rules"
      ? {
          title: pages?.rulesTitle || "Rules of Engagement",
          text:
            pages?.rulesIntro ||
            "Clear competition starts with one shared standard for rosters, evidence, disputes, and verified results.",
          body:
            pages?.rulesContent ||
            "Every participant is responsible for following the published tournament and server rules. Rosters must be accurate before check-in, match evidence must be complete, and disputes must be submitted inside the allowed review window.\n\nAdministrator decisions are recorded through the protected command center so every result remains traceable and consistent.",
          Icon: Scale,
        }
      : kind === "about"
        ? {
            title: pages?.aboutTitle || "Built for the official record",
            text:
              pages?.aboutIntro ||
              "World Star brings gangs, tournaments, rankings, events, streams, and verified match history into one trusted registry.",
            body:
              pages?.aboutContent ||
              "The public website gives every player a clear view of competition while the protected administrator workspace controls publishing, permissions, brackets, results, and platform settings.\n\nEvery surface is connected to the same live records, creating a reliable home for rivalries, achievements, and tournament history.",
            Icon: Shield,
          }
        : {
            title: "Authentication required",
            text: "Gang management is protected by backend permissions and gang-scoped authorization.",
            body: "Sign in with an authorized account to open the protected management workspace.",
            Icon: LockKeyhole,
          };
  const points =
    kind === "rules"
      ? ["Verified rosters", "Recorded evidence", "Traceable decisions"]
      : [
          "One official registry",
          "Protected administration",
          "Live public records",
        ];
  return (
    <main className="information-page">
      <header className="information-hero">
        <content.Icon />
        <div>
          <h1>{content.title}</h1>
          <p>{content.text}</p>
        </div>
      </header>
      <div className="information-layout">
        <aside className="information-principles">
          <strong>
            {kind === "rules" ? "Competition standard" : "World Star platform"}
          </strong>
          <ol>
            {points.map((point) => (
              <li key={point}>
                <CheckCircle2 /> {point}
              </li>
            ))}
          </ol>
        </aside>
        <article className="information-copy">
          {content.body.split(/\n\s*\n/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {kind === "dashboard" ? (
            <Button asChild>
              <Link to="/admin/login">
                Sign in <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to={kind === "rules" ? "/tournaments" : "/gangs"}>
                {kind === "rules" ? "View tournaments" : "Explore the gangs"}
                <ArrowRight />
              </Link>
            </Button>
          )}
        </article>
      </div>
    </main>
  );
}

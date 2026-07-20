import { LockKeyhole, Scale, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function InformationPage({
  kind,
}: {
  kind: "rules" | "about" | "dashboard";
}) {
  const content =
    kind === "rules"
      ? {
          title: "Rules of Engagement",
          text: "Competition remains fair only when rosters, evidence, disputes, and results follow the published server policy.",
          Icon: Scale,
        }
      : kind === "about"
        ? {
            title: "The official record",
            text: "Mafia is a secure public registry and operations platform for the server’s criminal organizations, players, tournaments, rankings, and matches.",
            Icon: Shield,
          }
        : {
            title: "Authentication required",
            text: "Gang management is protected by backend permissions and gang-scoped authorization.",
            Icon: LockKeyhole,
          };
  return (
    <main className="information-page">
      <content.Icon />
      <h1>{content.title}</h1>
      <p>{content.text}</p>
      {kind === "dashboard" ? (
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      ) : null}
    </main>
  );
}

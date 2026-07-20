import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-mark">M</div>
        <h1>Enter the network.</h1>
        <p>
          Discord is used only to establish your local platform identity.
          Privileged roles are assigned and enforced by the backend.
        </p>
        <Button asChild size="lg">
          <a href={`${apiBase}/api/v1/auth/discord`}>Continue with Discord</a>
        </Button>
        <span>
          <ShieldCheck />
          OAuth tokens never reach this browser.
        </span>
      </section>
    </main>
  );
}

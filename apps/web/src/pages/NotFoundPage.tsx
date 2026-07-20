import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="information-page">
      <span className="error-code">404</span>
      <h1>Record not found.</h1>
      <p>The requested dossier does not exist or is no longer public.</p>
      <Button asChild variant="outline">
        <Link to="/">Return to registry</Link>
      </Button>
    </main>
  );
}

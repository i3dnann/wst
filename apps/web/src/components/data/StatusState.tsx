import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({
  title = "No records yet",
  message = "Verified records will appear here when they are published.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="status-state" role="status">
      <Database aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({
  retry,
  compact = false,
  title = "Live records unavailable",
  message = "The API is unreachable or the database is not configured yet.",
}: {
  retry?: () => void;
  compact?: boolean;
  title?: string;
  message?: string;
}) {
  return (
    <div
      className={
        compact ? "status-state status-state--compact" : "status-state"
      }
      role="alert"
    >
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {retry ? (
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <main className="page-shell page-skeleton" aria-label="Loading page">
      <Skeleton className="h-16 w-2/5" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-48 w-full" />
    </main>
  );
}

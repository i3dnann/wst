import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, LockKeyhole, MousePointer2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/data/StatusState";
import { ApiError, api, type GiftChallengeState } from "@/lib/api";

const TOKEN_KEY = "wst_gift_challenge_token_v1";

function countdownLabel(value: string | null, now: number): string {
  if (!value) return "";
  const remaining = Math.max(0, new Date(value).getTime() - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function GiftPage() {
  const [session, setSession] = useState<GiftChallengeState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const status = useQuery({ queryKey: ["gift-status"], queryFn: api.giftStatus });
  const refetchStatus = status.refetch;
  const start = useMutation({
    mutationFn: (token?: string) => api.giftSession(token),
    onSuccess: ({ data }) => {
      setSession(data);
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    },
  });
  const click = useMutation({
    mutationFn: (token: string) => api.giftClick(token),
    onSuccess: ({ data }) => {
      setSession((current) => ({
        ...data,
        token: current?.token ?? localStorage.getItem(TOKEN_KEY),
        progress: Math.max(current?.progress ?? 0, data.progress ?? 0),
      }));
      if (data.winner && data.code) toast.success("Gift claimed. Your secret code is ready.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "GIFT_SESSION_EXPIRED") {
        localStorage.removeItem(TOKEN_KEY);
        setSession(null);
        void start.mutateAsync(undefined);
      } else toast.error(error.message);
    },
  });
  const state = session ?? status.data?.data;

  useEffect(() => {
    if (!status.data || session || start.isPending) return;
    start.mutate(localStorage.getItem(TOKEN_KEY) ?? undefined);
  }, [session, start, status.data]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const nextAvailableAt = state?.nextAvailableAt;
    if (!state?.claimed || !nextAvailableAt) return;
    const delay = Math.max(0, new Date(nextAvailableAt).getTime() - Date.now()) + 250;
    const timer = window.setTimeout(() => {
      localStorage.removeItem(TOKEN_KEY);
      setSession(null);
      void refetchStatus();
    }, Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [state?.claimed, state?.nextAvailableAt, refetchStatus]);

  const progress = state?.progress ?? 0;
  const required = state?.requiredClicks ?? 100;
  const percent = Math.min(100, Math.round((progress / required) * 100));
  const countdown = useMemo(
    () => countdownLabel(state?.nextAvailableAt ?? null, now),
    [now, state?.nextAvailableAt],
  );

  if (status.isPending) return <PageSkeleton />;
  if (status.isError)
    return <ErrorState title="Gift challenge could not load" message={status.error.message} retry={() => void status.refetch()} />;

  const claimedByOther = Boolean(state?.claimed && !state.winner);
  return (
    <main className="gift-page">
      <div className="gift-page__ambient" aria-hidden="true"><span /><span /><span /></div>
      <section className="gift-challenge" aria-labelledby="gift-title">
        <div className="gift-challenge__intro">
          <div className="gift-challenge__mark"><Gift aria-hidden="true" /></div>
          <p>WORLD STAR DAILY DROP</p>
          <h1 id="gift-title">One gift. One winner.</h1>
          <span>Complete 100 presses before anyone else to unlock today&apos;s secret code.</span>
        </div>

        {claimedByOther ? (
          <div className="gift-claimed" role="status">
            <LockKeyhole aria-hidden="true" />
            <h2>Today&apos;s gift was claimed</h2>
            <p>Another challenger reached the finish first. A new gift opens in:</p>
            <strong>{countdown || "00:00:00"}</strong>
            <small>Come back when the countdown reaches zero.</small>
          </div>
        ) : state?.winner && state.code ? (
          <div className="gift-winner" role="status">
            <Check aria-hidden="true" />
            <h2>You claimed the gift</h2>
            <p>Keep this code safe. It is only displayed to this winning browser.</p>
            <div className="gift-winner__code"><code>{state.code}</code></div>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(state.code ?? "");
                setCopied(true);
                toast.success("Secret code copied.");
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
        ) : (
          <div className="gift-action">
            <button
              type="button"
              className="gift-press"
              disabled={!session?.token || progress >= required}
              onClick={() => session?.token && click.mutate(session.token)}
              style={{ "--gift-progress": `${String(percent)}%` } as CSSProperties}
            >
              <span className="gift-press__rings" aria-hidden="true" />
              <MousePointer2 aria-hidden="true" />
              <strong>Press to claim</strong>
              <small>{progress} / {required}</small>
            </button>
            <div className="gift-progress" aria-label={`${String(progress)} of ${String(required)} presses`}>
              <span style={{ width: `${String(percent)}%` }} />
            </div>
            <p>{required - progress} presses remaining</p>
          </div>
        )}
      </section>
    </main>
  );
}

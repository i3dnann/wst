import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, KeyRound, LockKeyhole, RotateCcw } from "lucide-react";
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
    mutationFn: ({ token, restart = false }: { token?: string; restart?: boolean }) =>
      api.giftSession(token, restart),
    onSuccess: ({ data }) => {
      setSession(data);
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    },
  });
  const [answer, setAnswer] = useState("");
  const answerPuzzle = useMutation({
    mutationFn: ({ token, value }: { token: string; value: string }) => api.giftAnswer(token, value),
    onSuccess: ({ data }) => {
      setSession((current) => ({
        ...data,
        token: current?.token ?? localStorage.getItem(TOKEN_KEY),
      }));
      setAnswer("");
      if (data.winner && data.code) toast.success("Gift claimed. Your secret code is ready.");
      else if (data.correct === false) toast.error(`${String(data.attemptsRemaining ?? 0)} attempts remaining.`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "GIFT_SESSION_EXPIRED") {
        localStorage.removeItem(TOKEN_KEY);
        setSession(null);
        void start.mutateAsync({ restart: true });
      } else toast.error(error.message);
    },
  });
  const state = session ?? status.data?.data;

  useEffect(() => {
    if (!status.data || session || start.isPending) return;
    const storedToken = localStorage.getItem(TOKEN_KEY);
    start.mutate(storedToken ? { token: storedToken } : {});
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

  const countdown = useMemo(
    () => countdownLabel(state?.nextAvailableAt ?? null, now),
    [now, state?.nextAvailableAt],
  );

  if (status.isPending) return <PageSkeleton />;
  if (status.isError)
    return <ErrorState title="Gift challenge could not load" message={status.error.message} retry={() => void status.refetch()} />;

  const claimedByOther = Boolean(state?.claimed && !state.winner);
  if (!claimedByOther && !state?.winner && !session) return <PageSkeleton />;
  const revealSeconds = Math.max(0, Math.ceil((new Date(state?.revealUntil ?? 0).getTime() - now) / 1_000));
  const answerSeconds = Math.max(0, Math.ceil((new Date(state?.answerUntil ?? 0).getTime() - now) / 1_000));
  const puzzlePhase = revealSeconds > 0 ? "memorize" : answerSeconds > 0 && (state?.attemptsRemaining ?? 0) > 0 ? "answer" : "failed";
  return (
    <main className="gift-page">
      <div className="gift-page__ambient" aria-hidden="true"><span /><span /><span /></div>
      <section className="gift-challenge" aria-labelledby="gift-title">
        <div className="gift-challenge__intro">
          <div className="gift-challenge__mark"><Gift aria-hidden="true" /></div>
          <p>WORLD STAR DAILY DROP</p>
          <h1 id="gift-title">One gift. One winner.</h1>
          <span>Memorize the security code and solve the puzzle before anyone else claims today&apos;s gift.</span>
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
            <div className="gift-winner__message">
              <p>{state.claimMessage}</p>
            </div>
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
          <div
            className={`code-puzzle code-puzzle--embedded is-${puzzlePhase}`}
            onCopy={(event) => event.preventDefault()}
            onCut={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && ["c", "x", "a"].includes(event.key.toLowerCase())) event.preventDefault();
            }}
          >
            <div className="code-puzzle__header"><span><KeyRound /> HARD MODE</span><strong>{puzzlePhase === "memorize" ? `${String(revealSeconds)} SEC` : `${String(answerSeconds)} SEC`}</strong></div>
            <div className="code-puzzle__body">
              {puzzlePhase === "memorize" ? <>
                <span className="code-puzzle__countdown">MEMORIZE · {revealSeconds}</span>
                <div className="code-puzzle__code" draggable={false}>{state?.puzzleCode}</div>
                <p>The code disappears when the timer reaches zero.</p>
              </> : puzzlePhase === "answer" ? <form onSubmit={(event) => { event.preventDefault(); if (session?.token) answerPuzzle.mutate({ token: session.token, value: answer }); }}>
                <span className="code-puzzle__countdown">ENTER THE CODE · {answerSeconds}</span>
                <h2>What did you see?</h2>
                <input autoFocus value={answer} maxLength={11} autoComplete="off" spellCheck={false} placeholder="XXXXX-XXXXX" onChange={(event) => setAnswer(event.target.value.toUpperCase())} />
                <p>{state?.attemptsRemaining ?? 3} attempts remaining</p>
                <Button type="submit" disabled={answer.length < 10 || answerPuzzle.isPending}>Unlock gift</Button>
              </form> : <>
                <div className="code-puzzle__failure-icon"><LockKeyhole /></div>
                <span className="code-puzzle__failure-label">SECURITY LOCKOUT</span>
                <h2>Access denied</h2>
                <p>The puzzle expired or all attempts were used. Start a new randomized challenge.</p>
                <Button
                  disabled={start.isPending}
                  onClick={() => {
                    localStorage.removeItem(TOKEN_KEY);
                    setAnswer("");
                    start.mutate({ restart: true });
                  }}
                >
                  <RotateCcw /> {start.isPending ? "Starting…" : "Try again"}
                </Button>
              </>}
            </div>
            <div className="code-puzzle__rail"><span style={{ width: `${String(((puzzlePhase === "memorize" ? revealSeconds : answerSeconds) / 20) * 100)}%` }} /></div>
          </div>
        )}
      </section>
    </main>
  );
}

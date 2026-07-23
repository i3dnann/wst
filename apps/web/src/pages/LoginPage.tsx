import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle, LockKeyhole } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

function getAdminReturnPath(state: unknown): string {
  if (typeof state !== "object" || state === null) return "/admin/overview";
  const from = (state as Record<string, unknown>).from;
  return typeof from === "string" &&
    from.startsWith("/admin/") &&
    from !== "/admin/login"
    ? from
    : "/admin/overview";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const session = useQuery({
    queryKey: ["admin-me"],
    queryFn: api.adminMe,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const returnTo = getAdminReturnPath(location.state as unknown);

  useEffect(() => {
    if (session.isSuccess) {
      void navigate(returnTo, { replace: true });
    }
  }, [navigate, returnTo, session.isSuccess]);

  const login = useMutation({
    mutationFn: () => api.adminLogin(email, password),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["admin-me"] });
      void navigate(returnTo, { replace: true });
    },
  });
  const restoringSession = session.isPending || session.isSuccess;

  return (
    <main className="admin-login-page">
      <div className="admin-login-media" aria-hidden="true">
        <img src="/assets/wst-red/admin-office-red.jpg" alt="" />
      </div>
      <section className="admin-login-panel">
        <Link to="/" className="login-back">
          <ArrowLeft /> Return to public registry
        </Link>
        <img
          className="admin-login-logo"
          src="/assets/wst/wst-logo.png"
          alt="World Star"
        />
        <div>
          <h1>ADMINISTRATOR ACCESS</h1>
          <p>Private credentials are required to edit published records.</p>
        </div>
        {restoringSession ? (
          <div className="admin-session-check" role="status" aria-live="polite">
            <LoaderCircle />
            <span>
              <strong>Restoring secure session</strong>
              <small>Opening the command center…</small>
            </span>
          </div>
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                login.mutate();
              }}
            >
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={12}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {login.isError ? (
                <p className="form-error" role="alert">
                  {login.error instanceof ApiError
                    ? login.error.message
                    : "The administrator service is unavailable."}
                </p>
              ) : null}
              <Button type="submit" size="lg" disabled={login.isPending}>
                <LockKeyhole />
                {login.isPending ? "Authenticating…" : "Enter Command Center"}
              </Button>
            </form>
            <p className="admin-session-note">
              Your secure session stays active for 30 days, or until you log
              out.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

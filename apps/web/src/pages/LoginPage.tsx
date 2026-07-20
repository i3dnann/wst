import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api.adminLogin(email, password),
    onSuccess: () => {
      void navigate("/admin");
    },
  });

  return (
    <main className="admin-login-page">
      <div className="admin-login-media" aria-hidden="true">
        <img src="/assets/wst/wst-square.png" alt="" />
      </div>
      <section className="admin-login-panel">
        <Link to="/" className="login-back">
          <ArrowLeft /> Return to public registry
        </Link>
        <img
          className="admin-login-logo"
          src="/assets/wst/wst-round.png"
          alt="World Star"
        />
        <div>
          <h1>ADMINISTRATOR ACCESS</h1>
          <p>Private credentials are required to edit published records.</p>
        </div>
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
      </section>
    </main>
  );
}

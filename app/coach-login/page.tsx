"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function CoachLoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Logging in...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role;

    if (role === "parent") {
      window.location.href = "/parent-portal";
    } else {
      window.location.href = "/coach-dashboard";
    }
  }

  return (
    <main className="ghp-auth-page">
      <section className="ghp-auth-shell">
        <div className="ghp-auth-copy">
          <p className="ghp-kicker">Coach Login</p>
          <h1>Enter the dashboard.</h1>
          <p>
            Log in to manage the roster, notes, progress, belts, and promotions.
          </p>
        </div>

        <div className="ghp-auth-card">
          <div className="ghp-auth-card-title">Coach Login</div>

          <form className="ghp-auth-grid" onSubmit={handleLogin}>
            <label className="ghp-field ghp-field-wide">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="ghp-field ghp-field-wide">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <div className="ghp-auth-actions ghp-field-wide">
              <button
                type="submit"
                className="ghp-btn ghp-btn-primary"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </div>
          </form>

          <div style={{ marginTop: 12 }}>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>

          {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
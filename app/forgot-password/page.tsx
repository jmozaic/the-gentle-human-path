"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Sending reset email...");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/update-password",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Reset email sent. Check your inbox.");
    setLoading(false);
  }

  return (
    <main className="ghp-auth-page">
      <section className="ghp-auth-shell">
        <div className="ghp-auth-copy">
          <p className="ghp-kicker">Password Reset</p>
          <h1>Reset your password.</h1>
          <p>
            Enter your email and we’ll send you a link to create a new password.
          </p>
        </div>

        <div className="ghp-auth-card">
          <div className="ghp-auth-card-title">Forgot Password</div>

          <form className="ghp-auth-grid" onSubmit={handleReset}>
            <label className="ghp-field ghp-field-wide">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <div className="ghp-auth-actions ghp-field-wide">
              <button
                type="submit"
                className="ghp-btn ghp-btn-primary"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </form>

          {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
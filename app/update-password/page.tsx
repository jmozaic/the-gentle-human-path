"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordPage() {
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Updating password...");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated. You can now log in.");
    setLoading(false);
  }

  return (
    <main className="ghp-auth-page">
      <section className="ghp-auth-shell">
        <div className="ghp-auth-copy">
          <p className="ghp-kicker">New Password</p>
          <h1>Create a new password.</h1>
          <p>
            Choose a new password for your account, then log in again.
          </p>
        </div>

        <div className="ghp-auth-card">
          <div className="ghp-auth-card-title">Update Password</div>

          <form className="ghp-auth-grid" onSubmit={handleUpdate}>
            <label className="ghp-field ghp-field-wide">
              <span>New Password</span>
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
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>

          {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
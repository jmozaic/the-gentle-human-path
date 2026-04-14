"use client";

import { useState } from "react";

export default function InviteCoachClient() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Sending invite...");

    const res = await fetch("/api/invite-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Failed to send invite.");
      setLoading(false);
      return;
    }

    setMessage("Coach invite sent.");
    setEmail("");
    setLoading(false);
  }

  return (
    <main className="ghp-auth-page">
      <section className="ghp-auth-shell">
        <div className="ghp-auth-copy">
          <p className="ghp-kicker">Coach Invite</p>
          <h1>Invite a coach the safe way.</h1>
          <p>
            Send a secure invite link so a coach can create access without a public coach signup page.
          </p>
        </div>

        <div className="ghp-auth-card">
          <div className="ghp-auth-card-title">Invite Coach</div>

          <form className="ghp-auth-grid" onSubmit={handleInvite}>
            <label className="ghp-field ghp-field-wide">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@example.com"
              />
            </label>

            <div className="ghp-auth-actions ghp-field-wide">
              <button
                type="submit"
                className="ghp-btn ghp-btn-primary"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </form>

          {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
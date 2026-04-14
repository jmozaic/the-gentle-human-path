"use client";

import { useState } from "react";

export default function CreateCoachPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateCoach(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Creating coach account...");

    const res = await fetch("/api/create-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.error || "Failed to create coach.");
      setLoading(false);
      return;
    }

    setMessage("Coach account created successfully.");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setLoading(false);
  }

  return (
    <main className="ghp-auth-page">
      <section className="ghp-auth-shell">
        <div className="ghp-auth-copy">
          <p className="ghp-kicker">Create Coach</p>
          <h1>Create a coach login and password.</h1>
          <p>
            Use this page to create a coach account directly with an email and password.
          </p>
        </div>

        <div className="ghp-auth-card">
          <div className="ghp-auth-card-title">New Coach Account</div>

          <form className="ghp-auth-grid" onSubmit={handleCreateCoach}>
            <label className="ghp-field">
              <span>First Name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>

            <label className="ghp-field">
              <span>Last Name</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>

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
                {loading ? "Creating..." : "Create Coach"}
              </button>
            </div>
          </form>

          {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
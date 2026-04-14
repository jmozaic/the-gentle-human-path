"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function CoachDashboardClient() {
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }

    getUser();
  }, []);

  return (
    <main className="ghp-dashboard py-10 pb-16">
      {/* HERO SECTION */}
      <section className="ghp-dash-hero">
        <div>
          <p className="ghp-kicker">Coach Dashboard</p>
          <h1 className="ghp-dash-title">The Gentle Human Path Admin</h1>
          <p className="ghp-dash-lead">
            Manage students, track progress, and grow your academy.
          </p>

          {/* ✅ INVITE COACH BUTTON */}
          <div style={{ marginTop: "16px" }}>
            <button
              onClick={() => (window.location.href = "/invite-coach")}
              className="ghp-btn ghp-btn-primary"
            >
              Invite Coach
            </button>
          </div>
        </div>

        {/* BRAND CHIP */}
        <div className="ghp-brand-chip">
          <div className="ghp-brand-chip-mark">GH</div>
          <div>
            <div className="ghp-brand-chip-title">Gentle Human</div>
            <div className="ghp-brand-chip-sub">Coach System</div>
          </div>
        </div>
      </section>

      {/* SIMPLE CONTENT PLACEHOLDER */}
      <section className="ghp-dash-card">
        <h2>Dashboard Active</h2>
        <p>You are logged in as a coach.</p>

        {user && (
          <p style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
            Logged in as: {user.email}
          </p>
        )}
      </section>
    </main>
  );
}
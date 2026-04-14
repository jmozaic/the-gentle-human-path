import Link from "next/link";

export default function Home() {
  return (
    <main className="ghp-home">
      <section className="ghp-hero">
        <div className="ghp-hero-copy">
          <p className="ghp-kicker">THE GENTLE HUMAN PATH</p>
          <h1>
            A refined system for
            <br />
            coaching, character,
            <br />
            and growth.
          </h1>
          <p className="ghp-lead">
            The Gentle Human Path brings together student progress, parent
            connection, coach notes, and daily class tracking into one modern
            academy system.
          </p>

          <div className="ghp-actions">
            <Link href="/parent-signup" className="ghp-btn ghp-btn-gold">
              Parent Signup
            </Link>

            <Link href="/parent-login" className="ghp-btn ghp-btn-secondary">
              Parent Login
            </Link>

            <Link href="/coach-login" className="ghp-btn ghp-btn-secondary">
              Enter Dashboard
            </Link>
          </div>
        </div>

        <div className="ghp-hero-panel">
          <div className="ghp-panel-card">
            <p className="ghp-panel-label">Academy</p>
            <h3>Track the path.</h3>
            <p>
              Daily roster sheets, profiles, promotions, and notes designed for
              real class use.
            </p>
          </div>

          <div className="ghp-panel-card">
            <p className="ghp-panel-label">Parents</p>
            <h3>Stay connected.</h3>
            <p>
              Give families a clearer view of progress, behavior, technique, and
              long-term development.
            </p>
          </div>
        </div>
      </section>

      <section className="ghp-feature-strip">
        <div className="ghp-feature">
          <span className="ghp-feature-label">Coach Dashboard</span>
          <p>Roster-based attendance, behavior, technique, and profile tools.</p>
        </div>

        <div className="ghp-feature">
          <span className="ghp-feature-label">Parent Portal</span>
          <p>Simple access to student progress, updates, and communication.</p>
        </div>

        <div className="ghp-feature">
          <span className="ghp-feature-label">Student Path</span>
          <p>Belts, stripes, notes, and progress presented with clarity.</p>
        </div>
      </section>

      <section className="ghp-editorial">
        <div className="ghp-editorial-block">
          <p className="ghp-kicker">COACHING SYSTEM</p>
          <h2>Built for the daily rhythm of an academy.</h2>
        </div>

        <div className="ghp-editorial-grid">
          <div className="ghp-editorial-card">
            <h3>Roster-first workflow</h3>
            <p>
              Mark attendance, behavior, and technique directly from the daily
              sheet without clutter.
            </p>
          </div>

          <div className="ghp-editorial-card">
            <h3>Student profiles</h3>
            <p>
              Edit belts, stripes, notes, and progress in one place without
              crowding the class view.
            </p>
          </div>

          <div className="ghp-editorial-card">
            <h3>Parent-ready structure</h3>
            <p>
              Create a cleaner bridge between the academy and the family without
              losing your coaching workflow.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
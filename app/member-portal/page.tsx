import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Student = {
  id: string;
  name: string;
  belt: string;
  stripes: number;
  parent_email: string | null;
  roster?: string | null;
  birthday?: string | null;
  belt_size?: string | null;
  belt_awarded_at?: string | null;
  training_started_at?: string | null;
  last_stripe_awarded_at?: string | null;
  black_belt_degree?: number | null;
  adult_skill_ratings?: Record<string, number> | null;
};

type Session = {
  id: string;
  student_id: string;
  date: string;
  attendance: boolean;
  behavior: boolean;
  technique: boolean;
};

const TIER_PERCENTAGES: Record<2 | 3 | 4, number> = {
  2: 1.0,
  3: 0.9,
  4: 0.8,
};

const MIN_ATTENDANCE = 8;

const ADULT_SKILL_CATEGORIES = [
  "Judo Throws",
  "Wrestling",
  "Wrestling Defense",
  "Pulling Guard",
  "Closed Guard",
  "Open Guard",
  "Half Guard",
  "Seated Guard",
  "Passing Standing",
  "Passing Tripod",
  "Passing Kneeling",
  "Passing Half Guard",
  "Side Control Top",
  "Side Control Bottom",
  "Turtle Top",
  "Turtle Bottom",
  "North South Top",
  "North South Bottom",
  "Knee on Belly Top",
  "Knee on Belly Bottom",
  "Mount Top",
  "Mount Bottom",
  "Back Mount",
  "Back Escape",
  "Submissions",
  "Headlock Escapes",
  "Competition Readiness",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateString: string) {
  return dateString.slice(0, 7);
}

function isAdultStudent(student: Student) {
  return (student.roster || "") === "Adults";
}

function isBlackBelt(student: Student) {
  return student.belt === "Black";
}

function tierFromAttendance(
  attendanceCount: number,
  totalAvailableClasses: number
): 2 | 3 | 4 {
  const twoXCap = Math.round(totalAvailableClasses * 0.5);
  const threeXCap = Math.round(totalAvailableClasses * 0.75);

  if (attendanceCount <= twoXCap) return 2;
  if (attendanceCount <= threeXCap) return 3;
  return 4;
}

function getCurrentStreak(sessions: Session[]) {
  const attendedDates = sessions
    .filter((s) => s.attendance)
    .map((s) => s.date)
    .sort((a, b) => b.localeCompare(a));

  if (attendedDates.length === 0) return 0;

  let streak = 1;

  for (let i = 1; i < attendedDates.length; i++) {
    const prev = new Date(attendedDates[i - 1]);
    const curr = new Date(attendedDates[i]);

    const diffMs = prev.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) streak += 1;
    else break;
  }

  return streak;
}

function getYearsSince(date?: string | null) {
  if (!date) return 0;

  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--;

  return years;
}

function getSkillAverage(ratings?: Record<string, number> | null) {
  if (!ratings) return 0;

  const total = ADULT_SKILL_CATEGORIES.reduce((sum, category) => {
    return sum + Number(ratings[category] || 0);
  }, 0);

  return total / ADULT_SKILL_CATEGORIES.length;
}

function getFastTrackAverage(studentId: string, sessions: Session[], currentDate: string) {
  const anchor = new Date(currentDate);
  const cutoff = new Date(anchor);
  cutoff.setDate(anchor.getDate() - 90);

  const count = sessions.filter((session) => {
    if (session.student_id !== studentId || !session.attendance) return false;

    const date = new Date(session.date);
    return date >= cutoff && date <= anchor;
  }).length;

  return count / 13;
}

export default async function MemberPortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/member-login");

  const email = user.email;
  const currentDate = today();
  const currentMonth = monthKey(currentDate);

  const { data: monthlySettings } = await supabase
    .from("monthly_settings")
    .select("*")
    .eq("month", currentMonth)
    .maybeSingle();

  const availableClasses = monthlySettings?.available_classes ?? 16;

  const { data: studentsData, error: studentsError } = await supabase
    .from("students")
    .select("*")
    .eq("parent_email", email);

  if (studentsError) {
    return (
      <main className="ghp-parent-page">
        <section className="ghp-dash-card">
          <h2>Error loading students</h2>
          <p>{studentsError.message}</p>
        </section>
      </main>
    );
  }

  const students = (studentsData || []) as Student[];

  if (students.length === 0) {
    return (
      <main className="ghp-parent-page">
        <section className="ghp-parent-hero">
          <div>
            <p className="ghp-kicker">Member Portal</p>
            <h1>Your Progress</h1>
            <p>No student profiles are linked to this email yet.</p>
          </div>
        </section>
      </main>
    );
  }

  const studentIds = students.map((s) => s.id);

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
    .in("student_id", studentIds);

  if (sessionsError) {
    return (
      <main className="ghp-parent-page">
        <section className="ghp-dash-card">
          <h2>Error loading sessions</h2>
          <p>{sessionsError.message}</p>
        </section>
      </main>
    );
  }

  const { data: notesData } = await supabase
    .from("notes")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });

  const sessions = (sessionsData || []) as Session[];

  const studentSummaries = students.map((student) => {
    const adult = isAdultStudent(student);
    const blackBelt = isBlackBelt(student);

    const allStudentSessions = sessions.filter((s) => s.student_id === student.id);
    const monthSessions = allStudentSessions.filter(
      (s) => monthKey(s.date) === currentMonth
    );

    const attendance = monthSessions.filter((s) => s.attendance).length;
    const behavior = adult ? 0 : monthSessions.filter((s) => s.behavior).length;
    const technique = adult ? 0 : monthSessions.filter((s) => s.technique).length;
    const total = adult ? attendance : attendance + behavior + technique;

    const tier = tierFromAttendance(attendance, availableClasses);
    const goal = adult
      ? MIN_ATTENDANCE
      : Math.ceil(attendance * 3 * TIER_PERCENTAGES[tier]);

    const behaviorGoal = adult ? 0 : Math.ceil(attendance * 0.8);
    const techniqueGoal = adult ? 0 : Math.ceil(attendance * 0.8);

    const eligible = adult
      ? attendance >= MIN_ATTENDANCE
      : attendance >= MIN_ATTENDANCE &&
        total >= goal &&
        behavior >= behaviorGoal &&
        technique >= techniqueGoal;

    const latestNote = (notesData || []).find((n: any) => n.student_id === student.id);
    const streak = getCurrentStreak(allStudentSessions);

    const attendanceProgress =
      availableClasses > 0 ? Math.min((attendance / availableClasses) * 100, 100) : 0;

    const totalProgress = goal > 0 ? Math.min((total / goal) * 100, 100) : 0;

    const behaviorProgress =
      behaviorGoal > 0 ? Math.min((behavior / behaviorGoal) * 100, 100) : 0;

    const techniqueProgress =
      techniqueGoal > 0 ? Math.min((technique / techniqueGoal) * 100, 100) : 0;

    const trainingYears = getYearsSince(student.training_started_at);
    const yearsAtBelt = getYearsSince(student.belt_awarded_at);
    const yearsSinceLastStripe = getYearsSince(student.last_stripe_awarded_at);
    const skillAverage = adult && !blackBelt ? getSkillAverage(student.adult_skill_ratings) : 0;
    const fastTrackAverage = adult
      ? getFastTrackAverage(student.id, sessions, currentDate)
      : 0;

    return {
      ...student,
      adult,
      blackBelt,
      attendance,
      behavior,
      technique,
      total,
      goal,
      eligible,
      streak,
      note: latestNote?.content || "No coach note yet.",
      attendanceProgress,
      totalProgress,
      behaviorProgress,
      techniqueProgress,
      trainingYears,
      yearsAtBelt,
      yearsSinceLastStripe,
      skillAverage,
      fastTrackAverage,
    };
  });

  return (
    <main className="ghp-parent-page">
      <section className="ghp-parent-hero">
        <div>
          <p className="ghp-kicker">Member Portal</p>
          <h1>Your Progress</h1>
          <p>
            View linked student profiles, attendance, coach notes, and current
            progress.
          </p>
        </div>

        <div className="ghp-brand-chip">
          <div className="ghp-brand-chip-mark">GH</div>
          <div>
            <div className="ghp-brand-chip-title">The Gentle Human Path</div>
            <div className="ghp-brand-chip-sub">Member view</div>
          </div>
        </div>
      </section>

      <section className="ghp-parent-student-stack">
        {studentSummaries.map((student) => (
          <div key={student.id} className="ghp-dash-card">
            <div className="ghp-dash-card-header">
              <h2>{student.name}</h2>
              <p>
                {student.belt}{" "}
                {student.blackBelt
                  ? `• ${student.black_belt_degree || 0} degree`
                  : `• ${student.stripes} stripes`}
                {student.roster ? ` • ${student.roster}` : ""}
              </p>
            </div>

            <div className="ghp-stat-grid">
              <div className="ghp-stat">
                <span>Attendance Count</span>
                <strong>{student.attendance}</strong>
              </div>

              {student.adult ? (
                <>
                  <div className="ghp-stat">
                    <span>Training Time</span>
                    <strong>{student.trainingYears} yrs</strong>
                  </div>

                  <div className="ghp-stat">
                    <span>Time at Belt</span>
                    <strong>{student.yearsAtBelt} yrs</strong>
                  </div>

                  {!student.blackBelt ? (
                    <div className="ghp-stat">
                      <span>Since Last Stripe</span>
                      <strong>{student.yearsSinceLastStripe} yrs</strong>
                    </div>
                  ) : null}

                  {!student.blackBelt ? (
                    <div className="ghp-stat">
                      <span>Total Skill Level</span>
                      <strong>{student.skillAverage.toFixed(1)}/10</strong>
                    </div>
                  ) : null}

                  <div className="ghp-stat">
                    <span>90 Day Average</span>
                    <strong>{student.fastTrackAverage.toFixed(1)} / wk</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="ghp-stat">
                    <span>A / B / T</span>
                    <strong>
                      {student.attendance} / {student.behavior} / {student.technique}
                    </strong>
                  </div>

                  <div className="ghp-stat">
                    <span>Monthly Progress</span>
                    <strong>
                      {student.total} / {student.goal || 0}
                    </strong>
                  </div>

                  <div className="ghp-stat">
                    <span>Eligibility</span>
                    <strong className={student.eligible ? "ghp-green" : "ghp-gold"}>
                      {student.eligible ? "Eligible" : "Not Yet"}
                    </strong>
                  </div>
                </>
              )}

              <div className="ghp-stat">
                <span>Current Streak</span>
                <strong>{student.streak}</strong>
              </div>

              <div className="ghp-stat">
                <span>Classes This Month</span>
                <strong>{availableClasses}</strong>
              </div>
            </div>

            <div className="ghp-parent-progress-block">
              <div className="ghp-parent-progress-row">
                <div className="ghp-parent-progress-label">
                  <span>Attendance Progress</span>
                  <strong>{Math.round(student.attendanceProgress)}%</strong>
                </div>
                <div className="ghp-progress">
                  <div
                    className="ghp-progress-fill"
                    style={{ width: `${student.attendanceProgress}%` }}
                  />
                </div>
              </div>

              {!student.adult ? (
                <>
                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Monthly Goal Progress</span>
                      <strong>{Math.round(student.totalProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${student.totalProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Behavior Progress</span>
                      <strong>{Math.round(student.behaviorProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${student.behaviorProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Technique Progress</span>
                      <strong>{Math.round(student.techniqueProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${student.techniqueProgress}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {student.adult && !student.blackBelt ? (
              <div className="ghp-adult-skills" style={{ marginTop: 20 }}>
                <div className="ghp-dash-card-header">
                  <h2>Skill Evaluation</h2>
                  <p>Read-only coach evaluation.</p>
                </div>

                {ADULT_SKILL_CATEGORIES.map((category) => {
                  const value = Number(student.adult_skill_ratings?.[category] || 0);

                  return (
                    <div key={category} className="ghp-skill-row">
                      <div className="ghp-skill-top">
                        <span>{category}</span>
                        <strong>{value}/10</strong>
                      </div>

                      <div className="ghp-progress">
                        <div
                          className="ghp-progress-fill"
                          style={{ width: `${value * 10}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="ghp-parent-note" style={{ marginTop: 20 }}>
              <p>{student.note}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
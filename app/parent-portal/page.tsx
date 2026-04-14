import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Student = {
  id: string;
  name: string;
  belt: string;
  stripes: number;
  parent_email: string | null;
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
  2: 0.9,
  3: 0.8,
  4: 0.7,
};

const MIN_ATTENDANCE = 6;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateString: string) {
  return dateString.slice(0, 7);
}

function tierFromAttendance(attendanceCount: number, totalAvailableClasses: number): 2 | 3 | 4 {
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

    if (diffDays <= 7) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export default async function ParentPortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent-login");
  }

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
            <p className="ghp-kicker">Parent Portal</p>
            <h1>Your Child’s Progress</h1>
            <p>No students are linked to this parent email yet.</p>
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
    const allStudentSessions = sessions.filter((s) => s.student_id === student.id);
    const monthSessions = allStudentSessions.filter(
      (s) => monthKey(s.date) === currentMonth
    );

    const attendance = monthSessions.filter((s) => s.attendance).length;
    const behavior = monthSessions.filter((s) => s.behavior).length;
    const technique = monthSessions.filter((s) => s.technique).length;
    const total = attendance + behavior + technique;

    const tier = tierFromAttendance(attendance, availableClasses);
    const goal = Math.ceil(attendance * 3 * TIER_PERCENTAGES[tier]);
    const behaviorGoal = Math.ceil(attendance * 0.75);
    const techniqueGoal = Math.ceil(attendance * 0.75);

    const eligible =
      attendance >= MIN_ATTENDANCE &&
      total >= goal &&
      behavior >= behaviorGoal &&
      technique >= techniqueGoal;

    const latestNote = (notesData || []).find((n: any) => n.student_id === student.id);
    const streak = getCurrentStreak(allStudentSessions);

    const attendanceProgress =
      availableClasses > 0 ? Math.min((attendance / availableClasses) * 100, 100) : 0;

    const totalProgress =
      goal > 0 ? Math.min((total / goal) * 100, 100) : 0;

    const baselineSkillGoal = Math.ceil(MIN_ATTENDANCE * 0.75);

    const behaviorProgress =
      Math.min((behavior / baselineSkillGoal) * 100, 100);

    const techniqueProgress =
      Math.min((technique / baselineSkillGoal) * 100, 100);

    return {
      ...student,
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
    };
  });

  return (
    <main className="ghp-parent-page">
      <section className="ghp-parent-hero">
        <div>
          <p className="ghp-kicker">Parent Portal</p>
          <h1>Your Child’s Progress</h1>
          <p>
            Track attendance, behavior, technique, monthly progress, and current
            eligibility in one place.
          </p>
        </div>

        <div className="ghp-brand-chip">
          <div className="ghp-brand-chip-mark">GH</div>
          <div>
            <div className="ghp-brand-chip-title">The Gentle Human Path</div>
            <div className="ghp-brand-chip-sub">Parent view</div>
          </div>
        </div>
      </section>

      <section className="ghp-parent-student-stack">
        {studentSummaries.map((student) => (
          <div key={student.id} className="ghp-dash-card">
            <div className="ghp-dash-card-header">
              <h2>{student.name}</h2>
              <p>
                {student.belt} • {student.stripes} stripes
              </p>
            </div>

            <div className="ghp-stat-grid">
              <div className="ghp-stat">
                <span>Attendance Count</span>
                <strong>{student.attendance}</strong>
              </div>
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
            </div>

            <div className="ghp-parent-note">
              <p>{student.note}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Belt =
  | "White"
  | "Gray/White"
  | "Gray"
  | "Gray/Black"
  | "Yellow/White"
  | "Yellow"
  | "Yellow/Black"
  | "Orange/White"
  | "Orange"
  | "Orange/Black"
  | "Green/White"
  | "Green"
  | "Green/Black";

type Student = {
  id: string;
  name: string;
  belt: Belt;
  stripes: number;
  notes: string;
};

type Session = {
  id?: string;
  student_id: string;
  date: string;
  attendance: boolean;
  behavior: boolean;
  technique: boolean;
};

const BELTS: Belt[] = [
  "White",
  "Gray/White",
  "Gray",
  "Gray/Black",
  "Yellow/White",
  "Yellow",
  "Yellow/Black",
  "Orange/White",
  "Orange",
  "Orange/Black",
  "Green/White",
  "Green",
  "Green/Black",
];

const TIER_PERCENTAGES: Record<2 | 3 | 4, number> = {
  2: 0.9,
  3: 0.8,
  4: 0.7,
};

const MIN_ATTENDANCE = 6;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateString: string): string {
  return dateString.slice(0, 7);
}

function getStripeMax(belt: Belt): number {
  return belt === "White" ? 12 : 8;
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

    if (diffDays <= 7) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export default function CoachDashboardClient() {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [availableClasses, setAvailableClasses] = useState<number>(16);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentBelt, setNewStudentBelt] = useState<Belt>("White");
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDashboardData() {
    setLoading(true);
    setMessage("");

    const currentMonth = monthKey(selectedDate);

    const [
      studentsResponse,
      sessionsResponse,
      notesResponse,
      monthlySettingsResponse,
    ] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: true }),
      supabase.from("sessions").select("*"),
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("monthly_settings")
        .select("*")
        .eq("month", currentMonth)
        .maybeSingle(),
    ]);

    if (studentsResponse.error) {
      setMessage(studentsResponse.error.message);
      setLoading(false);
      return;
    }

    if (sessionsResponse.error) {
      setMessage(sessionsResponse.error.message);
      setLoading(false);
      return;
    }

    if (notesResponse.error) {
      setMessage(notesResponse.error.message);
      setLoading(false);
      return;
    }

    const studentsData = studentsResponse.data || [];
    const sessionsData = sessionsResponse.data || [];
    const notesData = notesResponse.data || [];
    const monthlySettingsData = monthlySettingsResponse.data;

    const studentList: Student[] = studentsData.map((student: any) => {
      const latestNote = notesData.find((note: any) => note.student_id === student.id);

      return {
        id: student.id,
        name: student.name || "",
        belt: (student.belt || "White") as Belt,
        stripes: student.stripes || 0,
        notes: latestNote?.content || "",
      };
    });

    setStudents(studentList);
    setSessions(sessionsData as Session[]);
    setAvailableClasses(monthlySettingsData?.available_classes ?? 16);

    if (studentList.length > 0 && !selectedStudentId) {
      setSelectedStudentId(studentList[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadMonthlySettings() {
      const month = monthKey(selectedDate);

      const { data, error } = await supabase
        .from("monthly_settings")
        .select("*")
        .eq("month", month)
        .maybeSingle();

      if (!error) {
        setAvailableClasses(data?.available_classes ?? 16);
      }
    }

    loadMonthlySettings();
  }, [selectedDate, supabase]);

  useEffect(() => {
    if (students.length > 0 && selectedStudentId == null) {
      setSelectedStudentId(students[0].id);
    }
    if (
      selectedStudentId != null &&
      !students.find((s) => s.id === selectedStudentId)
    ) {
      setSelectedStudentId(students[0]?.id ?? null);
    }
  }, [students, selectedStudentId]);

  async function saveMonthlySettings(month: string, classes: number) {
    const { error } = await supabase
      .from("monthly_settings")
      .upsert(
        {
          month,
          available_classes: classes,
        },
        { onConflict: "month" }
      );

    if (error) {
      setMessage(error.message);
    }
  }

  async function addStudent() {
    const trimmed = newStudentName.trim();
    if (!trimmed) return;

    setMessage("Adding student...");

    const parentEmail = prompt("Enter parent email for this student") || "";

    const { data, error } = await supabase
      .from("students")
      .insert({
        name: trimmed,
        belt: newStudentBelt,
        stripes: 0,
        parent_email: parentEmail,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    const newStudent: Student = {
      id: data.id,
      name: data.name,
      belt: data.belt as Belt,
      stripes: data.stripes,
      notes: "",
    };

    setStudents((prev) => [...prev, newStudent]);
    setSelectedStudentId(newStudent.id);
    setNewStudentName("");
    setNewStudentBelt("White");
    setMessage("Student added.");
  }

  async function deleteStudent(studentId: string) {
    if (!window.confirm("Delete this student?")) return;

    setMessage("Deleting student...");

    await supabase.from("notes").delete().eq("student_id", studentId);
    await supabase.from("sessions").delete().eq("student_id", studentId);

    const { error } = await supabase.from("students").delete().eq("id", studentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setSessions((prev) => prev.filter((s) => s.student_id !== studentId));
    setMessage("Student deleted.");
  }

  async function updateStudent(studentId: string, updates: Partial<Student>) {
    const dbUpdates: Record<string, any> = {};

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.belt !== undefined) dbUpdates.belt = updates.belt;
    if (updates.stripes !== undefined) dbUpdates.stripes = updates.stripes;

    const { error } = await supabase
      .from("students")
      .update(dbUpdates)
      .eq("id", studentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, ...updates } : student
      )
    );
  }

  function getSession(studentId: string, date: string): Session {
    return (
      sessions.find((s) => s.student_id === studentId && s.date === date) || {
        student_id: studentId,
        date,
        attendance: false,
        behavior: false,
        technique: false,
      }
    );
  }

  async function toggleSticker(
    studentId: string,
    field: "attendance" | "behavior" | "technique"
  ) {
    const existing = sessions.find(
      (s) => s.student_id === studentId && s.date === selectedDate
    );

    if (existing?.id) {
      const updatedValue = !existing[field];

      const { error } = await supabase
        .from("sessions")
        .update({ [field]: updatedValue })
        .eq("id", existing.id);

      if (error) {
        setMessage(error.message);
        return;
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === existing.id ? { ...s, [field]: updatedValue } : s
        )
      );
      return;
    }

    const newSession = {
      student_id: studentId,
      date: selectedDate,
      attendance: field === "attendance",
      behavior: field === "behavior",
      technique: field === "technique",
    };

    const { data, error } = await supabase
      .from("sessions")
      .insert(newSession)
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setSessions((prev) => [...prev, data as Session]);
  }

  async function saveNote(studentId: string, content: string) {
    setSavingNote(true);
    setMessage("Saving note...");

    const { error } = await supabase.from("notes").insert({
      student_id: studentId,
      content,
    });

    if (error) {
      setMessage(error.message);
      setSavingNote(false);
      return;
    }

    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, notes: content } : student
      )
    );

    setMessage("Note saved.");
    setSavingNote(false);
  }

  function getCareerStickerTotal(studentId: string): number {
    const studentSessions = sessions.filter((s) => s.student_id === studentId);
    let total = 0;

    for (const session of studentSessions) {
      if (session.attendance) total += 1;
      if (session.behavior) total += 1;
      if (session.technique) total += 1;
    }

    return total;
  }

  const summaries = useMemo(() => {
    return students.map((student) => {
      const allStudentSessions = sessions.filter((s) => s.student_id === student.id);

      const monthSessions = allStudentSessions.filter(
        (s) =>
          monthKey(s.date) === monthKey(selectedDate)
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
        careerStickers: getCareerStickerTotal(student.id),
        attendanceProgress,
        totalProgress,
        behaviorProgress,
        techniqueProgress,
      };
    });
  }, [students, sessions, selectedDate, availableClasses]);

  const selectedStudent =
    summaries.find((s) => s.id === selectedStudentId) || null;

  async function awardStripe(studentId: string) {
    const student = summaries.find((s) => s.id === studentId);
    if (!student) return;

    if (!student.eligible) {
      alert("This student is not eligible for a stripe yet.");
      return;
    }

    await updateStudent(studentId, {
      stripes: Math.min(student.stripes + 1, getStripeMax(student.belt)),
    });
  }

  async function promoteBelt(studentId: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const currentIndex = BELTS.indexOf(student.belt);
    const nextBelt = BELTS[currentIndex + 1];

    if (!nextBelt) {
      alert("This student is already at the top belt.");
      return;
    }

    await updateStudent(studentId, {
      belt: nextBelt,
      stripes: 0,
    });
  }

  if (loading) {
    return (
      <main className="ghp-dashboard py-10 pb-16">
        <div className="ghp-dash-card">
          <h2>Loading dashboard...</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="ghp-dashboard py-10 pb-16">
      <section className="ghp-dash-hero">
        <div>
          <p className="ghp-kicker">Coach Dashboard</p>
          <h1 className="ghp-dash-title">The Gentle Human Path Admin</h1>
          <p className="ghp-dash-lead">
            A roster-first class workflow with student profiles, notes, promotions, and progress.
          </p>

          <div style={{ marginTop: "12px" }}>
            <button
              onClick={() => window.location.href = "/invite-coach"}
              className="ghp-btn ghp-btn-primary"
            >
              Invite Coach
            </button>
          </div>
        </div>

        <div className="ghp-brand-chip">
          <div className="ghp-brand-chip-mark">GH</div>
          <div>
            <div className="ghp-brand-chip-title">Gentle Human</div>
            <div className="ghp-brand-chip-sub">Premium academy tools</div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="mb-4 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <section className="ghp-dash-toolbar">
        <label className="ghp-field">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>

        <label className="ghp-field">
          <span>Classes This Month</span>
          <input
            type="number"
            value={availableClasses}
            onChange={async (e) => {
              const value = Number(e.target.value);
              setAvailableClasses(value);
              await saveMonthlySettings(monthKey(selectedDate), value);
            }}
          />
        </label>

        <label className="ghp-field ghp-field-wide">
          <span>Student Name</span>
          <input
            type="text"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            placeholder="Add a student"
          />
        </label>

        <label className="ghp-field">
          <span>Starting Belt</span>
          <select
            value={newStudentBelt}
            onChange={(e) => setNewStudentBelt(e.target.value as Belt)}
          >
            {BELTS.map((belt) => (
              <option key={belt} value={belt}>
                {belt}
              </option>
            ))}
          </select>
        </label>

        <button onClick={addStudent} className="ghp-btn ghp-btn-primary">
          Add Student
        </button>
      </section>

      <section className="ghp-dash-grid">
        <div className="ghp-dash-card">
          <div className="ghp-dash-card-header">
            <h2>Roster Sheet</h2>
            <p>Mark attendance, behavior, and technique for the selected class date.</p>
          </div>

          <div className="ghp-sheet">
            <div className="ghp-sheet-header">
              <div>Name</div>
              <div>A</div>
              <div>B</div>
              <div>T</div>
              <div>View</div>
            </div>

            {summaries.map((student) => {
              const session = getSession(student.id, selectedDate);

              return (
                <div className="ghp-sheet-row" key={student.id}>
                  <div className="ghp-sheet-name">
                    <div className="ghp-sheet-student">{student.name}</div>
                    <div className="ghp-sheet-meta">
                      {student.belt} • {student.stripes}/{getStripeMax(student.belt)}
                    </div>
                  </div>

                  <div className="ghp-sheet-center">
                    <button
                      onClick={() => toggleSticker(student.id, "attendance")}
                      className={`ghp-bubble ${session.attendance ? "active-a" : ""}`}
                    >
                      A
                    </button>
                  </div>

                  <div className="ghp-sheet-center">
                    <button
                      onClick={() => toggleSticker(student.id, "behavior")}
                      className={`ghp-bubble ${session.behavior ? "active-b" : ""}`}
                    >
                      B
                    </button>
                  </div>

                  <div className="ghp-sheet-center">
                    <button
                      onClick={() => toggleSticker(student.id, "technique")}
                      className={`ghp-bubble ${session.technique ? "active-t" : ""}`}
                    >
                      T
                    </button>
                  </div>

                  <div className="ghp-sheet-center">
                    <button
                      onClick={() => setSelectedStudentId(student.id)}
                      className="ghp-btn ghp-btn-ghost ghp-btn-small"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ghp-dash-card">
          {!selectedStudent ? (
            <div className="ghp-empty">Select a student.</div>
          ) : (
            <>
              <div className="ghp-dash-card-header">
                <h2>Student Profile</h2>
                <p>Edit core details, notes, promotion status, and see live progress.</p>
              </div>

              <div className="ghp-profile-shell">
                <label className="ghp-field">
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={selectedStudent.name}
                    onChange={(e) =>
                      updateStudent(selectedStudent.id, { name: e.target.value })
                    }
                  />
                </label>

                <div className="ghp-profile-grid">
                  <label className="ghp-field">
                    <span>Belt</span>
                    <select
                      value={selectedStudent.belt}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          belt: e.target.value as Belt,
                        })
                      }
                    >
                      {BELTS.map((belt) => (
                        <option key={belt} value={belt}>
                          {belt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ghp-field">
                    <span>Stripes</span>
                    <input
                      type="number"
                      min="0"
                      max={getStripeMax(selectedStudent.belt)}
                      value={selectedStudent.stripes}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          stripes: Math.min(
                            Number(e.target.value),
                            getStripeMax(selectedStudent.belt)
                          ),
                        })
                      }
                    />
                  </label>
                </div>

                <div className="ghp-stat-grid">
                  <div className="ghp-stat">
                    <span>Attendance Count</span>
                    <strong>{selectedStudent.attendance}</strong>
                  </div>
                  <div className="ghp-stat">
                    <span>A / B / T</span>
                    <strong>
                      {selectedStudent.attendance} / {selectedStudent.behavior} / {selectedStudent.technique}
                    </strong>
                  </div>
                  <div className="ghp-stat">
                    <span>Monthly Progress</span>
                    <strong>
                      {selectedStudent.total} / {selectedStudent.goal || 0}
                    </strong>
                  </div>
                  <div className="ghp-stat">
                    <span>Eligibility</span>
                    <strong className={selectedStudent.eligible ? "ghp-green" : "ghp-gold"}>
                      {selectedStudent.eligible ? "Eligible" : "Not Yet"}
                    </strong>
                  </div>
                  <div className="ghp-stat">
                    <span>Current Streak</span>
                    <strong>{selectedStudent.streak}</strong>
                  </div>
                  <div className="ghp-stat">
                    <span>Career Stickers</span>
                    <strong>{selectedStudent.careerStickers}</strong>
                  </div>
                </div>

                <div className="ghp-parent-progress-block">
                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Attendance Progress</span>
                      <strong>{Math.round(selectedStudent.attendanceProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${selectedStudent.attendanceProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Monthly Goal Progress</span>
                      <strong>{Math.round(selectedStudent.totalProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${selectedStudent.totalProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Behavior Progress</span>
                      <strong>{Math.round(selectedStudent.behaviorProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${selectedStudent.behaviorProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="ghp-parent-progress-row">
                    <div className="ghp-parent-progress-label">
                      <span>Technique Progress</span>
                      <strong>{Math.round(selectedStudent.techniqueProgress)}%</strong>
                    </div>
                    <div className="ghp-progress">
                      <div
                        className="ghp-progress-fill"
                        style={{ width: `${selectedStudent.techniqueProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <label className="ghp-field">
                  <span>Coach Notes</span>
                  <textarea
                    value={selectedStudent.notes}
                    onChange={(e) =>
                      setStudents((prev) =>
                        prev.map((student) =>
                          student.id === selectedStudent.id
                            ? { ...student, notes: e.target.value }
                            : student
                        )
                      )
                    }
                  />
                </label>

                <div className="ghp-profile-actions">
                  <button
                    onClick={() => saveNote(selectedStudent.id, selectedStudent.notes)}
                    className="ghp-btn ghp-btn-ghost"
                    disabled={savingNote}
                  >
                    {savingNote ? "Saving..." : "Save Note"}
                  </button>
                  <button
                    onClick={() => awardStripe(selectedStudent.id)}
                    className="ghp-btn ghp-btn-primary"
                  >
                    Award Stripe
                  </button>
                  <button
                    onClick={() => promoteBelt(selectedStudent.id)}
                    className="ghp-btn ghp-btn-ghost"
                  >
                    Promote Belt
                  </button>
                  <button
                    onClick={() => deleteStudent(selectedStudent.id)}
                    className="ghp-btn ghp-btn-danger"
                  >
                    Delete Student
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
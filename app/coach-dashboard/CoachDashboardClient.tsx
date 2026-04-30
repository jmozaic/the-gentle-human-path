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
  | "Green/Black"
  | "Blue"
  | "Purple"
  | "Brown"
  | "Black";

type Student = {
  id: string;
  name: string;
  belt: Belt;
  stripes: number;
  notes: string;
  birthday?: string | null;
  roster?: string | null;
  belt_size?: string | null;
  belt_awarded_at?: string | null;
  adult_skill_ratings?: Record<string, number> | null;
};

type Session = {
  id?: string;
  student_id: string;
  date: string;
  attendance: boolean;
  behavior: boolean;
  technique: boolean;
};

const KIDS_BELTS: Belt[] = [
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

const ADULT_BELTS: Belt[] = ["White", "Blue", "Purple", "Brown", "Black"];

const ALL_BELTS: Belt[] = [
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
  "Blue",
  "Purple",
  "Brown",
  "Black",
];

const DEFAULT_ROSTERS = ["Eligible", "Wildlings", "Hunters", "Adults"];
const REAL_ROSTERS = ["Wildlings", "Hunters", "Adults"];

const TIER_PERCENTAGES: Record<2 | 3 | 4, number> = {
  2: 1.0,
  3: 0.9,
  4: 0.8,
};

const MIN_ATTENDANCE = 8;

const ADULT_MIN_YEARS: Record<string, number> = {
  White: 2,
  Blue: 3,
  Purple: 3,
  Brown: 2,
  Black: 0,
};

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateString: string): string {
  return dateString.slice(0, 7);
}

function isAdultStudent(student?: { roster?: string | null }) {
  return (student?.roster || "") === "Adults";
}

function getStripeMax(student?: { roster?: string | null }) {
  return isAdultStudent(student) ? 4 : 12;
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

function getAge(birthday?: string | null) {
  if (!birthday) return null;

  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;

  return age;
}

function getBirthdayParts(birthday?: string | null) {
  if (!birthday) return { month: "", day: "", year: "" };

  const [year, month, day] = birthday.split("-");
  return { month: month || "", day: day || "", year: year || "" };
}

function padBirthdayPart(value: string | number) {
  return String(value).padStart(2, "0");
}

function getBirthdayThisMonth(birthday?: string | null, selectedDate?: string) {
  if (!birthday || !selectedDate) return false;

  const [, month] = birthday.split("-");
  const selectedMonth = selectedDate.slice(5, 7);

  return month === selectedMonth;
}

function getUpcomingAge(birthday?: string | null, selectedDate?: string) {
  if (!birthday || !selectedDate) return null;

  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;

  const selected = new Date(selectedDate);
  return selected.getFullYear() - birth.getFullYear();
}

function formatBirthdayMD(birthday?: string | null) {
  if (!birthday) return "";
  const [, month, day] = birthday.split("-");
  return `${month}-${day}`;
}

function getYearsAtBelt(beltAwardedAt?: string | null) {
  if (!beltAwardedAt) return 0;

  const start = new Date(beltAwardedAt);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--;

  return years;
}

function getAdultMinYears(belt: Belt) {
  return ADULT_MIN_YEARS[belt] ?? 0;
}

function getSkillAverage(ratings?: Record<string, number> | null) {
  if (!ratings) return 0;

  const total = ADULT_SKILL_CATEGORIES.reduce((sum, category) => {
    return sum + Number(ratings[category] || 0);
  }, 0);

  return total / ADULT_SKILL_CATEGORIES.length;
}

function getPromotionStatus(student: Student) {
  if (isAdultStudent(student)) {
    if (student.belt === "Black") return "Black belt";

    const max = getStripeMax(student);
    const yearsAtBelt = getYearsAtBelt(student.belt_awarded_at);
    const minYears = getAdultMinYears(student.belt);

    if (student.stripes >= max && yearsAtBelt >= minYears) {
      return "Eligible for next belt";
    }

    if (student.stripes >= max && yearsAtBelt < minYears) {
      return `Needs time at belt (${yearsAtBelt}/${minYears} yrs)`;
    }

    return "Eligible for stripe review";
  }

  return student.stripes >= 12 ? "Eligible for next belt" : "Eligible for stripe";
}

function getBeltClass(belt: Belt) {
  if (belt.includes("Gray")) return "ghp-belt-gray";
  if (belt.includes("Yellow")) return "ghp-belt-yellow";
  if (belt.includes("Orange")) return "ghp-belt-orange";
  if (belt.includes("Green")) return "ghp-belt-green";
  if (belt === "Blue") return "ghp-belt-blue";
  if (belt === "Purple") return "ghp-belt-purple";
  if (belt === "Brown") return "ghp-belt-brown";
  if (belt === "Black") return "ghp-belt-black";
  return "ghp-belt-white";
}

function StripeDisplay({
  stripes,
  max,
}: {
  stripes: number;
  max: number;
}) {
  return (
    <div className="ghp-stripes">
      {Array.from({ length: max }, (_, i) => {
        const stripeNumber = i + 1;
        const isEarned = stripeNumber <= stripes;
        let colorClass = "ghp-stripe-white";

        if (max === 12) {
          if (stripeNumber >= 5 && stripeNumber <= 8) {
            colorClass = "ghp-stripe-yellow";
          }

          if (stripeNumber >= 9) {
            colorClass = "ghp-stripe-red";
          }
        }

        return (
          <span
            key={stripeNumber}
            className={`ghp-stripe ${isEarned ? colorClass : "ghp-stripe-empty"}`}
          />
        );
      })}
    </div>
  );
}

function BeltIcon({
  belt,
  stripes,
  max,
}: {
  belt: Belt;
  stripes: number;
  max: number;
}) {
  return (
    <div className="ghp-belt-card">
      <div className={`ghp-belt-icon ${getBeltClass(belt)}`}>
        <div className="ghp-belt-bar" />
      </div>

      <div>
        <div className="ghp-belt-title">{belt}</div>
        <div className="ghp-belt-subtitle">
          {stripes}/{max} stripes
        </div>
        <StripeDisplay stripes={stripes} max={max} />
      </div>
    </div>
  );
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
  const [activeRoster, setActiveRoster] = useState<string>("Wildlings");
  const [customRosters, setCustomRosters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [message, setMessage] = useState("");

  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [birthdayYear, setBirthdayYear] = useState("");

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
        birthday: student.birthday || null,
        roster: student.roster || "Wildlings",
        belt_size: student.belt_size || "",
        belt_awarded_at: student.belt_awarded_at || null,
        adult_skill_ratings: student.adult_skill_ratings || {},
      };
    });

    const allRosterNames = Array.from(
      new Set(studentList.map((s) => (s.roster || "").trim()).filter(Boolean))
    );

    const nonDefaultRosters = allRosterNames.filter(
      (r) => !REAL_ROSTERS.includes(r) && r !== "Eligible"
    );

    setCustomRosters(nonDefaultRosters);
    setStudents(studentList);
    setSessions(sessionsData as Session[]);
    setAvailableClasses(monthlySettingsData?.available_classes ?? 16);

    if (studentList.length > 0 && !selectedStudentId) {
      const firstInRoster = studentList.find(
        (s) => (s.roster || "Wildlings") === activeRoster
      );
      setSelectedStudentId(firstInRoster?.id || studentList[0].id);
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

      if (!error) setAvailableClasses(data?.available_classes ?? 16);
    }

    loadMonthlySettings();
  }, [selectedDate, supabase]);

  const allRosters = useMemo(() => {
    return Array.from(new Set([...DEFAULT_ROSTERS, ...customRosters]));
  }, [customRosters]);

  const rosterStudents = useMemo(() => {
    if (activeRoster === "Eligible") return students;
    return students.filter((s) => (s.roster || "Wildlings") === activeRoster);
  }, [students, activeRoster]);

  useEffect(() => {
    if (rosterStudents.length > 0) {
      const visible = rosterStudents.find((s) => s.id === selectedStudentId);
      if (!visible) setSelectedStudentId(rosterStudents[0].id);
    } else {
      setSelectedStudentId(null);
    }
  }, [rosterStudents, selectedStudentId]);

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
      const adult = isAdultStudent(student);
      const allStudentSessions = sessions.filter((s) => s.student_id === student.id);

      const monthSessions = allStudentSessions.filter(
        (s) => monthKey(s.date) === monthKey(selectedDate)
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

      const fastTrackReview =
        adult && attendance >= 8 && attendance >= Math.ceil(availableClasses * 0.9);

      const eligible = adult
        ? attendance >= MIN_ATTENDANCE
        : attendance >= MIN_ATTENDANCE &&
          total >= goal &&
          behavior >= behaviorGoal &&
          technique >= techniqueGoal;

      const streak = getCurrentStreak(allStudentSessions);

      const attendanceProgress =
        availableClasses > 0 ? Math.min((attendance / availableClasses) * 100, 100) : 0;

      const totalProgress = goal > 0 ? Math.min((total / goal) * 100, 100) : 0;

      const behaviorProgress =
        behaviorGoal > 0 ? Math.min((behavior / behaviorGoal) * 100, 100) : 0;

      const techniqueProgress =
        techniqueGoal > 0 ? Math.min((technique / techniqueGoal) * 100, 100) : 0;

      const yearsAtBelt = getYearsAtBelt(student.belt_awarded_at);
      const minYearsAtBelt = adult ? getAdultMinYears(student.belt) : 0;
      const skillAverage = adult ? getSkillAverage(student.adult_skill_ratings) : 0;

      return {
        ...student,
        adult,
        attendance,
        behavior,
        technique,
        total,
        goal,
        eligible,
        fastTrackReview,
        streak,
        careerStickers: getCareerStickerTotal(student.id),
        attendanceProgress,
        totalProgress,
        behaviorProgress,
        techniqueProgress,
        age: getAge(student.birthday),
        promotionStatus: getPromotionStatus(student),
        stripeMax: getStripeMax(student),
        yearsAtBelt,
        minYearsAtBelt,
        skillAverage,
      };
    });
  }, [students, sessions, selectedDate, availableClasses]);

  const visibleSummaries = summaries
    .filter((s) => {
      if (activeRoster === "Eligible") return s.eligible || s.fastTrackReview;
      return (s.roster || "Wildlings") === activeRoster;
    })
    .sort((a, b) => {
      const beltList = a.adult || b.adult ? ADULT_BELTS : KIDS_BELTS;
      const beltA = beltList.indexOf(a.belt);
      const beltB = beltList.indexOf(b.belt);

      if (beltA !== beltB) return beltB - beltA;
      if (a.stripes !== b.stripes) return b.stripes - a.stripes;

      const getLastName = (name: string) => {
        const parts = name.trim().split(" ");
        return parts[parts.length - 1].toLowerCase();
      };

      const lastA = getLastName(a.name);
      const lastB = getLastName(b.name);

      if (lastA !== lastB) return lastA.localeCompare(lastB);

      return a.name.localeCompare(b.name);
    });

  const birthdayStudents = summaries
    .filter((student) => getBirthdayThisMonth(student.birthday, selectedDate))
    .sort((a, b) => {
      const dayA = a.birthday ? Number(a.birthday.split("-")[2]) : 0;
      const dayB = b.birthday ? Number(b.birthday.split("-")[2]) : 0;
      return dayA - dayB;
    });

  const selectedStudent =
    visibleSummaries.find((s) => s.id === selectedStudentId) || null;

  useEffect(() => {
    const parts = getBirthdayParts(selectedStudent?.birthday || null);
    setBirthdayMonth(parts.month);
    setBirthdayDay(parts.day);
    setBirthdayYear(parts.year);
  }, [selectedStudent?.id, selectedStudent?.birthday]);

  const birthdayYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => String(currentYear - i));
  }, []);

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

    if (error) setMessage(error.message);
  }

  async function addRoster() {
    const rosterName = prompt("Enter new roster name");
    const trimmed = rosterName?.trim();

    if (!trimmed) return;
    if (allRosters.includes(trimmed)) {
      setActiveRoster(trimmed);
      return;
    }

    setCustomRosters((prev) => [...prev, trimmed]);
    setActiveRoster(trimmed);
  }

  async function addStudent() {
    const trimmed = newStudentName.trim();
    if (!trimmed) return;

    setMessage("Adding student...");

    const parentEmail = prompt("Enter parent email for this student") || "";
    const targetRoster = activeRoster === "Eligible" ? "Wildlings" : activeRoster;
    const adult = targetRoster === "Adults";

    const { data, error } = await supabase
      .from("students")
      .insert({
        name: trimmed,
        belt: newStudentBelt,
        stripes: 0,
        parent_email: parentEmail,
        roster: targetRoster,
        belt_size: "",
        belt_awarded_at: today(),
        adult_skill_ratings: adult ? {} : {},
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
      birthday: data.birthday || null,
      roster: data.roster || targetRoster,
      belt_size: data.belt_size || "",
      belt_awarded_at: data.belt_awarded_at || today(),
      adult_skill_ratings: data.adult_skill_ratings || {},
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
    if (updates.birthday !== undefined) dbUpdates.birthday = updates.birthday;
    if (updates.roster !== undefined) dbUpdates.roster = updates.roster;
    if (updates.belt_size !== undefined) dbUpdates.belt_size = updates.belt_size;
    if (updates.belt_awarded_at !== undefined) dbUpdates.belt_awarded_at = updates.belt_awarded_at;
    if (updates.adult_skill_ratings !== undefined) {
      dbUpdates.adult_skill_ratings = updates.adult_skill_ratings;
    }

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

    if (updates.roster && !allRosters.includes(updates.roster)) {
      setCustomRosters((prev) => [...prev, updates.roster!]);
    }
  }

  async function saveBirthdayFromParts(
    studentId: string,
    month: string,
    day: string,
    year: string
  ) {
    if (!month || !day || !year) {
      await updateStudent(studentId, { birthday: null });
      setMessage("");
      return;
    }

    const formatted = `${year}-${padBirthdayPart(month)}-${padBirthdayPart(day)}`;
    await updateStudent(studentId, { birthday: formatted });
    setMessage("");
  }

  async function updateAdultSkill(student: Student, category: string, value: number) {
    const safeValue = Math.max(0, Math.min(10, value));
    const updatedRatings = {
      ...(student.adult_skill_ratings || {}),
      [category]: safeValue,
    };

    await updateStudent(student.id, {
      adult_skill_ratings: updatedRatings,
    });
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

  async function awardStripe(studentId: string) {
    const student = summaries.find((s) => s.id === studentId);
    if (!student) return;

    if (!student.eligible && !student.fastTrackReview) {
      alert("This student is not eligible for a stripe review yet.");
      return;
    }

    await updateStudent(studentId, {
      stripes: Math.min(student.stripes + 1, getStripeMax(student)),
    });
  }

  async function promoteBelt(studentId: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const beltList = isAdultStudent(student) ? ADULT_BELTS : KIDS_BELTS;
    const currentIndex = beltList.indexOf(student.belt);
    const nextBelt = beltList[currentIndex + 1];

    if (!nextBelt) {
      alert("This student is already at the top belt.");
      return;
    }

    await updateStudent(studentId, {
      belt: nextBelt,
      stripes: 0,
      belt_awarded_at: today(),
    });
  }

  const selectedBeltOptions =
    activeRoster === "Adults" ? ADULT_BELTS : KIDS_BELTS;

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
            Organize students by roster, track progress, and manage each profile.
          </p>
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

      <div className="ghp-roster-tabs">
        {allRosters.map((roster) => (
          <button
            key={roster}
            type="button"
            className={`ghp-roster-tab ${activeRoster === roster ? "active" : ""}`}
            onClick={() => {
              setActiveRoster(roster);
              setNewStudentBelt(roster === "Adults" ? "White" : "White");
            }}
          >
            {roster}
          </button>
        ))}

        <button
          type="button"
          className="ghp-roster-tab ghp-roster-tab-add"
          onClick={addRoster}
        >
          + New Roster
        </button>
      </div>

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
            placeholder={`Add a student to ${
              activeRoster === "Eligible" ? "Wildlings" : activeRoster
            }`}
          />
        </label>

        <label className="ghp-field">
          <span>Starting Belt</span>
          <select
            value={newStudentBelt}
            onChange={(e) => setNewStudentBelt(e.target.value as Belt)}
          >
            {selectedBeltOptions.map((belt) => (
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
            <h2>{activeRoster} Roster</h2>
            <p>
              {activeRoster === "Eligible"
                ? "Students who need stripe, belt, or fast-track review."
                : activeRoster === "Adults"
                ? "Adults use attendance only and separate skill evaluation criteria."
                : "Mark attendance, behavior, and technique for the selected class date."}
            </p>
          </div>

          <div className="ghp-sheet">
            <div className="ghp-sheet-header">
              <div className="col-name">Name</div>
              <div className="col-center">A</div>
              {activeRoster !== "Adults" && (
                <>
                  <div className="col-center">B</div>
                  <div className="col-center">T</div>
                </>
              )}
              <div className="col-view">View</div>
            </div>

            {visibleSummaries.map((student) => {
              const session = getSession(student.id, selectedDate);

              return (
                <div
                  className={`ghp-sheet-row ${
                    student.adult ? "ghp-sheet-row-adult" : ""
                  }`}
                  key={student.id}
                >
                  <div className="col-name">
                    <div className="ghp-sheet-student">{student.name}</div>
                    <div className="ghp-sheet-meta">
                      {student.belt} • {student.stripes}/{student.stripeMax} stripes
                      {student.age !== null ? ` • ${student.age} yrs` : ""}
                      {student.adult
                        ? ` • ${student.yearsAtBelt}/${student.minYearsAtBelt} yrs at belt`
                        : ""}
                      {student.fastTrackReview ? " • Fast Track Review" : ""}
                      {activeRoster === "Eligible"
                        ? ` • ${student.promotionStatus} • Belt size: ${
                            student.belt_size || "Not set"
                          }`
                        : ""}
                    </div>
                  </div>

                  <div className="col-center">
                    <button
                      onClick={() => toggleSticker(student.id, "attendance")}
                      className={`ghp-bubble ${session.attendance ? "active-a" : ""}`}
                    >
                      A
                    </button>
                  </div>

                  {!student.adult && (
                    <>
                      <div className="col-center">
                        <button
                          onClick={() => toggleSticker(student.id, "behavior")}
                          className={`ghp-bubble ${session.behavior ? "active-b" : ""}`}
                        >
                          B
                        </button>
                      </div>

                      <div className="col-center">
                        <button
                          onClick={() => toggleSticker(student.id, "technique")}
                          className={`ghp-bubble ${session.technique ? "active-t" : ""}`}
                        >
                          T
                        </button>
                      </div>
                    </>
                  )}

                  <div className="col-view">
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

            {visibleSummaries.length === 0 ? (
              <div className="ghp-sheet-empty">No students in this roster yet.</div>
            ) : null}
          </div>
        </div>

        <div>
          {birthdayStudents.length > 0 ? (
            <div className="ghp-dash-card" style={{ marginBottom: "16px" }}>
              <div className="ghp-dash-card-header">
                <h2>Birthdays This Month</h2>
                <p>Students with birthdays during the selected month.</p>
              </div>

              <div className="ghp-birthday-list">
                {birthdayStudents.map((student) => (
                  <div key={student.id} className="ghp-birthday-row">
                    <div>
                      <div className="ghp-sheet-student">{student.name}</div>
                      <div className="ghp-sheet-meta">
                        {student.roster || "Wildlings"} •{" "}
                        {formatBirthdayMD(student.birthday)}
                      </div>
                    </div>

                    <div className="ghp-birthday-age">
                      Turns {getUpcomingAge(student.birthday, selectedDate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="ghp-dash-card">
            {!selectedStudent ? (
              <div className="ghp-empty">Select a student.</div>
            ) : (
              <>
                <div className="ghp-dash-card-header">
                  <h2>Student Profile</h2>
                  <p>
                    Edit roster, birthday, belt size, notes, and promotion status.
                  </p>
                </div>

                <div className="ghp-profile-shell">
                  <BeltIcon
                    belt={selectedStudent.belt}
                    stripes={selectedStudent.stripes}
                    max={selectedStudent.stripeMax}
                  />

                  {selectedStudent.fastTrackReview ? (
                    <div className="ghp-fast-track">
                      Fast Track Review: this adult is training at a high frequency.
                      Review closely for possible early stripe promotion.
                    </div>
                  ) : null}

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
                        {(selectedStudent.adult ? ADULT_BELTS : KIDS_BELTS).map(
                          (belt) => (
                            <option key={belt} value={belt}>
                              {belt}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label className="ghp-field">
                      <span>Stripes</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedStudent.stripeMax}
                        value={selectedStudent.stripes}
                        onChange={(e) =>
                          updateStudent(selectedStudent.id, {
                            stripes: Math.min(
                              Number(e.target.value),
                              selectedStudent.stripeMax
                            ),
                          })
                        }
                      />
                    </label>
                  </div>

                  <label className="ghp-field">
                    <span>Belt Awarded Date</span>
                    <input
                      type="date"
                      value={selectedStudent.belt_awarded_at || ""}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          belt_awarded_at: e.target.value || null,
                        })
                      }
                    />
                  </label>

                  <label className="ghp-field">
                    <span>Belt Size</span>
                    <input
                      type="text"
                      placeholder="M0, M1, M2, A0, A1..."
                      value={selectedStudent.belt_size || ""}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          belt_size: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="ghp-field">
                    <span>Birthday</span>

                    <div className="ghp-birthday-grid">
                      <select
                        value={birthdayMonth}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setBirthdayMonth(value);
                          await saveBirthdayFromParts(
                            selectedStudent.id,
                            value,
                            birthdayDay,
                            birthdayYear
                          );
                        }}
                      >
                        <option value="">Month</option>
                        {[
                          { value: "01", label: "Jan" },
                          { value: "02", label: "Feb" },
                          { value: "03", label: "Mar" },
                          { value: "04", label: "Apr" },
                          { value: "05", label: "May" },
                          { value: "06", label: "Jun" },
                          { value: "07", label: "Jul" },
                          { value: "08", label: "Aug" },
                          { value: "09", label: "Sep" },
                          { value: "10", label: "Oct" },
                          { value: "11", label: "Nov" },
                          { value: "12", label: "Dec" },
                        ].map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={birthdayDay}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setBirthdayDay(value);
                          await saveBirthdayFromParts(
                            selectedStudent.id,
                            birthdayMonth,
                            value,
                            birthdayYear
                          );
                        }}
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => {
                          const value = String(i + 1).padStart(2, "0");
                          return (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          );
                        })}
                      </select>

                      <select
                        value={birthdayYear}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setBirthdayYear(value);
                          await saveBirthdayFromParts(
                            selectedStudent.id,
                            birthdayMonth,
                            birthdayDay,
                            value
                          );
                        }}
                      >
                        <option value="">Year</option>
                        {birthdayYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="ghp-field">
                    <span>Roster</span>
                    <select
                      value={selectedStudent.roster || "Wildlings"}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          roster: e.target.value,
                          belt: e.target.value === "Adults" ? "White" : "White",
                          stripes: 0,
                          belt_awarded_at: today(),
                        })
                      }
                    >
                      {[...REAL_ROSTERS, ...customRosters].map((roster) => (
                        <option key={roster} value={roster}>
                          {roster}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="ghp-stat-grid">
                    <div className="ghp-stat">
                      <span>Promotion</span>
                      <strong>{selectedStudent.promotionStatus}</strong>
                    </div>
                    <div className="ghp-stat">
                      <span>Belt Size</span>
                      <strong>{selectedStudent.belt_size || "—"}</strong>
                    </div>
                    <div className="ghp-stat">
                      <span>Age</span>
                      <strong>{selectedStudent.age ?? "—"}</strong>
                    </div>
                    <div className="ghp-stat">
                      <span>Roster</span>
                      <strong>{selectedStudent.roster || "Wildlings"}</strong>
                    </div>
                    <div className="ghp-stat">
                      <span>Attendance Count</span>
                      <strong>{selectedStudent.attendance}</strong>
                    </div>
                    {selectedStudent.adult ? (
                      <>
                        <div className="ghp-stat">
                          <span>Years at Belt</span>
                          <strong>
                            {selectedStudent.yearsAtBelt}/{selectedStudent.minYearsAtBelt}
                          </strong>
                        </div>
                        <div className="ghp-stat">
                          <span>Total Skill Level</span>
                          <strong>{selectedStudent.skillAverage.toFixed(1)}/10</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ghp-stat">
                          <span>A / B / T</span>
                          <strong>
                            {selectedStudent.attendance} / {selectedStudent.behavior} /{" "}
                            {selectedStudent.technique}
                          </strong>
                        </div>
                        <div className="ghp-stat">
                          <span>Monthly Progress</span>
                          <strong>
                            {selectedStudent.total} / {selectedStudent.goal || 0}
                          </strong>
                        </div>
                      </>
                    )}
                    <div className="ghp-stat">
                      <span>Eligibility</span>
                      <strong className={selectedStudent.eligible ? "ghp-green" : "ghp-gold"}>
                        {selectedStudent.eligible ? "Eligible" : "Not Yet"}
                      </strong>
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

                    {!selectedStudent.adult ? (
                      <>
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
                      </>
                    ) : null}
                  </div>

                  {selectedStudent.adult ? (
                    <div className="ghp-adult-skills">
                      <div className="ghp-dash-card-header">
                        <h2>Adult Skill Evaluation</h2>
                        <p>Rate each area manually from 0 to 10.</p>
                      </div>

                      {ADULT_SKILL_CATEGORIES.map((category) => {
                        const value = Number(
                          selectedStudent.adult_skill_ratings?.[category] || 0
                        );

                        return (
                          <div key={category} className="ghp-skill-row">
                            <div className="ghp-skill-top">
                              <span>{category}</span>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={value}
                                onChange={(e) =>
                                  updateAdultSkill(
                                    selectedStudent,
                                    category,
                                    Number(e.target.value)
                                  )
                                }
                              />
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
        </div>
      </section>
    </main>
  );
}
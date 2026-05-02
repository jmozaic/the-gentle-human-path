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
  parent_email?: string | null;

  belt_awarded_at?: string | null;
  training_started_at?: string | null;
  last_stripe_awarded_at?: string | null;
  black_belt_degree?: number | null;
  adult_skill_ratings?: Record<string, number> | null;

  kids_training_started_at?: string | null;
  kids_last_belt_promotion_at?: string | null;
};

type Session = {
  id?: string;
  student_id: string;
  date: string;
  attendance: boolean;
  behavior: boolean;
  technique: boolean;
  sit_out_count?: number;
};

type MonthlySnapshot = {
  id?: string;
  student_id: string;
  month: string;
  attendance_count: number;
  behavior_count: number;
  technique_count: number;
  sit_out_count: number;
  final_tier: number;
  behavior_required: number;
  technique_required: number;
  status: string;
  eligible: boolean;
  coach_decision: "Pending" | "Approved" | "Denied";
  deny_reason?: string | null;
  calculated_at?: string | null;
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

const DEFAULT_ROSTERS = ["Stripe Queue", "Wildlings", "Hunters", "Adults"];
const REAL_ROSTERS = ["Wildlings", "Hunters", "Adults"];

const MIN_KID_ATTENDANCE = 8;

const ADULT_BELT_MONTHS: Record<string, number> = {
  White: 24,
  Blue: 36,
  Purple: 36,
  Brown: 24,
};

const BLACK_BELT_DEGREE_YEARS: Record<number, number> = {
  0: 3,
  1: 3,
  2: 3,
  3: 5,
  4: 5,
  5: 5,
  6: 7,
  7: 7,
  8: 10,
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

const MONTHS = [
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
];

const DENY_REASONS = [
  "Needs more time",
  "Behavior inconsistency",
  "Technical understanding",
  "Other",
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

function getMonthsSince(date?: string | null) {
  if (!date) return 0;

  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();

  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  if (now.getDate() < start.getDate()) months -= 1;

  return Math.max(months, 0);
}

function getYearsSince(date?: string | null) {
  if (!date) return 0;

  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--;

  return Math.max(years, 0);
}

function getDateParts(date?: string | null) {
  if (!date) return { month: "", day: "", year: "" };

  const [year, month, day] = date.split("-");
  return { month: month || "", day: day || "", year: year || "" };
}

function padDatePart(value: string | number) {
  return String(value).padStart(2, "0");
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

function getFinalTier(attendance: number): 2 | 3 | 4 {
  if (attendance >= 14) return 4;
  if (attendance >= 10) return 3;
  return 2;
}

function getTierBase(tier: number) {
  if (tier === 4) return 14;
  if (tier === 3) return 10;
  return 8;
}

function getRequiredForTier(tier: number) {
  const base = getTierBase(tier);

  return {
    behaviorRequired: Math.ceil(base * 0.9),
    techniqueRequired: Math.ceil(base * 0.9),
  };
}

function getDaysInMonth(dateString: string) {
  const date = new Date(dateString);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getDayOfMonth(dateString: string) {
  return new Date(dateString).getDate();
}

function getProjectedTier(attendance: number, selectedDate: string): 2 | 3 | 4 | null {
  if (attendance <= 0) return null;

  const daysElapsed = Math.max(getDayOfMonth(selectedDate), 1);
  const daysInMonth = getDaysInMonth(selectedDate);
  const projectedAttendance = (attendance / daysElapsed) * daysInMonth;

  if (projectedAttendance >= 14) return 4;
  if (projectedAttendance >= 10) return 3;
  if (projectedAttendance >= 8) return 2;

  return null;
}

function getKidStatus({
  attendance,
  behavior,
  technique,
  tier,
}: {
  attendance: number;
  behavior: number;
  technique: number;
  tier: number;
}) {
  const { behaviorRequired, techniqueRequired } = getRequiredForTier(tier);

  if (attendance < MIN_KID_ATTENDANCE) {
    return {
      status: "Not Enough Classes",
      eligible: false,
      behaviorRequired,
      techniqueRequired,
    };
  }

  if (behavior >= behaviorRequired && technique >= techniqueRequired) {
    return {
      status: "Stripe Eligible (ABT Met)",
      eligible: true,
      behaviorRequired,
      techniqueRequired,
    };
  }

  const behaviorPct = behaviorRequired > 0 ? behavior / behaviorRequired : 0;
  const techniquePct = techniqueRequired > 0 ? technique / techniqueRequired : 0;
  const combined = (behaviorPct + techniquePct) / 2;

  if (combined >= 0.9) {
    return {
      status: "On Track",
      eligible: false,
      behaviorRequired,
      techniqueRequired,
    };
  }

  if (combined >= 0.75) {
    return {
      status: "Close",
      eligible: false,
      behaviorRequired,
      techniqueRequired,
    };
  }

  return {
    status: "Not Eligible",
    eligible: false,
    behaviorRequired,
    techniqueRequired,
  };
}

function getSkillAverage(ratings?: Record<string, number> | null) {
  if (!ratings) return 0;

  const total = ADULT_SKILL_CATEGORIES.reduce((sum, category) => {
    return sum + Number(ratings[category] || 0);
  }, 0);

  return total / ADULT_SKILL_CATEGORIES.length;
}

function getBlackBeltNextDegreeYears(degree?: number | null) {
  const current = Number(degree || 0);
  return BLACK_BELT_DEGREE_YEARS[current] ?? null;
}

function getRequiredMonthsForAdultBelt(belt: Belt) {
  return ADULT_BELT_MONTHS[belt] ?? null;
}

function getAdultPromotionStatus(student: Student) {
  if (student.belt === "Black") {
    const degree = Number(student.black_belt_degree || 0);
    const requiredYears = getBlackBeltNextDegreeYears(degree);
    const yearsInGrade = getYearsSince(student.belt_awarded_at);

    if (requiredYears === null) return "Highest black belt degree";
    if (yearsInGrade >= requiredYears) return `Eligible for ${degree + 1} degree`;

    return `Needs time in grade (${yearsInGrade}/${requiredYears} yrs)`;
  }

  const max = getStripeMax(student);
  const monthsAtBelt = getMonthsSince(student.belt_awarded_at);
  const requiredMonths = getRequiredMonthsForAdultBelt(student.belt);

  if (student.stripes >= max && requiredMonths && monthsAtBelt >= requiredMonths) {
    return "Coach Review";
  }

  if (student.stripes >= max && requiredMonths && monthsAtBelt < requiredMonths) {
    return `Needs time at belt (${monthsAtBelt}/${requiredMonths} months)`;
  }

  return "Stripe Review";
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

function StripeDisplay({ stripes, max }: { stripes: number; max: number }) {
  return (
    <div className="ghp-stripes">
      {Array.from({ length: max }, (_, i) => {
        const stripeNumber = i + 1;
        const isEarned = stripeNumber <= stripes;
        let colorClass = "ghp-stripe-white";

        if (max === 12) {
          if (stripeNumber >= 5 && stripeNumber <= 8) colorClass = "ghp-stripe-yellow";
          if (stripeNumber >= 9) colorClass = "ghp-stripe-red";
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
  degree,
}: {
  belt: Belt;
  stripes: number;
  max: number;
  degree?: number | null;
}) {
  return (
    <div className="ghp-belt-card">
      <div className={`ghp-belt-icon ${getBeltClass(belt)}`}>
        <div className="ghp-belt-bar" />
      </div>

      <div>
        <div className="ghp-belt-title">
          {belt}
          {belt === "Black" ? ` • ${Number(degree || 0)} Degree` : ""}
        </div>
        <div className="ghp-belt-subtitle">
          {belt === "Black" ? "Time-in-grade tracking" : `${stripes}/${max} stripes`}
        </div>
        {belt !== "Black" ? <StripeDisplay stripes={stripes} max={max} /> : null}
      </div>
    </div>
  );
}

function DateDropdown({
  label,
  value,
  years,
  onSave,
}: {
  label: string;
  value?: string | null;
  years: string[];
  onSave: (value: string | null) => void;
}) {
  const parts = getDateParts(value);
  const [month, setMonth] = useState(parts.month);
  const [day, setDay] = useState(parts.day);
  const [year, setYear] = useState(parts.year);

  useEffect(() => {
    const next = getDateParts(value);
    setMonth(next.month);
    setDay(next.day);
    setYear(next.year);
  }, [value]);

  function save(nextMonth: string, nextDay: string, nextYear: string) {
    if (!nextMonth && !nextDay && !nextYear) {
      onSave(null);
      return;
    }

    if (nextMonth && nextDay && nextYear) {
      onSave(`${nextYear}-${padDatePart(nextMonth)}-${padDatePart(nextDay)}`);
    }
  }

  return (
    <label className="ghp-field">
      <span>{label}</span>

      <div className="ghp-birthday-grid">
        <select
          value={month}
          onChange={(e) => {
            const next = e.target.value;
            setMonth(next);
            save(next, day, year);
          }}
        >
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={day}
          onChange={(e) => {
            const next = e.target.value;
            setDay(next);
            save(month, next, year);
          }}
        >
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => {
            const v = String(i + 1).padStart(2, "0");
            return (
              <option key={v} value={v}>
                {v}
              </option>
            );
          })}
        </select>

        <select
          value={year}
          onChange={(e) => {
            const next = e.target.value;
            setYear(next);
            save(month, day, next);
          }}
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export default function CoachDashboardClient() {
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);

  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [kidsAvailableClasses, setKidsAvailableClasses] = useState<number>(16);
  const [adultsAvailableClasses, setAdultsAvailableClasses] = useState<number>(16);

  const [monthLocked, setMonthLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentBelt, setNewStudentBelt] = useState<Belt>("White");
  const [activeRoster, setActiveRoster] = useState<string>("Wildlings");
  const [customRosters, setCustomRosters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [message, setMessage] = useState("");

  const currentMonth = monthKey(selectedDate);

  async function loadDashboardData() {
    setLoading(true);
    setMessage("");

    const [
      studentsResponse,
      sessionsResponse,
      notesResponse,
      monthlySettingsResponse,
      snapshotsResponse,
    ] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: true }),
      supabase.from("sessions").select("*"),
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("monthly_settings")
        .select("*")
        .eq("month", currentMonth)
        .maybeSingle(),
      supabase
        .from("monthly_snapshots")
        .select("*")
        .eq("month", currentMonth),
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

    if (snapshotsResponse.error) {
      setMessage(snapshotsResponse.error.message);
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
        parent_email: student.parent_email || "",
        belt_awarded_at: student.belt_awarded_at || null,
        training_started_at: student.training_started_at || null,
        last_stripe_awarded_at: student.last_stripe_awarded_at || null,
        black_belt_degree: student.black_belt_degree || 0,
        adult_skill_ratings: student.adult_skill_ratings || {},
        kids_training_started_at: student.kids_training_started_at || null,
        kids_last_belt_promotion_at: student.kids_last_belt_promotion_at || null,
      };
    });

    const allRosterNames = Array.from(
      new Set(studentList.map((s) => (s.roster || "").trim()).filter(Boolean))
    );

    const nonDefaultRosters = allRosterNames.filter(
      (r) => !REAL_ROSTERS.includes(r) && r !== "Stripe Queue"
    );

    setCustomRosters(nonDefaultRosters);
    setStudents(studentList);
    setSessions(sessionsData as Session[]);
    setSnapshots((snapshotsResponse.data || []) as MonthlySnapshot[]);

    setKidsAvailableClasses(
      monthlySettingsData?.kids_available_classes ??
        monthlySettingsData?.available_classes ??
        16
    );

    setAdultsAvailableClasses(
      monthlySettingsData?.adults_available_classes ??
        monthlySettingsData?.available_classes ??
        16
    );

    setMonthLocked(Boolean(monthlySettingsData?.locked));
    setLockedAt(monthlySettingsData?.locked_at || null);

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
  }, [currentMonth]);

  const dateYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => String(currentYear - i));
  }, []);

  const allRosters = useMemo(() => {
    return Array.from(new Set([...DEFAULT_ROSTERS, ...customRosters]));
  }, [customRosters]);

  const summaries = useMemo(() => {
    return students.map((student) => {
      const adult = isAdultStudent(student);
      const availableClasses = adult ? adultsAvailableClasses : kidsAvailableClasses;
      const blackBelt = adult && student.belt === "Black";

      const allStudentSessions = sessions.filter((s) => s.student_id === student.id);

      const monthSessions = allStudentSessions.filter(
        (s) => monthKey(s.date) === currentMonth
      );

      const selectedSession = sessions.find(
        (s) => s.student_id === student.id && s.date === selectedDate
      );

      const attendance = monthSessions.filter((s) => s.attendance).length;
      const behavior = adult ? 0 : monthSessions.filter((s) => s.behavior).length;
      const technique = adult ? 0 : monthSessions.filter((s) => s.technique).length;
      const sitOuts = monthSessions.reduce(
        (sum, s) => sum + Number(s.sit_out_count || 0),
        0
      );

      const finalTier = getFinalTier(attendance);
      const projectedTier = adult ? null : getProjectedTier(attendance, selectedDate);

      const kidStatus = getKidStatus({
        attendance,
        behavior,
        technique,
        tier: finalTier,
      });

      const snapshot = snapshots.find((s) => s.student_id === student.id);

      const yearsAtBelt = getYearsSince(student.belt_awarded_at);
      const monthsAtBelt = getMonthsSince(student.belt_awarded_at);
      const requiredMonthsAtBelt =
        adult && !blackBelt ? getRequiredMonthsForAdultBelt(student.belt) : null;

      const trainingYears = getYearsSince(student.training_started_at);
      const kidsTrainingYears = getYearsSince(student.kids_training_started_at);
      const kidsMonthsSinceLastPromotion = getMonthsSince(
        student.kids_last_belt_promotion_at
      );

      const fastTrackAverage = adult ? getFastTrackAverage(student.id) : 0;
      const fastTrackReview = adult && fastTrackAverage >= 4;

      const blackDegree = Number(student.black_belt_degree || 0);
      const blackDegreeRequiredYears = blackBelt
        ? getBlackBeltNextDegreeYears(blackDegree)
        : null;
      const blackDegreeEligible =
        blackBelt &&
        blackDegreeRequiredYears !== null &&
        yearsAtBelt >= blackDegreeRequiredYears;

      const adultNextBeltEligible =
        adult &&
        !blackBelt &&
        student.stripes >= getStripeMax(student) &&
        requiredMonthsAtBelt !== null &&
        monthsAtBelt >= requiredMonthsAtBelt;

      const adultEligible = adult
        ? fastTrackReview || adultNextBeltEligible || blackDegreeEligible
        : false;

      const attendanceProgress =
        availableClasses > 0 ? Math.min((attendance / availableClasses) * 100, 100) : 0;

      const behaviorProgress =
        kidStatus.behaviorRequired > 0
          ? Math.min((behavior / kidStatus.behaviorRequired) * 100, 100)
          : 0;

      const techniqueProgress =
        kidStatus.techniqueRequired > 0
          ? Math.min((technique / kidStatus.techniqueRequired) * 100, 100)
          : 0;

      const combinedProgress =
        !adult ? Math.round((behaviorProgress + techniqueProgress) / 2) : 0;

      const skillAverage =
        adult && !blackBelt ? getSkillAverage(student.adult_skill_ratings) : 0;

      const behaviorRisk =
        !adult && sitOuts >= 3
          ? sitOuts >= 5
            ? "High Behavior Risk"
            : "Behavior Risk"
          : "";

      const promotionStatus = adult
        ? getAdultPromotionStatus(student)
        : snapshot?.status || kidStatus.status;

      const eligible = adult ? adultEligible : snapshot?.eligible ?? kidStatus.eligible;

      return {
        ...student,
        adult,
        blackBelt,
        selectedSession,
        availableClasses,
        attendance,
        behavior,
        technique,
        sitOuts,
        finalTier,
        projectedTier,
        behaviorRequired: kidStatus.behaviorRequired,
        techniqueRequired: kidStatus.techniqueRequired,
        status: snapshot?.status || kidStatus.status,
        eligible,
        snapshot,
        fastTrackAverage,
        fastTrackReview,
        streak: getCurrentStreak(allStudentSessions),
        careerStickers: getCareerStickerTotal(student.id),
        attendanceProgress,
        behaviorProgress,
        techniqueProgress,
        combinedProgress,
        age: getAge(student.birthday),
        promotionStatus,
        stripeMax: getStripeMax(student),
        yearsAtBelt,
        monthsAtBelt,
        requiredMonthsAtBelt,
        trainingYears,
        kidsTrainingYears,
        kidsMonthsSinceLastPromotion,
        skillAverage,
        blackDegree,
        blackDegreeRequiredYears,
        blackDegreeEligible,
        behaviorRisk,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    students,
    sessions,
    snapshots,
    selectedDate,
    currentMonth,
    kidsAvailableClasses,
    adultsAvailableClasses,
  ]);

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

  function getFastTrackAverage(studentId: string) {
    const anchor = new Date(selectedDate);
    const cutoff = new Date(anchor);
    cutoff.setDate(anchor.getDate() - 90);

    const count = sessions.filter((session) => {
      if (session.student_id !== studentId || !session.attendance) return false;

      const date = new Date(session.date);
      return date >= cutoff && date <= anchor;
    }).length;

    return count / 13;
  }

  const visibleSummaries = summaries
    .filter((student) => {
      if (activeRoster === "Stripe Queue") {
        return (
          !student.adult &&
          student.snapshot?.eligible &&
          student.snapshot.coach_decision === "Pending"
        );
      }

      return (student.roster || "Wildlings") === activeRoster;
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

  const rosterStudents = useMemo(() => {
    if (activeRoster === "Stripe Queue") return summaries.filter((s) => s.snapshot?.eligible);
    return summaries.filter((s) => (s.roster || "Wildlings") === activeRoster);
  }, [summaries, activeRoster]);

  useEffect(() => {
    if (rosterStudents.length > 0) {
      const visible = rosterStudents.find((s) => s.id === selectedStudentId);
      if (!visible) setSelectedStudentId(rosterStudents[0].id);
    } else {
      setSelectedStudentId(null);
    }
  }, [rosterStudents, selectedStudentId]);

  const selectedStudent = summaries.find((s) => s.id === selectedStudentId) || null;

  const birthdayStudents = summaries
    .filter((student) => getBirthdayThisMonth(student.birthday, selectedDate))
    .sort((a, b) => {
      const dayA = a.birthday ? Number(a.birthday.split("-")[2]) : 0;
      const dayB = b.birthday ? Number(b.birthday.split("-")[2]) : 0;
      return dayA - dayB;
    });

  const classSnapshot = useMemo(() => {
    const baseStudents =
      activeRoster === "Stripe Queue"
        ? summaries.filter((s) => !s.adult)
        : summaries.filter((s) => (s.roster || "Wildlings") === activeRoster);

    const totalRoster = baseStudents.length;
    const present = baseStudents.filter((s) => s.selectedSession?.attendance).length;
    const behaviorPassed = baseStudents.filter((s) => s.selectedSession?.behavior).length;
    const techniquePassed = baseStudents.filter((s) => s.selectedSession?.technique).length;

    const behaviorOfTotal =
      totalRoster > 0 ? Math.round((behaviorPassed / totalRoster) * 100) : 0;

    const behaviorOfPresent =
      present > 0 ? Math.round((behaviorPassed / present) * 100) : 0;

    const techniqueOfTotal =
      totalRoster > 0 ? Math.round((techniquePassed / totalRoster) * 100) : 0;

    return {
      totalRoster,
      present,
      behaviorPassed,
      techniquePassed,
      behaviorOfTotal,
      behaviorOfPresent,
      techniqueOfTotal,
    };
  }, [summaries, activeRoster]);

  const leaderboard = useMemo(() => {
    const anchor = new Date(selectedDate);
    const cutoff = new Date(anchor);
    cutoff.setDate(anchor.getDate() - 28);

    return summaries
      .filter((s) => !s.adult)
      .map((student) => {
        const recentSessions = sessions.filter((session) => {
          if (session.student_id !== student.id) return false;
          const date = new Date(session.date);
          return date >= cutoff && date <= anchor;
        });

        const attendance = recentSessions.filter((s) => s.attendance).length;
        const behavior = recentSessions.filter((s) => s.behavior).length;

        const tierBase = getTierBase(student.finalTier);
        const attendanceScore = Math.min((attendance / tierBase) * 100, 100);
        const behaviorScore = attendance > 0 ? (behavior / attendance) * 100 : 0;
        const score = Math.round((attendanceScore + behaviorScore) / 2);

        return {
          id: student.id,
          name: student.name,
          score,
          attendanceScore: Math.round(attendanceScore),
          behaviorScore: Math.round(behaviorScore),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [summaries, sessions, selectedDate]);

  async function saveMonthlySettings(
    month: string,
    kidsClasses: number,
    adultClasses: number
  ) {
    const { error } = await supabase
      .from("monthly_settings")
      .upsert(
        {
          month,
          available_classes: kidsClasses,
          kids_available_classes: kidsClasses,
          adults_available_classes: adultClasses,
        },
        { onConflict: "month" }
      );

    if (error) setMessage(error.message);
  }

  async function calculateMonthlySnapshots() {
    setMessage("Calculating monthly snapshots...");

    const kids = summaries.filter((student) => !student.adult);

    const rows = kids.map((student) => {
      const finalTier = getFinalTier(student.attendance);
      const status = getKidStatus({
        attendance: student.attendance,
        behavior: student.behavior,
        technique: student.technique,
        tier: finalTier,
      });

      return {
        student_id: student.id,
        month: currentMonth,
        attendance_count: student.attendance,
        behavior_count: student.behavior,
        technique_count: student.technique,
        sit_out_count: student.sitOuts,
        final_tier: finalTier,
        behavior_required: status.behaviorRequired,
        technique_required: status.techniqueRequired,
        status: status.status,
        eligible: status.eligible,
        coach_decision: "Pending",
        deny_reason: null,
        calculated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("monthly_snapshots")
      .upsert(rows, { onConflict: "student_id,month" });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase
      .from("monthly_settings")
      .upsert(
        {
          month: currentMonth,
          available_classes: kidsAvailableClasses,
          kids_available_classes: kidsAvailableClasses,
          adults_available_classes: adultsAvailableClasses,
          snapshots_calculated_at: new Date().toISOString(),
        },
        { onConflict: "month" }
      );

    setMessage("Monthly snapshots calculated.");
    await loadDashboardData();
  }

  async function lockMonth() {
    if (!window.confirm("Lock this month? Sessions should not be edited after lock.")) {
      return;
    }

    await calculateMonthlySnapshots();

    const { error } = await supabase
      .from("monthly_settings")
      .upsert(
        {
          month: currentMonth,
          available_classes: kidsAvailableClasses,
          kids_available_classes: kidsAvailableClasses,
          adults_available_classes: adultsAvailableClasses,
          locked: true,
          locked_at: new Date().toISOString(),
        },
        { onConflict: "month" }
      );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMonthLocked(true);
    setLockedAt(new Date().toISOString());
    setMessage("Month locked.");
    await loadDashboardData();
  }

  async function unlockMonth() {
    if (!window.confirm("Unlock this month? This should only be used to fix mistakes.")) {
      return;
    }

    const { error } = await supabase
      .from("monthly_settings")
      .update({
        locked: false,
        locked_at: null,
      })
      .eq("month", currentMonth);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMonthLocked(false);
    setLockedAt(null);
    setMessage("Month unlocked.");
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
    const targetRoster = activeRoster === "Stripe Queue" ? "Wildlings" : activeRoster;
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
        belt_awarded_at: adult ? today() : null,
        training_started_at: adult ? today() : null,
        last_stripe_awarded_at: null,
        black_belt_degree: 0,
        adult_skill_ratings: adult ? {} : {},
        kids_training_started_at: adult ? null : today(),
        kids_last_belt_promotion_at: adult ? null : today(),
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
      parent_email: data.parent_email || "",
      belt_awarded_at: data.belt_awarded_at || null,
      training_started_at: data.training_started_at || null,
      last_stripe_awarded_at: data.last_stripe_awarded_at || null,
      black_belt_degree: data.black_belt_degree || 0,
      adult_skill_ratings: data.adult_skill_ratings || {},
      kids_training_started_at: data.kids_training_started_at || null,
      kids_last_belt_promotion_at: data.kids_last_belt_promotion_at || null,
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
    await supabase.from("monthly_snapshots").delete().eq("student_id", studentId);

    const { error } = await supabase.from("students").delete().eq("id", studentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setSessions((prev) => prev.filter((s) => s.student_id !== studentId));
    setSnapshots((prev) => prev.filter((s) => s.student_id !== studentId));
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
    if (updates.parent_email !== undefined) dbUpdates.parent_email = updates.parent_email;
    if (updates.belt_awarded_at !== undefined) dbUpdates.belt_awarded_at = updates.belt_awarded_at;
    if (updates.training_started_at !== undefined) dbUpdates.training_started_at = updates.training_started_at;
    if (updates.last_stripe_awarded_at !== undefined) dbUpdates.last_stripe_awarded_at = updates.last_stripe_awarded_at;
    if (updates.black_belt_degree !== undefined) dbUpdates.black_belt_degree = updates.black_belt_degree;
    if (updates.adult_skill_ratings !== undefined) dbUpdates.adult_skill_ratings = updates.adult_skill_ratings;
    if (updates.kids_training_started_at !== undefined) dbUpdates.kids_training_started_at = updates.kids_training_started_at;
    if (updates.kids_last_belt_promotion_at !== undefined) dbUpdates.kids_last_belt_promotion_at = updates.kids_last_belt_promotion_at;

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
        sit_out_count: 0,
      }
    );
  }

  async function saveSession(nextSession: Session) {
    if (monthLocked) {
      alert("This month is locked. Sessions cannot be edited after lock.");
      return;
    }

    if (nextSession.technique && !nextSession.behavior) {
      nextSession.technique = false;
    }

    const existing = sessions.find(
      (s) => s.student_id === nextSession.student_id && s.date === nextSession.date
    );

    if (existing?.id) {
      const { error } = await supabase
        .from("sessions")
        .update({
          attendance: nextSession.attendance,
          behavior: nextSession.behavior,
          technique: nextSession.technique,
          sit_out_count: nextSession.sit_out_count || 0,
        })
        .eq("id", existing.id);

      if (error) {
        setMessage(error.message);
        return;
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === existing.id ? { ...s, ...nextSession } : s))
      );
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        student_id: nextSession.student_id,
        date: nextSession.date,
        attendance: nextSession.attendance,
        behavior: nextSession.behavior,
        technique: nextSession.technique,
        sit_out_count: nextSession.sit_out_count || 0,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setSessions((prev) => [...prev, data as Session]);
  }

  async function toggleSticker(
    studentId: string,
    field: "attendance" | "behavior" | "technique"
  ) {
    const session = getSession(studentId, selectedDate);
    const nextSession = { ...session };

    if (field === "attendance") {
      nextSession.attendance = !nextSession.attendance;

      if (!nextSession.attendance) {
        nextSession.behavior = false;
        nextSession.technique = false;
        nextSession.sit_out_count = 0;
      }
    }

    if (field === "behavior") {
      nextSession.behavior = !nextSession.behavior;

      if (nextSession.behavior) {
        nextSession.attendance = true;
      } else {
        nextSession.technique = false;
      }
    }

    if (field === "technique") {
      if (!nextSession.behavior) {
        alert("Technique cannot be recorded unless behavior is true.");
        return;
      }

      nextSession.technique = !nextSession.technique;

      if (nextSession.technique) {
        nextSession.attendance = true;
        nextSession.behavior = true;
      }
    }

    await saveSession(nextSession);
  }

  async function addSitOut(studentId: string) {
    const session = getSession(studentId, selectedDate);
    const nextSession = {
      ...session,
      attendance: true,
      behavior: false,
      technique: false,
      sit_out_count: Number(session.sit_out_count || 0) + 1,
    };

    await saveSession(nextSession);
  }

  async function removeSitOut(studentId: string) {
    const session = getSession(studentId, selectedDate);
    const nextSession = {
      ...session,
      sit_out_count: Math.max(Number(session.sit_out_count || 0) - 1, 0),
    };

    await saveSession(nextSession);
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

    await updateStudent(studentId, {
      stripes: Math.min(student.stripes + 1, getStripeMax(student)),
      last_stripe_awarded_at: today(),
    });
  }

  async function approveSnapshot(studentId: string) {
    const snapshot = snapshots.find((s) => s.student_id === studentId);

    if (!snapshot) {
      alert("No monthly snapshot found. Calculate the month first.");
      return;
    }

    await awardStripe(studentId);

    const { error } = await supabase
      .from("monthly_snapshots")
      .update({
        coach_decision: "Approved",
        deny_reason: null,
      })
      .eq("student_id", studentId)
      .eq("month", currentMonth);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Stripe approved and awarded.");
    await loadDashboardData();
  }

  async function denySnapshot(studentId: string) {
    const reason = prompt(
      `Why are you denying this stripe?\n\n${DENY_REASONS.join("\n")}`
    );

    if (!reason) return;

    const { error } = await supabase
      .from("monthly_snapshots")
      .update({
        coach_decision: "Denied",
        deny_reason: reason,
      })
      .eq("student_id", studentId)
      .eq("month", currentMonth);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Stripe denied.");
    await loadDashboardData();
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
      belt_awarded_at: isAdultStudent(student) ? today() : student.belt_awarded_at || null,
      kids_last_belt_promotion_at: isAdultStudent(student)
        ? student.kids_last_belt_promotion_at || null
        : today(),
      last_stripe_awarded_at: null,
      black_belt_degree: nextBelt === "Black" ? 0 : student.black_belt_degree || 0,
    });
  }

  async function awardBlackBeltDegree(studentId: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const currentDegree = Number(student.black_belt_degree || 0);

    if (currentDegree >= 9) {
      alert("This student is already at the highest black belt degree.");
      return;
    }

    await updateStudent(studentId, {
      black_belt_degree: currentDegree + 1,
      belt_awarded_at: today(),
    });
  }

  const selectedBeltOptions = activeRoster === "Adults" ? ADULT_BELTS : KIDS_BELTS;

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
            Track ABT, calculate month-end stripe eligibility, and manage students.
          </p>
        </div>

        <div className="ghp-brand-chip">
          <div className="ghp-brand-chip-mark">GH</div>
          <div>
            <div className="ghp-brand-chip-title">
              {monthLocked ? "Month Locked" : "Month Open"}
            </div>
            <div className="ghp-brand-chip-sub">
              {lockedAt ? `Locked ${lockedAt.slice(0, 10)}` : currentMonth}
            </div>
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
              setNewStudentBelt("White");
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
          <span>Kids Classes This Month</span>
          <input
            type="number"
            value={kidsAvailableClasses}
            onChange={async (e) => {
              const value = Number(e.target.value);
              setKidsAvailableClasses(value);
              await saveMonthlySettings(currentMonth, value, adultsAvailableClasses);
            }}
          />
        </label>

        <label className="ghp-field">
          <span>Adult Classes This Month</span>
          <input
            type="number"
            value={adultsAvailableClasses}
            onChange={async (e) => {
              const value = Number(e.target.value);
              setAdultsAvailableClasses(value);
              await saveMonthlySettings(currentMonth, kidsAvailableClasses, value);
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
              activeRoster === "Stripe Queue" ? "Wildlings" : activeRoster
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

      <section className="ghp-dash-toolbar">
        <button onClick={calculateMonthlySnapshots} className="ghp-btn ghp-btn-ghost">
          Calculate Month
        </button>

        {!monthLocked ? (
          <button onClick={lockMonth} className="ghp-btn ghp-btn-primary">
            Lock Month
          </button>
        ) : (
          <button onClick={unlockMonth} className="ghp-btn ghp-btn-danger">
            Unlock Month
          </button>
        )}

        <div className="ghp-stat">
          <span>Class Snapshot</span>
          <strong>
            {classSnapshot.present}/{classSnapshot.totalRoster}
          </strong>
          <div className="ghp-sheet-meta">
            Behavior {classSnapshot.behaviorPassed}/{classSnapshot.present} • Technique{" "}
            {classSnapshot.techniquePassed}/{classSnapshot.present} • Behavior{" "}
            {classSnapshot.behaviorOfPresent}%
          </div>
        </div>
      </section>

      <section className="ghp-dash-grid">
        <div className="ghp-dash-card">
          <div className="ghp-dash-card-header">
            <h2>{activeRoster} Roster</h2>
            <p>
              {activeRoster === "Stripe Queue"
                ? "Students whose locked monthly snapshot is Stripe Eligible and still pending."
                : activeRoster === "Adults"
                ? "Adults use attendance only and adult criteria."
                : "Kids use ABT. Technique cannot be recorded unless behavior is true."}
            </p>
          </div>

          <div className="ghp-sheet">
            {visibleSummaries.map((student) => {
              const session = getSession(student.id, selectedDate);
              const isQueue = activeRoster === "Stripe Queue";

              return (
                <div
                  className="ghp-sheet-row"
                  key={student.id}
                  style={
                    isQueue
                      ? { gridTemplateColumns: "minmax(180px, 1fr) 360px" }
                      : undefined
                  }
                >
                  <div className="col-name">
                    <div className="ghp-sheet-student">{student.name}</div>

                    <div className="ghp-sheet-meta">
                      {student.belt}
                      {student.blackBelt
                        ? ` • ${student.blackDegree} degree`
                        : ` • ${student.stripes}/${student.stripeMax} stripes`}
                      {student.age !== null ? ` • ${student.age} yrs` : ""}
                      {!student.adult
                        ? ` • ${student.status} • Tier ${student.finalTier}x`
                        : ""}
                      {student.projectedTier
                        ? ` • Projected ${student.projectedTier}x`
                        : ""}
                      {student.behaviorRisk ? ` • ⚠ ${student.behaviorRisk}` : ""}
                    </div>

                    {!student.adult ? (
                      <div className="ghp-sheet-meta">
                        B {student.behavior}/{student.behaviorRequired} • T{" "}
                        {student.technique}/{student.techniqueRequired} • Sit-outs{" "}
                        {student.sitOuts}
                      </div>
                    ) : null}
                  </div>

                  {isQueue ? (
                    <div
                      className="col-view"
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                      }}
                    >
                      <button
                        onClick={() => setSelectedStudentId(student.id)}
                        className="ghp-btn ghp-btn-ghost ghp-btn-small"
                      >
                        View
                      </button>

                      <button
                        onClick={() => approveSnapshot(student.id)}
                        className="ghp-btn ghp-btn-primary"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => denySnapshot(student.id)}
                        className="ghp-btn ghp-btn-danger"
                      >
                        Deny
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="col-center">
                        <button
                          onClick={() => toggleSticker(student.id, "attendance")}
                          className={`ghp-bubble ${session.attendance ? "active-a" : ""}`}
                        >
                          A
                        </button>
                      </div>

                      <div className="col-center">
                        {!student.adult ? (
                          <button
                            onClick={() => toggleSticker(student.id, "behavior")}
                            className={`ghp-bubble ${session.behavior ? "active-b" : ""}`}
                          >
                            B
                          </button>
                        ) : null}
                      </div>

                      <div className="col-center">
                        {!student.adult ? (
                          <button
                            disabled={!session.behavior}
                            onClick={() => toggleSticker(student.id, "technique")}
                            className={`ghp-bubble ${session.technique ? "active-t" : ""}`}
                          >
                            T
                          </button>
                        ) : null}
                      </div>

                      <div className="col-view">
                        <button
                          onClick={() => setSelectedStudentId(student.id)}
                          className="ghp-btn ghp-btn-ghost ghp-btn-small"
                        >
                          View
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {visibleSummaries.length === 0 ? (
              <div className="ghp-sheet-empty">No students here yet.</div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="ghp-dash-card" style={{ marginBottom: "16px" }}>
            <div className="ghp-dash-card-header">
              <h2>Leaderboard</h2>
              <p>Top 5 most consistent students based on rolling 4-week performance.</p>
            </div>

            <div className="ghp-birthday-list">
              {leaderboard.map((student, index) => (
                <div key={student.id} className="ghp-birthday-row">
                  <div>
                    <div className="ghp-sheet-student">
                      {index + 1}. {student.name}
                    </div>
                    <div className="ghp-sheet-meta">
                      Attendance {student.attendanceScore}% • Behavior{" "}
                      {student.behaviorScore}%
                    </div>
                  </div>
                  <div className="ghp-birthday-age">{student.score}%</div>
                </div>
              ))}
            </div>
          </div>

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
                  <p>Edit dates, belt size, notes, and promotion status.</p>
                </div>

                <div className="ghp-profile-shell">
                  <BeltIcon
                    belt={selectedStudent.belt}
                    stripes={selectedStudent.stripes}
                    max={selectedStudent.stripeMax}
                    degree={selectedStudent.black_belt_degree}
                  />

                  {selectedStudent.behaviorRisk ? (
                    <div className="ghp-fast-track">
                      {selectedStudent.behaviorRisk}: {selectedStudent.sitOuts} sit-outs
                      this month.
                    </div>
                  ) : null}

                  {selectedStudent.fastTrackReview ? (
                    <div className="ghp-fast-track">
                      Fast Track Review: averaging{" "}
                      {selectedStudent.fastTrackAverage.toFixed(1)} classes/week over
                      the last 90 days.
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

                  <label className="ghp-field">
                    <span>Parent / Member Email</span>
                    <input
                      type="email"
                      value={selectedStudent.parent_email || ""}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          parent_email: e.target.value,
                        })
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
                            stripes: e.target.value === "Black" ? 0 : selectedStudent.stripes,
                            belt_awarded_at: today(),
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

                    {selectedStudent.blackBelt ? (
                      <label className="ghp-field">
                        <span>Black Belt Degree</span>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          value={selectedStudent.black_belt_degree || 0}
                          onChange={(e) =>
                            updateStudent(selectedStudent.id, {
                              black_belt_degree: Math.max(
                                0,
                                Math.min(9, Number(e.target.value))
                              ),
                            })
                          }
                        />
                      </label>
                    ) : (
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
                    )}
                  </div>

                  {selectedStudent.adult ? (
                    <>
                      <DateDropdown
                        label="Training Started"
                        value={selectedStudent.training_started_at}
                        years={dateYears}
                        onSave={(value) =>
                          updateStudent(selectedStudent.id, {
                            training_started_at: value,
                          })
                        }
                      />

                      {!selectedStudent.blackBelt ? (
                        <DateDropdown
                          label="Last Stripe Awarded"
                          value={selectedStudent.last_stripe_awarded_at}
                          years={dateYears}
                          onSave={(value) =>
                            updateStudent(selectedStudent.id, {
                              last_stripe_awarded_at: value,
                            })
                          }
                        />
                      ) : null}

                      <DateDropdown
                        label={
                          selectedStudent.blackBelt
                            ? "Current Degree Awarded"
                            : "Belt Promotion Date"
                        }
                        value={selectedStudent.belt_awarded_at}
                        years={dateYears}
                        onSave={(value) =>
                          updateStudent(selectedStudent.id, {
                            belt_awarded_at: value,
                          })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <DateDropdown
                        label="Training Started"
                        value={selectedStudent.kids_training_started_at}
                        years={dateYears}
                        onSave={(value) =>
                          updateStudent(selectedStudent.id, {
                            kids_training_started_at: value,
                          })
                        }
                      />

                      <DateDropdown
                        label="Last Belt Promotion"
                        value={selectedStudent.kids_last_belt_promotion_at}
                        years={dateYears}
                        onSave={(value) =>
                          updateStudent(selectedStudent.id, {
                            kids_last_belt_promotion_at: value,
                          })
                        }
                      />
                    </>
                  )}

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

                  <DateDropdown
                    label="Birthday"
                    value={selectedStudent.birthday}
                    years={dateYears}
                    onSave={(value) =>
                      updateStudent(selectedStudent.id, { birthday: value })
                    }
                  />

                  <label className="ghp-field">
                    <span>Roster</span>
                    <select
                      value={selectedStudent.roster || "Wildlings"}
                      onChange={(e) =>
                        updateStudent(selectedStudent.id, {
                          roster: e.target.value,
                          belt: "White",
                          stripes: 0,
                          belt_awarded_at:
                            e.target.value === "Adults" ? today() : null,
                          training_started_at:
                            e.target.value === "Adults" ? today() : null,
                          last_stripe_awarded_at: null,
                          black_belt_degree: 0,
                          kids_training_started_at:
                            e.target.value === "Adults" ? null : today(),
                          kids_last_belt_promotion_at:
                            e.target.value === "Adults" ? null : today(),
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
                      <span>Status</span>
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

                    <div className="ghp-stat">
                      <span>Monthly Class Count</span>
                      <strong>{selectedStudent.availableClasses}</strong>
                    </div>

                    {selectedStudent.adult ? (
                      <>
                        <div className="ghp-stat">
                          <span>Training Time</span>
                          <strong>{selectedStudent.trainingYears} yrs</strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Time at Grade</span>
                          <strong>
                            {selectedStudent.blackBelt
                              ? `${selectedStudent.yearsAtBelt}${
                                  selectedStudent.blackDegreeRequiredYears !== null
                                    ? `/${selectedStudent.blackDegreeRequiredYears} yrs`
                                    : " yrs"
                                }`
                              : `${selectedStudent.monthsAtBelt} / ${
                                  selectedStudent.requiredMonthsAtBelt || 0
                                } months`}
                          </strong>
                        </div>

                        {!selectedStudent.blackBelt ? (
                          <div className="ghp-stat">
                            <span>Total Skill Level</span>
                            <strong>{selectedStudent.skillAverage.toFixed(1)}/10</strong>
                          </div>
                        ) : null}

                        <div className="ghp-stat">
                          <span>90 Day Avg</span>
                          <strong>
                            {selectedStudent.fastTrackAverage.toFixed(1)} / wk
                          </strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ghp-stat">
                          <span>Final Tier</span>
                          <strong>{selectedStudent.finalTier}x</strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Projected Tier</span>
                          <strong>
                            {selectedStudent.projectedTier
                              ? `${selectedStudent.projectedTier}x`
                              : "—"}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>A / B / T</span>
                          <strong>
                            {selectedStudent.attendance} / {selectedStudent.behavior} /{" "}
                            {selectedStudent.technique}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>B / T Required</span>
                          <strong>
                            {selectedStudent.behaviorRequired} /{" "}
                            {selectedStudent.techniqueRequired}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Sit-Outs</span>
                          <strong>{selectedStudent.sitOuts}</strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Since Last Belt Promotion</span>
                          <strong>
                            {selectedStudent.kidsMonthsSinceLastPromotion} / 12 months
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

                  {selectedStudent.adult && !selectedStudent.blackBelt ? (
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

                    {!selectedStudent.blackBelt ? (
                      <button
                        onClick={() => awardStripe(selectedStudent.id)}
                        className="ghp-btn ghp-btn-primary"
                      >
                        Award Stripe
                      </button>
                    ) : (
                      <button
                        onClick={() => awardBlackBeltDegree(selectedStudent.id)}
                        className="ghp-btn ghp-btn-primary"
                      >
                        Award Degree
                      </button>
                    )}

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
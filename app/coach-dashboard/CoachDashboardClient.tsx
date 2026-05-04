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

const DEFAULT_ROSTERS = ["Wildlings", "Hunters", "Adults", "Stripe Queue", "Needs Attention", "Birthdays"];
const REAL_ROSTERS = ["Wildlings", "Hunters", "Adults"];

const MIN_ATTENDANCE = 8;

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateString: string) {
  return dateString.slice(0, 7);
}

function getPreviousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return date.toISOString().slice(0, 7);
}

function getNextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber, 1);
  return date.toISOString().slice(0, 7);
}

function countClassDaysInMonth(month: string, allowedDays: number[]) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  let count = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthNumber - 1, day);
    const weekday = date.getDay();

    if (allowedDays.includes(weekday)) count += 1;
  }

  return count;
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

  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years -= 1;
  return Math.max(years, 0);
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

function getProjectedTier(attendance: number, selectedDate: string): 2 | 3 | 4 | null {
  if (attendance < 8) return null;

  const date = new Date(selectedDate);
  const day = Math.max(date.getDate(), 1);
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const projected = (attendance / day) * daysInMonth;

  if (projected >= 14) return 4;
  if (projected >= 10) return 3;
  return 2;
}

function getKidSnapshotStatus(attendance: number, behavior: number, technique: number) {
  const finalTier = getFinalTier(attendance);
  const { behaviorRequired, techniqueRequired } = getRequiredForTier(finalTier);

  if (attendance < MIN_ATTENDANCE) {
    return {
      finalTier,
      behaviorRequired,
      techniqueRequired,
      status: "Not Eligible",
      eligible: false,
    };
  }

  if (behavior >= behaviorRequired && technique >= techniqueRequired) {
    return {
      finalTier,
      behaviorRequired,
      techniqueRequired,
      status: "Stripe Eligible (ABT Met)",
      eligible: true,
    };
  }

  const behaviorPct = behaviorRequired > 0 ? behavior / behaviorRequired : 0;
  const techniquePct = techniqueRequired > 0 ? technique / techniqueRequired : 0;
  const combined = (behaviorPct + techniquePct) / 2;

  if (combined >= 0.75) {
    return {
      finalTier,
      behaviorRequired,
      techniqueRequired,
      status: "Close",
      eligible: false,
    };
  }

  return {
    finalTier,
    behaviorRequired,
    techniqueRequired,
    status: "Not Eligible",
    eligible: false,
  };
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

  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function getDateParts(date?: string | null) {
  if (!date) return { month: "", day: "", year: "" };
  const [year, month, day] = date.split("-");
  return { month: month || "", day: day || "", year: year || "" };
}

function padDatePart(value: string | number) {
  return String(value).padStart(2, "0");
}

function getBirthdayThisMonth(birthday?: string | null, selectedDate?: string) {
  if (!birthday || !selectedDate) return false;
  const [, month] = birthday.split("-");
  const selectedMonth = selectedDate.slice(5, 7);
  return month === selectedMonth;
}

function getBirthdayInMonth(birthday?: string | null, monthKeyValue?: string) {
  if (!birthday || !monthKeyValue) return false;
  const [, month] = birthday.split("-");
  const selectedMonth = monthKeyValue.slice(5, 7);
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

function getYouthTimelineEstimate(startedAt?: string | null) {
  const monthsTrained = getMonthsSince(startedAt);
  const expectedBeltIndex = Math.min(
    Math.floor(monthsTrained / 12),
    KIDS_BELTS.length - 1
  );
  const expectedBelt = KIDS_BELTS[expectedBeltIndex];
  const expectedStripes = monthsTrained % 12;
  const expectedTotalStripeUnits = expectedBeltIndex * 12 + expectedStripes;

  return {
    monthsTrained,
    expectedBelt,
    expectedStripes,
    expectedTotalStripeUnits,
  };
}

function getYouthActualStripeUnits(student: Student) {
  const beltIndex = Math.max(KIDS_BELTS.indexOf(student.belt), 0);
  return beltIndex * 12 + Number(student.stripes || 0);
}

function getYouthPaceStatus(student: Student) {
  const estimate = getYouthTimelineEstimate(student.kids_training_started_at);
  const actualUnits = getYouthActualStripeUnits(student);
  const difference = actualUnits - estimate.expectedTotalStripeUnits;

  if (!student.kids_training_started_at) return "Missing Start Date";
  if (difference >= 3) return "Ahead";
  if (difference <= -3) return "Behind";
  return "On Pace";
}

function formatMonthsAsYearsMonths(months: number) {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years <= 0) return `${remainingMonths} mo`;
  if (remainingMonths === 0) return `${years} yr${years === 1 ? "" : "s"}`;

  return `${years} yr${years === 1 ? "" : "s"} ${remainingMonths} mo`;
}

function getAdultStripeIntervalMonths(belt: Belt) {
  const requiredMonths = getRequiredMonthsForAdultBelt(belt);
  if (!requiredMonths) return null;

  return requiredMonths / 4;
}

function getAdultTimelineEstimate(student: Student) {
  if (!isAdultStudent(student)) return null;

  if (student.belt === "Black") {
    const degree = Number(student.black_belt_degree || 0);
    const requiredYears = getBlackBeltNextDegreeYears(degree);
    const yearsInGrade = getYearsSince(student.belt_awarded_at);

    return {
      type: "black-belt" as const,
      expectedBelt: "Black" as Belt,
      expectedStripes: 0,
      expectedDegree: degree,
      requiredYears,
      yearsInGrade,
      monthsAtBelt: getMonthsSince(student.belt_awarded_at),
      stripeIntervalMonths: null as number | null,
      expectedTotalStripeUnits: ADULT_BELTS.indexOf("Black") * 4,
    };
  }

  const monthsAtBelt = getMonthsSince(student.belt_awarded_at);
  const requiredMonths = getRequiredMonthsForAdultBelt(student.belt);
  const stripeIntervalMonths = getAdultStripeIntervalMonths(student.belt);

  if (!requiredMonths || !stripeIntervalMonths) {
    return {
      type: "adult-belt" as const,
      expectedBelt: student.belt,
      expectedStripes: Number(student.stripes || 0),
      expectedDegree: null,
      requiredYears: null,
      yearsInGrade: getYearsSince(student.belt_awarded_at),
      monthsAtBelt,
      stripeIntervalMonths: null as number | null,
      expectedTotalStripeUnits:
        Math.max(ADULT_BELTS.indexOf(student.belt), 0) * 4 +
        Number(student.stripes || 0),
    };
  }

  const beltIndex = Math.max(ADULT_BELTS.indexOf(student.belt), 0);
  const expectedStripes = Math.min(Math.floor(monthsAtBelt / stripeIntervalMonths), 4);
  const expectedTotalStripeUnits = beltIndex * 4 + expectedStripes;

  return {
    type: "adult-belt" as const,
    expectedBelt: student.belt,
    expectedStripes,
    expectedDegree: null,
    requiredYears: null,
    yearsInGrade: getYearsSince(student.belt_awarded_at),
    monthsAtBelt,
    stripeIntervalMonths,
    expectedTotalStripeUnits,
  };
}

function getAdultActualStripeUnits(student: Student) {
  const beltIndex = Math.max(ADULT_BELTS.indexOf(student.belt), 0);
  return beltIndex * 4 + Number(student.stripes || 0);
}

function getAdultPaceStatus(student: Student) {
  if (!student.training_started_at || !student.belt_awarded_at) {
    return "Missing Dates";
  }

  if (student.belt === "Black") {
    const degree = Number(student.black_belt_degree || 0);
    const requiredYears = getBlackBeltNextDegreeYears(degree);
    const yearsInGrade = getYearsSince(student.belt_awarded_at);

    if (requiredYears === null) return "Highest Degree";
    if (yearsInGrade >= requiredYears) return "Degree Review";
    return "On Pace";
  }

  const estimate = getAdultTimelineEstimate(student);
  if (!estimate) return "Missing Dates";

  const actualUnits = getAdultActualStripeUnits(student);
  const difference = actualUnits - estimate.expectedTotalStripeUnits;

  if (difference >= 1) return "Ahead";
  if (difference <= -1) return "Behind";
  return "On Pace";
}

function getPromotionStatus(student: Student) {
  if (isAdultStudent(student)) {
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
      return "Eligible for next belt";
    }

    if (student.stripes >= max && requiredMonths && monthsAtBelt < requiredMonths) {
      return `Needs time at belt (${monthsAtBelt}/${requiredMonths} months)`;
    }

    return "Eligible for stripe review";
  }

  return student.stripes >= 12 ? "Coach Review" : "Stripe Progress";
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
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [monthLocked, setMonthLocked] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentBelt, setNewStudentBelt] = useState<Belt>("White");
  const [activeRoster, setActiveRoster] = useState<string>("Wildlings");
  const [customRosters, setCustomRosters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [message, setMessage] = useState("");

  const currentMonth = monthKey(selectedDate);
  const previousMonth = getPreviousMonth(currentMonth);
  const nextMonth = getNextMonth(currentMonth);

  const kidsAvailableClasses = countClassDaysInMonth(currentMonth, [1, 2, 3, 4]);
  const adultsAvailableClasses = countClassDaysInMonth(currentMonth, [1, 2, 3, 4, 5]);
  const previousMonthYouthClasses = countClassDaysInMonth(previousMonth, [1, 2, 3, 4]);
  const previousMonthAdultClasses = countClassDaysInMonth(previousMonth, [1, 2, 3, 4, 5]);

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
      supabase.from("monthly_settings").select("*").eq("month", currentMonth).maybeSingle(),
      supabase.from("monthly_snapshots").select("*").eq("month", currentMonth),
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
    setMonthlySnapshots((snapshotsResponse.data || []) as MonthlySnapshot[]);
    setMonthLocked(Boolean(monthlySettingsData?.locked));

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
    async function loadMonthData() {
      const [{ data: settings }, { data: snapshots }] = await Promise.all([
        supabase.from("monthly_settings").select("*").eq("month", currentMonth).maybeSingle(),
        supabase.from("monthly_snapshots").select("*").eq("month", currentMonth),
      ]);

      setMonthLocked(Boolean(settings?.locked));
      setMonthlySnapshots((snapshots || []) as MonthlySnapshot[]);
    }

    loadMonthData();
  }, [currentMonth, supabase]);

  const dateYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => String(currentYear - i));
  }, []);

  const allRosters = useMemo(() => {
    return Array.from(new Set([...DEFAULT_ROSTERS, ...customRosters]));
  }, [customRosters]);

  const rosterStudents = useMemo(() => {
    if (
      activeRoster === "Stripe Queue" ||
      activeRoster === "Needs Attention" ||
      activeRoster === "Birthdays"
    ) {
      return students;
    }

    return students.filter((s) => (s.roster || "Wildlings") === activeRoster);
  }, [students, activeRoster]);

  useEffect(() => {
    if (
      activeRoster === "Stripe Queue" ||
      activeRoster === "Needs Attention" ||
      activeRoster === "Birthdays"
    ) {
      setSelectedStudentId(null);
      return;
    }

    if (rosterStudents.length > 0) {
      const visible = rosterStudents.find((s) => s.id === selectedStudentId);
      if (!visible) setSelectedStudentId(rosterStudents[0].id);
    } else {
      setSelectedStudentId(null);
    }
  }, [activeRoster, rosterStudents, selectedStudentId]);

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

  const summaries = useMemo(() => {
    return students.map((student) => {
      const adult = isAdultStudent(student);
      const availableClasses = adult ? adultsAvailableClasses : kidsAvailableClasses;
      const blackBelt = adult && student.belt === "Black";
      const allStudentSessions = sessions.filter((s) => s.student_id === student.id);

      const monthSessions = allStudentSessions.filter(
        (s) => monthKey(s.date) === currentMonth
      );

      const attendance = monthSessions.filter((s) => s.attendance).length;
      const behavior = adult ? 0 : monthSessions.filter((s) => s.behavior).length;
      const technique = adult ? 0 : monthSessions.filter((s) => s.technique).length;
      const sitOuts = monthSessions.reduce(
        (sum, s) => sum + Number(s.sit_out_count || 0),
        0
      );

      const projectedTier = !adult ? getProjectedTier(attendance, selectedDate) : null;
      const kidStatus = !adult ? getKidSnapshotStatus(attendance, behavior, technique) : null;

      const fastTrackAverage = adult ? getFastTrackAverage(student.id) : 0;
      const fastTrackReview = adult && fastTrackAverage >= 4;

      const yearsAtBelt = getYearsSince(student.belt_awarded_at);
      const monthsAtBelt = getMonthsSince(student.belt_awarded_at);
      const requiredMonthsAtBelt =
        adult && !blackBelt ? getRequiredMonthsForAdultBelt(student.belt) : null;

      const adultTrainingMonths = getMonthsSince(student.training_started_at);
      const adultTimelineEstimate = adult ? getAdultTimelineEstimate(student) : null;
      const adultPaceStatus = adult ? getAdultPaceStatus(student) : null;
      const adultActualStripeUnits = adult ? getAdultActualStripeUnits(student) : 0;
      const adultExpectedStripeUnits = adultTimelineEstimate?.expectedTotalStripeUnits || 0;
      const adultTimelineDifference = adultActualStripeUnits - adultExpectedStripeUnits;

      const trainingYears = getYearsSince(student.training_started_at);
      const yearsSinceLastStripe = getYearsSince(student.last_stripe_awarded_at);

      const kidsTrainingYears = getYearsSince(student.kids_training_started_at);
      const kidsTrainingMonths = getMonthsSince(student.kids_training_started_at);
      const kidsMonthsSinceLastPromotion = getMonthsSince(
        student.kids_last_belt_promotion_at
      );
      const youthTimelineEstimate = !adult
        ? getYouthTimelineEstimate(student.kids_training_started_at)
        : null;
      const youthPaceStatus = !adult ? getYouthPaceStatus(student) : null;
      const youthActualStripeUnits = !adult ? getYouthActualStripeUnits(student) : 0;
      const youthExpectedStripeUnits = youthTimelineEstimate?.expectedTotalStripeUnits || 0;
      const youthTimelineDifference = youthActualStripeUnits - youthExpectedStripeUnits;

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

      const eligible = adult
        ? fastTrackReview || adultNextBeltEligible || blackDegreeEligible
        : Boolean(kidStatus?.eligible);

      const attendanceProgress =
        availableClasses > 0 ? Math.min((attendance / availableClasses) * 100, 100) : 0;

      const behaviorProgress =
        kidStatus && kidStatus.behaviorRequired > 0
          ? Math.min((behavior / kidStatus.behaviorRequired) * 100, 100)
          : 0;

      const techniqueProgress =
        kidStatus && kidStatus.techniqueRequired > 0
          ? Math.min((technique / kidStatus.techniqueRequired) * 100, 100)
          : 0;

      const skillAverage =
        adult && !blackBelt ? getSkillAverage(student.adult_skill_ratings) : 0;

      const snapshot = monthlySnapshots.find((s) => s.student_id === student.id);

      return {
        ...student,
        adult,
        blackBelt,
        availableClasses,
        attendance,
        behavior,
        technique,
        sitOuts,
        eligible,
        fastTrackReview,
        fastTrackAverage,
        streak: getCurrentStreak(allStudentSessions),
        careerStickers: getCareerStickerTotal(student.id),
        attendanceProgress,
        behaviorProgress,
        techniqueProgress,
        age: getAge(student.birthday),
        promotionStatus: getPromotionStatus(student),
        stripeMax: getStripeMax(student),
        yearsAtBelt,
        monthsAtBelt,
        requiredMonthsAtBelt,
        adultTrainingMonths,
        adultTimelineEstimate,
        adultPaceStatus,
        adultActualStripeUnits,
        adultExpectedStripeUnits,
        adultTimelineDifference,
        trainingYears,
        yearsSinceLastStripe,
        kidsTrainingYears,
        kidsTrainingMonths,
        kidsMonthsSinceLastPromotion,
        youthTimelineEstimate,
        youthPaceStatus,
        youthActualStripeUnits,
        youthExpectedStripeUnits,
        youthTimelineDifference,
        skillAverage,
        blackDegree,
        blackDegreeRequiredYears,
        blackDegreeEligible,
        projectedTier,
        kidStatus,
        behaviorRisk: sitOuts >= 3,
        highBehaviorRisk: sitOuts >= 5,
        snapshot,
      };
    });
  }, [
    students,
    sessions,
    currentMonth,
    selectedDate,
    kidsAvailableClasses,
    adultsAvailableClasses,
    monthlySnapshots,
  ]);

  const visibleSummaries = summaries
    .filter((s) => {
      if (activeRoster === "Stripe Queue") {
        return !s.adult && s.snapshot?.eligible && s.snapshot.coach_decision === "Pending";
      }

      if (activeRoster === "Needs Attention") {
        return !s.adult && Boolean(s.snapshot) && !s.snapshot?.eligible;
      }

      if (activeRoster === "Birthdays") {
        return false;
      }

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

  const upcomingBirthdayStudents = summaries
    .filter((student) => getBirthdayInMonth(student.birthday, nextMonth))
    .sort((a, b) => {
      const dayA = a.birthday ? Number(a.birthday.split("-")[2]) : 0;
      const dayB = b.birthday ? Number(b.birthday.split("-")[2]) : 0;
      return dayA - dayB;
    });

  const missingBirthdayStudents = summaries
    .filter((student) => !student.birthday)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedStudent =
    activeRoster === "Stripe Queue" ||
    activeRoster === "Needs Attention" ||
    activeRoster === "Birthdays"
      ? null
      : summaries.find((s) => s.id === selectedStudentId) || null;

  const classLeaderboard = useMemo(() => {
    if (activeRoster !== "Wildlings" && activeRoster !== "Hunters") return [];

    return students
      .filter((student) => (student.roster || "Wildlings") === activeRoster)
      .map((student) => {
        const monthSessions = sessions.filter(
          (s) => s.student_id === student.id && monthKey(s.date) === previousMonth
        );

        const attendance = monthSessions.filter((s) => s.attendance).length;
        const behavior = monthSessions.filter((s) => s.behavior).length;
        const technique = monthSessions.filter((s) => s.technique).length;

        const attendancePct =
          previousMonthYouthClasses > 0
            ? Math.min((attendance / previousMonthYouthClasses) * 100, 100)
            : 0;

        const behaviorPct = attendance > 0 ? (behavior / attendance) * 100 : 0;
        const techniquePct = attendance > 0 ? (technique / attendance) * 100 : 0;

        const score = Math.round((attendancePct + behaviorPct + techniquePct) / 3);

        return {
          id: student.id,
          name: student.name,
          attendance,
          behavior,
          technique,
          score,
        };
      })
      .filter((s) => s.attendance > 0)
      .sort((a, b) => b.score - a.score || b.attendance - a.attendance)
      .slice(0, 5);
  }, [activeRoster, students, sessions, previousMonth, previousMonthYouthClasses]);

  const adultLeaderboard = useMemo(() => {
    return students
      .filter((student) => isAdultStudent(student))
      .map((student) => {
        const monthSessions = sessions.filter(
          (s) => s.student_id === student.id && monthKey(s.date) === previousMonth
        );

        const attendance = monthSessions.filter((s) => s.attendance).length;

        const attendancePct =
          previousMonthAdultClasses > 0
            ? Math.min((attendance / previousMonthAdultClasses) * 100, 100)
            : 0;

        return {
          id: student.id,
          name: student.name,
          attendance,
          attendancePct: Math.round(attendancePct),
        };
      })
      .filter((s) => s.attendance > 0)
      .sort((a, b) => b.attendance - a.attendance || b.attendancePct - a.attendancePct)
      .slice(0, 5);
  }, [students, sessions, previousMonth, previousMonthAdultClasses]);

  function getNeedsAttentionReason(snapshot?: MonthlySnapshot) {
    if (!snapshot) return "No monthly snapshot";
    const reasons: string[] = [];

    if (snapshot.attendance_count < MIN_ATTENDANCE) {
      reasons.push("Not Enough Classes");
    }

    if (snapshot.behavior_count < snapshot.behavior_required) {
      reasons.push("Behavior Below Standard");
    }

    if (snapshot.technique_count < snapshot.technique_required) {
      reasons.push("Technique Below Standard");
    }

    return reasons.length > 0 ? reasons.join(" + ") : "Needs Coach Review";
  }

  async function calculateMonthlySnapshots() {
    setMessage("Calculating month...");

    const rows = summaries
      .filter((student) => !student.adult)
      .map((student) => {
        const status = getKidSnapshotStatus(
          student.attendance,
          student.behavior,
          student.technique
        );

        return {
          student_id: student.id,
          month: currentMonth,
          attendance_count: student.attendance,
          behavior_count: student.behavior,
          technique_count: student.technique,
          sit_out_count: student.sitOuts,
          final_tier: status.finalTier,
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

    setMessage("Month calculated. Stripe Queue updated.");
    await loadDashboardData();
  }

  async function lockMonth() {
    const ok = window.confirm("Lock this month? Sessions cannot be edited after this.");
    if (!ok) return;

    const { error } = await supabase
      .from("monthly_settings")
      .upsert(
        {
          month: currentMonth,
          locked: true,
          locked_at: new Date().toISOString(),
          available_classes: kidsAvailableClasses,
          kids_available_classes: kidsAvailableClasses,
          adults_available_classes: adultsAvailableClasses,
        },
        { onConflict: "month" }
      );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMonthLocked(true);
    setMessage("Month locked.");
  }

  async function approveSnapshot(studentId: string) {
    const { error } = await supabase
      .from("monthly_snapshots")
      .update({ coach_decision: "Approved", deny_reason: null })
      .eq("student_id", studentId)
      .eq("month", currentMonth);

    if (error) {
      setMessage(error.message);
      return;
    }

    await awardStripe(studentId, true);
    await loadDashboardData();
  }

  async function denySnapshot(studentId: string) {
    const reason =
      prompt(
        "Deny reason: Needs more time, Behavior inconsistency, Technical understanding, or Other"
      ) || "Other";

    const { error } = await supabase
      .from("monthly_snapshots")
      .update({ coach_decision: "Denied", deny_reason: reason })
      .eq("student_id", studentId)
      .eq("month", currentMonth);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Stripe denied.");
    await loadDashboardData();
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
      alert("This month is locked. Sessions cannot be edited.");
      return;
    }

    if (nextSession.sit_out_count && nextSession.sit_out_count >= 1) {
      nextSession.behavior = false;
      nextSession.technique = false;
    }

    if (nextSession.sit_out_count && nextSession.sit_out_count >= 2) {
      nextSession.attendance = false;
      nextSession.behavior = false;
      nextSession.technique = false;
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

  async function cycleSitOut(studentId: string) {
    const session = getSession(studentId, selectedDate);
    const current = Number(session.sit_out_count || 0);
    const nextCount = current >= 2 ? 0 : current + 1;

    const nextSession: Session = {
      ...session,
      sit_out_count: nextCount,
    };

    if (nextCount === 0) {
      nextSession.attendance = session.attendance;
      nextSession.behavior = false;
      nextSession.technique = false;
      nextSession.sit_out_count = 0;
    }

    if (nextCount === 1) {
      nextSession.attendance = true;
      nextSession.behavior = false;
      nextSession.technique = false;
    }

    if (nextCount >= 2) {
      nextSession.attendance = false;
      nextSession.behavior = false;
      nextSession.technique = false;
    }

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

  async function awardStripe(studentId: string, skipEligibilityCheck = false) {
    const student = summaries.find((s) => s.id === studentId);
    if (!student) return;

    if (!skipEligibilityCheck && !student.eligible && !student.fastTrackReview) {
      alert("This student is not eligible for a stripe review yet.");
      return;
    }

    await updateStudent(studentId, {
      stripes: Math.min(student.stripes + 1, getStripeMax(student)),
      last_stripe_awarded_at: today(),
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
            Track ABT, calculate month-end stripes, and manage student profiles.
          </p>
        </div>

        <div className="ghp-brand-chip">
          <div className="ghp-brand-chip-mark">GH</div>
          <div>
            <div className="ghp-brand-chip-title">
              {monthLocked ? "Month Locked" : "Month Open"}
            </div>
            <div className="ghp-brand-chip-sub">{currentMonth}</div>
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
          <span>{activeRoster === "Stripe Queue" ? "Review Month" : "Class Date"}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>

        <div className="ghp-mini-stat">
          <span>Youth Classes</span>
          <strong>{kidsAvailableClasses}</strong>
        </div>

        <div className="ghp-mini-stat">
          <span>Adult Classes</span>
          <strong>{adultsAvailableClasses}</strong>
        </div>

        {activeRoster === "Stripe Queue" ? (
          <>
            <button onClick={calculateMonthlySnapshots} className="ghp-btn ghp-btn-primary">
              Calculate Month
            </button>

            <button onClick={lockMonth} className="ghp-btn ghp-btn-danger">
              Lock Month
            </button>
          </>
        ) : activeRoster === "Needs Attention" || activeRoster === "Birthdays" ? null : (
          <button
            type="button"
            className="ghp-btn ghp-btn-ghost"
            onClick={() => {
              const form = document.getElementById("ghp-add-student-form");
              form?.classList.toggle("ghp-hidden");
            }}
          >
            + Add Student
          </button>
        )}

        {activeRoster !== "Stripe Queue" &&
        activeRoster !== "Needs Attention" &&
        activeRoster !== "Birthdays" ? (
          <div id="ghp-add-student-form" className="ghp-add-student-panel ghp-hidden">
            <label className="ghp-field ghp-field-wide">
              <span>Student Name</span>
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder={`Add a student to ${activeRoster}`}
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
              Save Student
            </button>
          </div>
        ) : null}
      </section>

      <section className="ghp-dash-grid">
        <div className="ghp-dash-card">
          <div className="ghp-dash-card-header">
            <h2>{activeRoster} Roster</h2>
            <p>
              {activeRoster === "Stripe Queue"
                ? "Students who met ABT and need approval or denial."
                : activeRoster === "Needs Attention"
                ? "Students who did not meet the monthly ABT requirements."
                : activeRoster === "Birthdays"
                ? "Birthday list for the selected month, next month, and missing birthdays."
                : activeRoster === "Adults"
                ? "Adults use attendance only and adult criteria."
                : "Kids use A / B / T / S and month-end stripe calculation."}
            </p>
          </div>

          <div className="ghp-sheet">
            {activeRoster === "Birthdays" ? (
              <div style={{ padding: "18px", display: "grid", gap: "22px" }}>
                <div>
                  <div className="ghp-dash-card-header">
                    <h2>This Month</h2>
                    <p>Birthdays during the selected month.</p>
                  </div>

                  <div className="ghp-birthday-list">
                    {birthdayStudents.length > 0 ? (
                      birthdayStudents.map((student) => (
                        <div key={student.id} className="ghp-birthday-row">
                          <div>
                            <div className="ghp-sheet-student">{student.name}</div>
                            <div className="ghp-sheet-meta">
                              {student.roster || "Wildlings"} • {formatBirthdayMD(student.birthday)}
                            </div>
                          </div>

                          <div className="ghp-birthday-age">
                            Turns {getUpcomingAge(student.birthday, selectedDate)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="ghp-sheet-empty">No birthdays this month.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="ghp-dash-card-header">
                    <h2>Next Month</h2>
                    <p>Upcoming birthdays for the next calendar month.</p>
                  </div>

                  <div className="ghp-birthday-list">
                    {upcomingBirthdayStudents.length > 0 ? (
                      upcomingBirthdayStudents.map((student) => (
                        <div key={student.id} className="ghp-birthday-row">
                          <div>
                            <div className="ghp-sheet-student">{student.name}</div>
                            <div className="ghp-sheet-meta">
                              {student.roster || "Wildlings"} • {formatBirthdayMD(student.birthday)}
                            </div>
                          </div>

                          <div className="ghp-birthday-age">Next Month</div>
                        </div>
                      ))
                    ) : (
                      <div className="ghp-sheet-empty">No birthdays next month.</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="ghp-dash-card-header">
                    <h2>Missing Birthdays</h2>
                    <p>Students who still need a birthday added to their profile.</p>
                  </div>

                  <div className="ghp-birthday-list">
                    {missingBirthdayStudents.length > 0 ? (
                      missingBirthdayStudents.map((student) => (
                        <div key={student.id} className="ghp-birthday-row">
                          <div>
                            <div className="ghp-sheet-student">{student.name}</div>
                            <div className="ghp-sheet-meta">{student.roster || "Wildlings"}</div>
                          </div>

                          <div className="ghp-birthday-age">Missing</div>
                        </div>
                      ))
                    ) : (
                      <div className="ghp-sheet-empty">No missing birthdays.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {visibleSummaries.map((student) => {
              const session = getSession(student.id, selectedDate);
              const isQueue = activeRoster === "Stripe Queue";
              const isNeedsAttention = activeRoster === "Needs Attention";
              const isReview = isQueue || isNeedsAttention;

              return (
                <div
                  className="ghp-sheet-row"
                  key={student.id}
                  style={
                    isReview
                      ? { gridTemplateColumns: "minmax(180px, 1fr) 380px" }
                      : {
                          gridTemplateColumns:
                            "minmax(180px, 1fr) 72px 72px 72px 72px 92px",
                        }
                  }
                >
                  <div className="col-name">
                    <div className="ghp-sheet-student">
                      {student.name}{" "}
                      {student.behaviorRisk ? (
                        <span style={{ color: "#9a3412" }}>⚠ Behavior Risk</span>
                      ) : null}
                    </div>

                    <div className="ghp-sheet-meta">
                      {student.belt}
                      {student.blackBelt
                        ? ` • ${student.blackDegree} degree`
                        : ` • ${student.stripes}/${student.stripeMax} stripes`}
                      {student.age !== null ? ` • ${student.age} yrs` : ""}
                      {!student.adult && student.projectedTier
                        ? ` • Projected ${student.projectedTier}x`
                        : ""}
                      {!student.adult && student.kidStatus
                        ? ` • ${student.kidStatus.status}`
                        : ""}
                      {isQueue && student.snapshot
                        ? ` • ${student.snapshot.behavior_count}/${student.snapshot.behavior_required} B • ${student.snapshot.technique_count}/${student.snapshot.technique_required} T`
                        : ""}
                      {isNeedsAttention && student.snapshot
                        ? ` • ${getNeedsAttentionReason(student.snapshot)} • A ${student.snapshot.attendance_count}/8 • B ${student.snapshot.behavior_count}/${student.snapshot.behavior_required} • T ${student.snapshot.technique_count}/${student.snapshot.technique_required}`
                        : ""}
                    </div>
                  </div>

                  {isReview ? (
                    <div
                      className="col-view"
                      style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
                    >
                      {isQueue ? (
                        <>
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
                        </>
                      ) : (
                        <strong className="ghp-gold">
                          {getNeedsAttentionReason(student.snapshot)}
                        </strong>
                      )}
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

                      <div className="col-center">
                        {!student.adult ? (
                          <button
                            onClick={() => cycleSitOut(student.id)}
                            className={`ghp-bubble ${
                              Number(session.sit_out_count || 0) > 0 ? "active-s" : ""
                            }`}
                            title="Tap to cycle sit-outs: S → S1 → S2 → S"
                          >
                            {Number(session.sit_out_count || 0) > 0
                              ? `S${session.sit_out_count}`
                              : "S"}
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
              </>
            )}

            {activeRoster !== "Birthdays" && visibleSummaries.length === 0 ? (
              <div className="ghp-sheet-empty">
                {activeRoster === "Needs Attention"
                  ? "No students need attention for this month."
                  : "No students here yet."}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          {activeRoster === "Wildlings" || activeRoster === "Hunters" || activeRoster === "Adults" ? (
            <div className="ghp-dash-card" style={{ marginBottom: "16px" }}>
              <div className="ghp-dash-card-header">
                <h2>
                  {activeRoster === "Adults"
                    ? `Adult Attendance Leaders (${previousMonth})`
                    : `${activeRoster} Leaders (${previousMonth})`}
                </h2>
                <p>
                  {activeRoster === "Adults"
                    ? "Previous month adult leaderboard based on attendance."
                    : `Previous month ${activeRoster} leaderboard based on attendance, behavior, and technique.`}
                </p>
              </div>

              <div className="ghp-birthday-list">
                {activeRoster === "Adults"
                  ? adultLeaderboard.map((student, index) => (
                      <div key={student.id} className="ghp-birthday-row">
                        <div>
                          <div className="ghp-sheet-student">
                            {index + 1}. {student.name}
                          </div>
                          <div className="ghp-sheet-meta">
                            Attendance {student.attendance}/{previousMonthAdultClasses}
                          </div>
                        </div>
                        <div className="ghp-birthday-age">{student.attendancePct}%</div>
                      </div>
                    ))
                  : classLeaderboard.map((student, index) => (
                      <div key={student.id} className="ghp-birthday-row">
                        <div>
                          <div className="ghp-sheet-student">
                            {index + 1}. {student.name}
                          </div>
                          <div className="ghp-sheet-meta">
                            A/B/T {student.attendance}/{student.behavior}/{student.technique}
                          </div>
                        </div>
                        <div className="ghp-birthday-age">{student.score}%</div>
                      </div>
                    ))}

                {activeRoster === "Adults" && adultLeaderboard.length === 0 ? (
                  <div className="ghp-sheet-empty">No adult attendance yet for {previousMonth}.</div>
                ) : null}

                {activeRoster !== "Adults" && classLeaderboard.length === 0 ? (
                  <div className="ghp-sheet-empty">No {activeRoster} attendance yet for {previousMonth}.</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeRoster === "Stripe Queue" || activeRoster === "Needs Attention" || activeRoster === "Birthdays" ? (
            <div className="ghp-dash-card">
              <div className="ghp-dash-card-header">
                <h2>
                  {activeRoster === "Birthdays"
                    ? "Birthday Center"
                    : activeRoster === "Needs Attention"
                    ? "Needs Attention"
                    : "Month-End Review"}
                </h2>
                <p>
                  {activeRoster === "Birthdays"
                    ? "Birthday tracking is separated from daily class tracking."
                    : activeRoster === "Needs Attention"
                    ? "This screen shows kids who did not meet monthly ABT requirements."
                    : "This screen is only for kid stripe decisions. Adult profiles and daily tracking are hidden here so the queue stays clean."}
                </p>
              </div>

              <div className="ghp-stat-grid">
                <div className="ghp-stat">
                  <span>Review Month</span>
                  <strong>{currentMonth}</strong>
                </div>

                <div className="ghp-stat">
                  <span>
                    {activeRoster === "Needs Attention"
                      ? "Needs Attention"
                      : activeRoster === "Birthdays"
                      ? "This Month"
                      : "Pending Stripes"}
                  </span>
                  <strong>
                    {activeRoster === "Birthdays"
                      ? birthdayStudents.length
                      : visibleSummaries.length}
                  </strong>
                </div>

                <div className="ghp-stat">
                  <span>
                    {activeRoster === "Birthdays" ? "Missing Birthdays" : "Youth Classes"}
                  </span>
                  <strong>
                    {activeRoster === "Birthdays"
                      ? missingBirthdayStudents.length
                      : kidsAvailableClasses}
                  </strong>
                </div>

                <div className="ghp-stat">
                  <span>Status</span>
                  <strong>{monthLocked ? "Locked" : "Open"}</strong>
                </div>
              </div>
            </div>
          ) : (
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
                          belt_awarded_at: e.target.value === "Adults" ? today() : null,
                          training_started_at: e.target.value === "Adults" ? today() : null,
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

                    {!selectedStudent.adult ? (
                      <div className="ghp-stat">
                      <span>Behavior Failures</span>
                      <strong>{selectedStudent.sitOuts}</strong>
                    </div>
                    ) : null}

                    {!selectedStudent.adult ? (
                      <>
                        <div className="ghp-stat">
                          <span>Projected Tier</span>
                          <strong>
                            {selectedStudent.projectedTier
                              ? `${selectedStudent.projectedTier}x`
                              : "—"}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Month Status</span>
                          <strong>{selectedStudent.kidStatus?.status || "—"}</strong>
                        </div>

                        <div className="ghp-stat">
                          <span>A / B / T</span>
                          <strong>
                            {selectedStudent.attendance} / {selectedStudent.behavior} /{" "}
                            {selectedStudent.technique}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Since Last Belt Promotion</span>
                          <strong>
                            {selectedStudent.kidsMonthsSinceLastPromotion} / 12 months
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Training Time</span>
                          <strong>
                            {formatMonthsAsYearsMonths(selectedStudent.kidsTrainingMonths || 0)}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Expected Progress</span>
                          <strong>
                            {selectedStudent.youthTimelineEstimate
                              ? `${selectedStudent.youthTimelineEstimate.expectedBelt} • ${selectedStudent.youthTimelineEstimate.expectedStripes}/12`
                              : "—"}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Timeline Status</span>
                          <strong
                            className={
                              selectedStudent.youthPaceStatus === "Behind"
                                ? "ghp-gold"
                                : selectedStudent.youthPaceStatus === "Ahead"
                                ? "ghp-green"
                                : ""
                            }
                          >
                            {selectedStudent.youthPaceStatus || "—"}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Actual vs Expected</span>
                          <strong>
                            {selectedStudent.youthTimelineDifference > 0 ? "+" : ""}
                            {selectedStudent.youthTimelineDifference || 0} stripes
                          </strong>
                        </div>
                      </>
                    ) : (
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

                        <div className="ghp-stat">
                          <span>Training Time</span>
                          <strong>
                            {formatMonthsAsYearsMonths(selectedStudent.adultTrainingMonths || 0)}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Expected Progress</span>
                          <strong>
                            {selectedStudent.blackBelt
                              ? selectedStudent.adultTimelineEstimate?.requiredYears !== null
                                ? `${selectedStudent.blackDegree} → ${
                                    Number(selectedStudent.blackDegree || 0) + 1
                                  } degree`
                                : "Highest Degree"
                              : selectedStudent.adultTimelineEstimate
                              ? `${selectedStudent.adultTimelineEstimate.expectedBelt} • ${selectedStudent.adultTimelineEstimate.expectedStripes}/4`
                              : "—"}
                          </strong>
                        </div>

                        <div className="ghp-stat">
                          <span>Timeline Status</span>
                          <strong
                            className={
                              selectedStudent.adultPaceStatus === "Behind"
                                ? "ghp-gold"
                                : selectedStudent.adultPaceStatus === "Ahead" ||
                                  selectedStudent.adultPaceStatus === "Degree Review"
                                ? "ghp-green"
                                : ""
                            }
                          >
                            {selectedStudent.adultPaceStatus || "—"}
                          </strong>
                        </div>

                        {!selectedStudent.blackBelt ? (
                          <div className="ghp-stat">
                            <span>Actual vs Expected</span>
                            <strong>
                              {selectedStudent.adultTimelineDifference > 0 ? "+" : ""}
                              {selectedStudent.adultTimelineDifference || 0} stripes
                            </strong>
                          </div>
                        ) : null}

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
                    )}
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
          )}
        </div>
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CoachDashboardClient from "./CoachDashboardClient";

export default async function CoachDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/coach-login");
  }

  return <CoachDashboardClient />;
}
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteCoachClient from "./InviteCoachClient";

export default async function InviteCoachPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/coach-login");
  }

  const role = user.user_metadata?.role;

  if (role !== "coach") {
    redirect("/");
  }

  return <InviteCoachClient />;
}
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim();
    const password = body?.password?.trim();
    const firstName = body?.firstName?.trim() || "";
    const lastName = body?.lastName?.trim() || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "coach",
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Coach created successfully.",
      user: data.user,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong creating the coach." },
      { status: 500 }
    );
  }
}
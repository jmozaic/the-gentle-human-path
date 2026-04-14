import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://the-gentle-human-path-7a6i.vercel.app/coach-login",
      data: {
        role: "coach",
      },
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Coach invite sent.",
      user: data.user,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Something went wrong sending the invite.",
      },
      { status: 500 }
    );
  }
}
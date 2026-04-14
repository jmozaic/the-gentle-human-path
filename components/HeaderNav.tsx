"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type UserRole = "parent" | "coach" | null;

export default function HeaderNav() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setLoggedIn(!!user);
      setRole((user?.user_metadata?.role as UserRole) || null);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setLoggedIn(!!user);
      setRole((user?.user_metadata?.role as UserRole) || null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (loading) {
    return <nav className="main-nav" />;
  }

  if (!loggedIn) {
    return (
      <nav className="main-nav">
        <Link href="/">Home</Link>
        <Link href="/parent-signup">Parent Signup</Link>
        <Link href="/parent-login">Parent Login</Link>
        <Link href="/coach-login">Coach Login</Link>
      </nav>
    );
  }

  if (role === "parent") {
    return (
      <nav className="main-nav">
        <Link href="/">Home</Link>
        <Link href="/parent-portal">Parent Portal</Link>
      </nav>
    );
  }

  return (
    <nav className="main-nav">
      <Link href="/">Home</Link>
      <Link href="/coach-dashboard">Coach Dashboard</Link>
    </nav>
  );
}
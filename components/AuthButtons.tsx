"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AuthButtons() {
  const supabase = createClient();
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (mounted) {
        setLoggedIn(!!user);
        setLoading(false);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="auth-buttons" />;
  }

  if (!loggedIn) {
    return null;
  }

  return (
    <div className="auth-buttons">
      <button onClick={handleLogout} className="ghp-btn ghp-btn-primary ghp-btn-small">
        Log Out
      </button>
    </div>
  );
}
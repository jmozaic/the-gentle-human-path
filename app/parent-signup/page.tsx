"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ParentSignupPage() {
  const supabase = createClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("Creating account...");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "parent",
          first_name: firstName,
          last_name: lastName,
          phone,
          student_name: studentName,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Account created. Check your email for confirmation.");
    setLoading(false);
  }

  return (
    <main className="ghp-auth-page">
      <section className="ghp-auth-shell">
        <div className="ghp-auth-copy">
          <p className="ghp-kicker">Parent Signup</p>
          <h1>Create your place on The Gentle Human Path.</h1>
          <p>
            Sign up to follow your child’s progress, receive coach updates, and
            stay connected to the academy.
          </p>
        </div>

        <div className="ghp-auth-card">
          <div className="ghp-auth-card-title">Create Parent Account</div>

          <form className="ghp-auth-grid" onSubmit={handleSignup}>
            <label className="ghp-field">
              <span>First Name</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
              />
            </label>

            <label className="ghp-field">
              <span>Last Name</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
              />
            </label>

            <label className="ghp-field ghp-field-wide">
              <span>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </label>

            <label className="ghp-field">
              <span>Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </label>

            <label className="ghp-field">
              <span>Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="text"
              />
            </label>

            <label className="ghp-field ghp-field-wide">
              <span>Student Name</span>
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                type="text"
              />
            </label>

            <div className="ghp-auth-actions ghp-field-wide">
              <button
                type="submit"
                className="ghp-btn ghp-btn-primary"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>

          {message && <p style={{ marginTop: 16 }}>{message}</p>}
        </div>
      </section>
    </main>
  );
}
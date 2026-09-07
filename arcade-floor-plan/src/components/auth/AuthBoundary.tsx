"use client";
import { useState, type ReactNode } from "react";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const required = process.env.NEXT_PUBLIC_AUTH_REQUIRED === "true";
  const [signedIn, setSignedIn] = useState(!required);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  if (signedIn) return <>{children}</>;
  return <main className="auth-screen"><form className="auth-card" onSubmit={(event) => { event.preventDefault(); if (!email.trim() || !password) { setError("Enter your company email and password."); return; } setError("Authentication is not configured. Connect Supabase Auth before enabling NEXT_PUBLIC_AUTH_REQUIRED."); }}><div className="brand-mark">K</div><h1>Arcade Floor Plan</h1><p>Internal company workspace</p><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <small className="auth-error">{error}</small> : null}<button className="primary-action" type="submit">Sign in</button></form></main>;
}

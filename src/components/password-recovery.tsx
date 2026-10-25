"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState, type FormEvent } from "react";

export default function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? createClient(url, key, {
      auth: { detectSessionInUrl: false, flowType: "pkce", storageKey: "ccldl-password-recovery" },
    }) : null;
  });

  useEffect(() => {
    if (!reset || started.current) return;
    started.current = true;
    async function verify() {
      if (!client) return;
      setBusy(true);
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(url.hash.slice(1));
      // Remove credentials from the address bar, including failed/expired links.
      window.history.replaceState(null, "", url.pathname);
      try {
        let success = false;
        if (!url.searchParams.has("error") && !hash.has("error")) {
          if (code) {
            const { data, error } = await client.auth.exchangeCodeForSession(code);
            success = !error && !!data.session;
          } else if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
            const { data, error } = await client.auth.setSession({
              access_token: hash.get("access_token")!,
              refresh_token: hash.get("refresh_token")!,
            });
            success = !error && !!data.session;
          }
        }
        setValid(success);
        if (!success) setMessage("This reset link is missing, expired or already used. Request a new link and open it in the same browser where you requested it.");
      } catch {
        setMessage("We couldn’t check your reset link. Please request a new one and try again.");
      } finally { setBusy(false); }
    }
    void verify();
  }, [client, reset]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    if (reset && (!valid || password !== confirm)) {
      setMessage("The passwords don’t match. Please enter the same password twice.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (reset) {
        const { error } = await client.auth.updateUser({ password });
        if (error) { setMessage(error.message); return; }
        setPassword("");
        setConfirm("");
        await client.auth.signOut({ scope: "local" });
        setDone(true);
        setMessage("Your password has been changed. You can now sign in with your new password.");
      } else {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          setMessage("We couldn’t send a reset email just now. Please wait a minute and try again. If this continues, contact the league administrator.");
          return;
        }
        setDone(true);
        setMessage("If this email belongs to an account, a password reset link is on its way. Check your inbox and junk folder. Open the link in this same browser.");
      }
    } catch {
      setMessage("There was a connection problem. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="login">
    <h1>{reset ? "Choose a new password" : "Forgot your password?"}</h1>
    <p className="muted">Chelmsford City Ladies Darts League</p>
    <div className="card">
      {!client ? <p role="alert">Password recovery is unavailable until the website’s sign-in service is configured.</p> : <>
        {!done && (!reset || valid) && <form onSubmit={submit}>
          {reset ? <>
            <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
            <p className="muted">Use at least 8 characters.</p>
            <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
          </> : <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
          <button className="primary" disabled={busy}>{busy ? "Please wait…" : reset ? "Save new password" : "Send reset link"}</button>
        </form>}
        {reset && busy && !valid && <p role="status">Checking your reset link…</p>}
        {message && <p className="notice" role="status">{message}</p>}
        {reset && !valid && !busy && <p><a href="/forgot-password">Request a new reset link</a></p>}
      </>}
      <p><a href="/">Back to sign in</a></p>
    </div>
  </main>;
}

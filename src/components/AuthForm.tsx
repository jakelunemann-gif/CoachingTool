"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logIn, signUp, type AuthFormState } from "@/app/actions";

export function AuthForm({ mode, next, needsCode }: { mode: "login" | "signup"; next?: string; needsCode?: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "login" ? logIn : signUp, {});
  const signup = mode === "signup";
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form action={action} className="card mx-auto max-w-sm space-y-4 p-6">
      <h1 className="h1">{signup ? "Create your coach account" : "Log in"}</h1>
      <input type="hidden" name="next" value={next ?? ""} />
      {signup && (
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" className="input" autoComplete="name" placeholder="Coach Jake" defaultValue={state.name} key={state.name} required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={state.email} key={state.email} required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete={signup ? "new-password" : "current-password"} required />
      </div>
      {signup && needsCode && (
        <div>
          <label className="label" htmlFor="code">Sign-up code</label>
          <input id="code" name="code" className="input" required />
          <p className="mt-1 text-xs text-slate-500">Your admin gives this out so only your club&apos;s coaches can join.</p>
        </div>
      )}
      {state.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert" data-testid="auth-error">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "One moment…" : signup ? "Create account" : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {signup ? (
          <>Already have an account? <Link href={`/login${query}`} className="text-brand-700 hover:underline">Log in</Link></>
        ) : (
          <>New coach? <Link href={`/signup${query}`} className="text-brand-700 hover:underline">Create an account</Link></>
        )}
      </p>
    </form>
  );
}

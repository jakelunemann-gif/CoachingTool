import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

// Google sign-in exists only to save plans into Drive. drive.file lets the
// app manage docs it creates; set GOOGLE_DRIVE_SCOPE=drive to save into an
// existing folder the app didn't create (see README).
const DRIVE_SCOPE = `https://www.googleapis.com/auth/${process.env.GOOGLE_DRIVE_SCOPE || "drive.file"}`;

export const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

async function refresh(token: JWT): Promise<JWT> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: String(token.refreshToken),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return { ...token, accessToken: data.access_token, expiresAt: Math.floor(Date.now() / 1000) + data.expires_in, error: undefined };
  } catch {
    return { ...token, error: "RefreshFailed" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: googleConfigured
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: { params: { scope: `openid email profile ${DRIVE_SCOPE}`, access_type: "offline", prompt: "consent" } },
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return { ...token, accessToken: account.access_token, refreshToken: account.refresh_token, expiresAt: account.expires_at };
      }
      if (typeof token.expiresAt === "number" && Date.now() / 1000 > token.expiresAt - 60 && token.refreshToken) return refresh(token);
      return token;
    },
    async session({ session, token }) {
      return { ...session, error: token.error as string | undefined };
    },
  },
};

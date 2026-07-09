import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL;
const AUTH_BACKEND_TIMEOUT_MS = Number(process.env.AUTH_BACKEND_TIMEOUT_MS ?? 15_000);

if (!BACKEND_URL) {
  throw new Error("BACKEND_INTERNAL_URL is required for Google sign-in");
}

async function exchangeGoogleToken(idToken: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("auth_backend_timeout", "TimeoutError"));
  }, AUTH_BACKEND_TIMEOUT_MS);
  try {
    return await fetch(`${BACKEND_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // `account` is only present on the initial sign-in call, never on
      // subsequent JWT refreshes — this block runs exactly once per sign-in.
      if (account?.id_token) {
        const res = await exchangeGoogleToken(account.id_token);

        if (!res.ok) {
          throw new Error("Backend rejected Google sign-in");
        }

        const data = await res.json();
        token.accessToken = data.access_token;
        token.isNewUser = data.is_new_user;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.isNewUser = token.isNewUser;
      return session;
    },
  },
});

export { handler as GET, handler as POST };

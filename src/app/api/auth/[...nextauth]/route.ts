import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL;
const configuredAuthBackendTimeoutMs = Number(process.env.AUTH_BACKEND_TIMEOUT_MS);
const AUTH_BACKEND_TIMEOUT_MS = Number.isFinite(configuredAuthBackendTimeoutMs)
  ? Math.max(15_000, configuredAuthBackendTimeoutMs)
  : 90_000;
const RETRYABLE_BACKEND_STATUSES = new Set([502, 503, 504]);
const BACKEND_RETRY_DELAYS_MS = [1_000, 2_000, 3_000, 5_000, 8_000, 10_000, 10_000, 10_000, 10_000, 10_000];

if (!BACKEND_URL) {
  throw new Error("BACKEND_INTERNAL_URL is required for Google sign-in");
}

async function exchangeGoogleToken(idToken: string): Promise<Response> {
  const deadline = Date.now() + AUTH_BACKEND_TIMEOUT_MS;

  for (let attempt = 0; ; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error("auth_backend_timeout");

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new DOMException("auth_backend_timeout", "TimeoutError"));
    }, remainingMs);

    let retryStatus: number | "network_error";
    let retryResponse: Response | undefined;

    try {
      const response = await fetch(`${BACKEND_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
        signal: controller.signal,
      });

      if (!RETRYABLE_BACKEND_STATUSES.has(response.status)) return response;
      retryStatus = response.status;
      retryResponse = response;
    } catch {
      retryStatus = "network_error";
    } finally {
      clearTimeout(timeout);
    }

    const delay = Math.min(BACKEND_RETRY_DELAYS_MS[attempt] ?? 10_000, Math.max(0, deadline - Date.now()));
    if (delay <= 0) {
      if (retryResponse) return retryResponse;
      throw new Error("auth_backend_timeout");
    }

    console.info("auth_backend_warming_retry", { attempt: attempt + 1, status: retryStatus });
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
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
          throw new Error(`backend_rejected_${res.status}`);
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

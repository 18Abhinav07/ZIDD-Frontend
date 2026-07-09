import "next-auth";
import "next-auth/jwt";

// Augments NextAuth's Session/JWT with the fields our jwt/session callbacks
// attach in src/app/api/auth/[...nextauth]/route.ts: our own backend-issued
// access_token and the is_new_user flag used to route onboarding vs dashboard.
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    isNewUser?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    isNewUser?: boolean;
  }
}

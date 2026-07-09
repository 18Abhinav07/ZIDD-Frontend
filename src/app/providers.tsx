"use client";

import { SessionProvider } from "next-auth/react";
import { AppSessionProvider } from "@/components/shared/AppSessionProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AppSessionProvider>{children}</AppSessionProvider>
    </SessionProvider>
  );
}

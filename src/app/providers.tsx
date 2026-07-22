"use client";

import { SessionProvider } from "next-auth/react";
import { AppSessionProvider } from "@/components/shared/AppSessionProvider";
import { AvatarAssetPreloader } from "@/components/shared/AvatarAssetPreloader";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AvatarAssetPreloader />
      <AppSessionProvider>{children}</AppSessionProvider>
    </SessionProvider>
  );
}

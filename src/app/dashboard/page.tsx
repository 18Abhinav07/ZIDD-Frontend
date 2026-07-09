"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, homeForMe } from '@/services/me';
import { HomeResolverSkeleton } from '@/components/shared/RouteSkeletons';

export default function DashboardResolverPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((me) => {
        if (!cancelled) router.replace(homeForMe(me));
      })
      .catch(() => {
        if (!cancelled) router.replace('/auth/login');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return <HomeResolverSkeleton />;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import DashboardPageView from "@/src/features/dashboard/view/DashboardPage";

export default function DashboardPage() {
  const router = useRouter();
  const { isClient, loading } = useAuth();

  useEffect(() => {
    if (!loading && isClient()) {
      router.replace("/client/dashboard");
    }
  }, [isClient, loading, router]);

  if (loading) {
    return null;
  }

  if (isClient()) {
    return null;
  }

  return <DashboardPageView />;
}

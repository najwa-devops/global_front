"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { toWorkflowStatus } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useDossier } from "@/src/contexts/dossier-context";
import { getRouteMetadata } from "@/src/config/navigation.config";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [dossierName, setDossierName] = useState("");
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { user, logout, authenticated, loading } = useAuth();
  const isLoginPage = pathname === "/login";

  const { currentDossier } = useDossier();
  const displayName =
    (user?.name && user.name.trim()) ||
    (user?.email ? user.email.split("@")[0] : "Utilisateur");
  const userInitial = displayName.charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (currentDossier?.name) {
      localStorage.setItem("currentDossierName", currentDossier.name);
      setDossierName(currentDossier.name);
      return;
    }

    setDossierName(localStorage.getItem("currentDossierName") || "");
  }, [currentDossier?.name, pathname]);

  // On peut charger le compte des factures en attente ici pour le badge de la sidebar
  useEffect(() => {
    if (isLoginPage || loading || !authenticated) {
      setPendingCount(0);
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const invoices = await api.getAllInvoices();
        const pending = invoices.filter((inv) =>
          ["VERIFY", "READY_TO_TREAT", "READY_TO_VALIDATE"].includes(
            toWorkflowStatus(inv.status),
          ),
        ).length;
        setPendingCount(pending);
      } catch (error) {
        // Avoid noisy logs when backend denies this endpoint for current user context.
        setPendingCount(0);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [pathname, isLoginPage, authenticated, loading]);

  const { title: pageTitle } = getRouteMetadata(pathname);
  const isDossierDetailPage = /^\/dossiers\/\d+$/.test(pathname);
  const headerTitle =
    isDossierDetailPage && currentDossier
      ? currentDossier.name
      : currentDossier
        ? `${pageTitle} de ${currentDossier.name}`
        : pageTitle;

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <SidebarNav pendingCount={pendingCount} onLogout={logout} />

      <main className="flex-1 overflow-auto">
        <div
          className={`container mx-auto px-6 py-6 ${isMobile ? "pt-20" : ""}`}
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {headerTitle}{" "}
                <span className="text-[#00906b]"> {dossierName || ""}</span>
              </h1>
            </div>

            {user && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-foreground leading-none">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-1 tracking-wider font-bold">
                    {user.role}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm">
                  {userInitial}
                </div>
              </div>
            )}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

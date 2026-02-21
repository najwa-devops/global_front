"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  Sparkles,
  Sun,
  Moon,
  User as UserIcon,
  FolderOpen
} from "lucide-react"
import { useState, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTheme } from "@/components/theme-provider"
import { useNavigation } from "@/src/hooks/use-navigation"
import { NavItemConfig } from "@/src/config/navigation.config"

interface SidebarNavProps {
  pendingCount?: number
  onLogout?: () => void
}

export function SidebarNav({ pendingCount = 0, onLogout }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openMenus, setOpenMenus] = useState<string[]>([])

  const isMobile = useIsMobile()
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const { items, mode, dossier, user } = useNavigation()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-expand menus based on current path
  useEffect(() => {
    items.forEach(item => {
      if (item.children?.some(child => pathname.startsWith(child.href))) {
        if (!openMenus.includes(item.id)) {
          setOpenMenus(prev => [...prev, item.id])
        }
      }
    })
  }, [pathname, items])

  const toggleMenu = (id: string) => {
    setOpenMenus(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const renderNavItem = (item: NavItemConfig, isChild = false) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && !item.children)
    const isExpanded = openMenus.includes(item.id)
    const hasChildren = item.children && item.children.length > 0
    const IconComponent = item.icon

    const isParentActive = item.children?.some(child => pathname.startsWith(child.href))

    return (
      <div key={item.id} className="w-full">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 transition-all duration-200",
            !isMobile && collapsed && "justify-center px-2",
            isChild && "pl-9 text-sm h-9",
            isActive || (isParentActive && !isExpanded)
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
          onClick={() => hasChildren && toggleMenu(item.id)}
          asChild={!hasChildren}
        >
          {hasChildren ? (
            <div className="flex items-center justify-between w-full h-full px-0">
              <div className="flex items-center gap-3">
                <IconComponent className={cn("h-4 w-4 shrink-0", (isActive || isParentActive) && "text-primary")} />
                {(isMobile || !collapsed) && <span className="truncate">{item.label}</span>}
              </div>
              {(isMobile || !collapsed) && (
                <ChevronDown className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isExpanded ? "rotate-0" : "-rotate-90"
                )} />
              )}
            </div>
          ) : (
            <Link href={item.href} onClick={() => isMobile && setMobileOpen(false)}>
              <IconComponent className={cn("h-4 w-4 shrink-0", (isActive || isParentActive) && "text-primary")} />
              {(isMobile || !collapsed) && (
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{item.label}</span>
                  {item.badgeKey === "pendingCount" && pendingCount > 0 && (
                    <Badge className="h-5 px-1.5 bg-amber-500 text-white border-none text-[10px]">
                      {pendingCount}
                    </Badge>
                  )}
                </div>
              )}
            </Link>
          )}
        </Button>

        {hasChildren && isExpanded && (isMobile || !collapsed) && (
          <div className="mt-1 flex flex-col gap-1 border-l ml-5 border-border/50">
            {item.children?.map(child => renderNavItem(child, true))}
          </div>
        )}
      </div>
    )
  }

  const NavContent = () => (
    <>
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 shrink-0">
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-foreground tracking-tight">FactureOCR</span>
              <span className="text-[10px] text-muted-foreground">Expertise Comptable</span>
            </div>
          </div>
        )}
        {collapsed && !isMobile && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 mx-auto">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Main Navigation Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
        {/* Dossier Context Header - SaaS Style */}
        {mode === 'dossier' && dossier && (isMobile || !collapsed) && (
          <div className="mb-6 mx-1">
            <Link
              href="/dossiers"
              className="flex items-center gap-2 mb-4 px-2 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors group"
            >
              <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
              Retour aux dossiers
            </Link>

            <div className="px-3 py-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 blur-2xl rounded-full -mr-8 -mt-8 opacity-50" />

              <div className="flex items-center gap-2.5 mb-2 relative">
                <div className="p-1.5 rounded-lg bg-primary/20 backdrop-blur-sm shadow-sm">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary/80">Dossier Actuel</span>
              </div>

              <p className="text-[14px] font-extrabold text-foreground leading-snug line-clamp-2 relative" title={dossier.name}>
                {dossier.name}
              </p>

              <div className="mt-3 flex items-center gap-2 relative">
                <div className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Mode Expertise</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-1">
            <p className={cn(
              "px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 mb-3",
              collapsed && !isMobile && "sr-only",
            )}>
              {mode === 'dossier' ? "Gestion du Dossier" : "Plateforme"}
            </p>
            {items.filter(i => i.id !== 'back').map((item) => renderNavItem(item))}
          </div>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="border-t border-border/50 p-3 shrink-0">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 mb-2 text-muted-foreground hover:text-foreground hover:bg-accent",
            !isMobile && collapsed && "justify-center px-2",
          )}
          onClick={toggleTheme}
        >
          {mounted && theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {(isMobile || !collapsed) && <span>{mounted && theme === "dark" ? "Mode clair" : "Mode sombre"}</span>}
        </Button>

        <div className={cn("rounded-lg bg-accent/50 p-2 mb-2", collapsed && !isMobile && "p-2")}>
          <div className={cn("flex items-center gap-3", !isMobile && collapsed && "justify-center")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 shrink-0">
              <UserIcon className="h-4 w-4 text-primary" />
            </div>
            {(isMobile || !collapsed) && user && (
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs font-semibold text-foreground truncate w-full">
                  {user.name}
                </span>
                <span className="text-[10px] font-medium tracking-tight text-primary uppercase">
                  {user.role}
                </span>
                <span className="text-[9px] text-muted-foreground truncate w-full mt-0.5" title={user.email}>
                  {user.email}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            !isMobile && collapsed && "justify-center px-2",
          )}
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(isMobile || !collapsed) && <span>Déconnexion</span>}
        </Button>
      </div>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed left-4 top-4 z-50 md:hidden bg-background/80 backdrop-blur-sm border shadow-sm">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 border-border/50">
          <div className="flex h-full flex-col">
            <NavContent />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border/50 transition-all duration-300 bg-card/30 backdrop-blur-md",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <NavContent />
    </aside>
  )
}

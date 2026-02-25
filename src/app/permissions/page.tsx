"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AuthUser, UserRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "COMPTABLE", "CLIENT"];

export default function PermissionsPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const canEdit = useMemo(() => currentUser?.role === "ADMIN", [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [me, data] = await Promise.all([
        api.getCurrentUser(),
        api.listUsers(),
      ]);
      setCurrentUser(me);
      setUsers(data);
    } catch (error: any) {
      toast.error(error?.message || "Erreur chargement utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const markSaving = (id: number, saving: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const updateLocalUser = (id: number, patch: Partial<AuthUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const handleRoleChange = async (userId: number, role: UserRole) => {
    if (!canEdit) return;
    markSaving(userId, true);
    try {
      const updated = await api.updateUserRole(userId, role);
      updateLocalUser(userId, { role: updated.role });
      toast.success("Role mis a jour");
    } catch (error: any) {
      toast.error(error?.message || "Erreur mise a jour du role");
    } finally {
      markSaving(userId, false);
    }
  };

  const handleActiveChange = async (userId: number, active: boolean) => {
    if (!canEdit) return;
    markSaving(userId, true);
    try {
      const updated = await api.updateUserActive(userId, active);
      updateLocalUser(userId, { active: updated.active });
      toast.success("Statut mis a jour");
    } catch (error: any) {
      toast.error(error?.message || "Erreur mise a jour du statut");
    } finally {
      markSaving(userId, false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Chargement...</div>
          ) : users.length === 0 ? (
            <div className="text-muted-foreground">Aucun utilisateur</div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const isSaving = savingIds.has(u.id);
                const isSelf = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {u.displayName || u.username}
                      </div>
                      <div className="text-muted-foreground">
                        {u.username} • {u.role} •{" "}
                        {u.active ? "Actif" : "Inactif"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[160px]">
                        <Select
                          value={u.role}
                          onValueChange={(value) =>
                            handleRoleChange(u.id, value as UserRole)
                          }
                          disabled={!canEdit || isSaving}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.active ?? true}
                          onCheckedChange={(checked) =>
                            handleActiveChange(u.id, checked)
                          }
                          disabled={!canEdit || isSaving || isSelf}
                        />
                        <span className="text-xs text-muted-foreground">
                          {isSelf
                            ? "Votre compte"
                            : u.active
                              ? "Actif"
                              : "Inactif"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

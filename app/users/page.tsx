"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuthUser, UserRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const role: UserRole = "COMPTABLE";

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers();
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Username et mot de passe requis");
      return;
    }
    try {
      await api.createUser({
        username,
        password,
        role,
        displayName: displayName || undefined,
      });
      toast.success("Comptable créé");
      setUsername("");
      setPassword("");
      setDisplayName("");
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Erreur création utilisateur");
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await api.deactivateUser(id);
      toast.success("Utilisateur désactivé");
      await loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Erreur désactivation");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Créer un comptable</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Mot de passe
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">
                Nom affiché
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Créer comptable</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Chargement...</div>
          ) : users.length === 0 ? (
            <div className="text-muted-foreground">Aucun utilisateur</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between border-b border-border/50 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {u.displayName || u.username}
                    </div>
                    <div className="text-muted-foreground">
                      {u.username} • {u.role} • {u.active ? "Actif" : "Inactif"}
                    </div>
                  </div>
                  {u.active && (
                    <Button
                      variant="outline"
                      onClick={() => handleDeactivate(u.id)}
                    >
                      Désactiver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

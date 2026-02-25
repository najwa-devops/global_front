"use client";

import { Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthViewModel } from "@/src/features/auth/viewmodel/useAuthViewModel";

export default function LoginPageView() {
  const {
    username,
    password,
    isLoading,
    setUsername,
    setPassword,
    handleSubmit,
  } = useAuthViewModel();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-100">
      <div className="h-screen w-full overflow-hidden border-y bg-card shadow-xl md:border-none">
        <div className="grid h-full grid-cols-1 md:grid-cols-2">
          <div className="relative h-full overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://img.freepik.com/photos-gratuite/equipe-commerciale-reussie-heureuse_53876-95773.jpg')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/70 via-emerald-900/40 to-emerald-900/10" />
            <div className="relative h-full p-8 text-white flex flex-col">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-white/20">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Portail entreprise</p>
              </div>
              <div className="mt-auto space-y-4">
                <div className="text-3xl font-semibold leading-tight">
                  Une gestion des factures claire, rapide et securisee.
                </div>
                <div className="text-sm text-white/80 max-w-sm">
                  Accedez a vos validations, statuts et workflows en un seul endroit.
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full items-center justify-center p-8 md:p-12">
            <Card className="w-full max-w-md border-white/20 bg-white/90 shadow-2xl backdrop-blur p-8">
              <CardHeader className="px-0 pb-6">
                <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Connectez-vous avec vos identifiants professionnels.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm text-muted-foreground">
                      Nom d'utilisateur
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="votre.nom"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm text-muted-foreground">
                      Mot de passe
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connexion en cours...
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

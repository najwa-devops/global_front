"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/src/core/api/httpClient";
import {
  getPostLoginRoute,
  validateLoginCredentials,
} from "@/src/features/auth/model/authModel";

export function useAuthViewModel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login, authenticated, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && authenticated && user) {
      router.replace(getPostLoginRoute(user.role));
    }
  }, [loading, authenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateLoginCredentials(username, password);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setIsLoading(true);
      await login(username, password);
      toast.success("Connexion reussie !");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Identifiants incorrects.");
      } else {
        toast.error("Une erreur est survenue. Veuillez reessayer.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return useMemo(
    () => ({
      username,
      password,
      isLoading,
      setUsername,
      setPassword,
      handleSubmit,
    }),
    [username, password, isLoading],
  );
}

import type { AuthRedirectRole } from "./authTypes";

const defaultRoute = "/dossiers";

export function getPostLoginRoute(role: AuthRedirectRole): string {
  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return "/admin";
    case "CLIENT":
    case "COMPTABLE":
    case "FOURNISSEUR":
    default:
      return defaultRoute;
  }
}

export function validateLoginCredentials(username: string, password: string): string | null {
  if (!username.trim() || !password) {
    return "Veuillez remplir tous les champs.";
  }
  return null;
}

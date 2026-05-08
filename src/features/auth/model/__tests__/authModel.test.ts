import { validateLoginCredentials, getPostLoginRoute } from "../authModel";

// ── validateLoginCredentials() ────────────────────────────────────────────────

describe("validateLoginCredentials", () => {
  test("username et password valides → retourne null (pas d'erreur)", () => {
    expect(validateLoginCredentials("admin", "secret")).toBeNull();
  });

  test("username vide → retourne message d'erreur", () => {
    const result = validateLoginCredentials("", "secret");
    expect(result).toBe("Veuillez remplir tous les champs.");
  });

  test("password vide → retourne message d'erreur", () => {
    const result = validateLoginCredentials("admin", "");
    expect(result).toBe("Veuillez remplir tous les champs.");
  });

  test("username avec seulement des espaces → retourne message d'erreur", () => {
    const result = validateLoginCredentials("   ", "secret");
    expect(result).toBe("Veuillez remplir tous les champs.");
  });

  test("les deux champs vides → retourne message d'erreur", () => {
    const result = validateLoginCredentials("", "");
    expect(result).toBe("Veuillez remplir tous les champs.");
  });

  test("username valide avec espaces autour → est accepté après trim", () => {
    // trim() est appliqué au username dans la condition
    const result = validateLoginCredentials("  admin  ", "secret");
    // "  admin  ".trim() = "admin" → non vide → valide
    expect(result).toBeNull();
  });
});

// ── getPostLoginRoute() ───────────────────────────────────────────────────────

describe("getPostLoginRoute", () => {
  test("rôle ADMIN → redirige vers /admin", () => {
    expect(getPostLoginRoute("ADMIN")).toBe("/admin");
  });

  test("rôle SUPER_ADMIN → redirige vers /admin", () => {
    expect(getPostLoginRoute("SUPER_ADMIN")).toBe("/admin");
  });

  test("rôle CLIENT → redirige vers /dossiers", () => {
    expect(getPostLoginRoute("CLIENT")).toBe("/dossiers");
  });

  test("rôle COMPTABLE → redirige vers /dossiers", () => {
    expect(getPostLoginRoute("COMPTABLE")).toBe("/dossiers");
  });

  test("rôle FOURNISSEUR → redirige vers /dossiers", () => {
    expect(getPostLoginRoute("FOURNISSEUR")).toBe("/dossiers");
  });
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPageView from "../LoginPage";

// ── Mocks des dépendances externes ────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    login: jest.fn(),
    authenticated: false,
    user: null,
    loading: false,
  }),
}));

// ── Tests du composant LoginPageView ─────────────────────────────────────────

describe("LoginPageView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("affiche le titre Connexion", () => {
    render(<LoginPageView />);
    expect(screen.getByText("Connexion")).toBeInTheDocument();
  });

  test("affiche le champ username", () => {
    render(<LoginPageView />);
    expect(screen.getByLabelText(/nom d'utilisateur/i)).toBeInTheDocument();
  });

  test("affiche le champ mot de passe", () => {
    render(<LoginPageView />);
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
  });

  test("affiche le bouton Se connecter", () => {
    render(<LoginPageView />);
    expect(
      screen.getByRole("button", { name: /se connecter/i })
    ).toBeInTheDocument();
  });

  test("saisir le username met à jour le champ", () => {
    render(<LoginPageView />);
    const usernameInput = screen.getByLabelText(/nom d'utilisateur/i);
    fireEvent.change(usernameInput, { target: { value: "admin" } });
    expect(usernameInput).toHaveValue("admin");
  });

  test("saisir le password met à jour le champ", () => {
    render(<LoginPageView />);
    const passwordInput = screen.getByLabelText(/mot de passe/i);
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    expect(passwordInput).toHaveValue("secret");
  });

  test("le champ password est de type password (masqué)", () => {
    render(<LoginPageView />);
    const passwordInput = screen.getByLabelText(/mot de passe/i);
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});

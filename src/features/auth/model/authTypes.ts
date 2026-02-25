export type AuthRedirectRole = "CLIENT" | "ADMIN" | "COMPTABLE" | "SUPER_ADMIN" | "FOURNISSEUR";

export type LoginFormState = {
  username: string;
  password: string;
  isSubmitting: boolean;
};

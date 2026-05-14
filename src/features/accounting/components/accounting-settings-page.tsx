"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccounting } from "../hooks/use-accounting";
import { Account, CreateAccountRequest, Tier, UpdateAccountRequest } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/src/lib/logger";

type AccountFormState = {
  code: string;
  libelle: string;
  classe: number;
  tvaRate: string;
  taxCode: string;
  active: boolean;
};

const ACCOUNT_CLASS_OPTIONS = [
  { value: 1, label: "1 - Financement permanent" },
  { value: 2, label: "2 - Actif immobilisé" },
  { value: 3, label: "3 - Actif circulant" },
  { value: 4, label: "4 - Passif circulant" },
  { value: 5, label: "5 - Trésorerie" },
  { value: 6, label: "6 - Charges" },
  { value: 7, label: "7 - Produits" },
  { value: 8, label: "8 - Résultats" },
];

const emptyAccountForm = (): AccountFormState => ({
  code: "",
  libelle: "",
  classe: 4,
  tvaRate: "0",
  taxCode: "",
  active: true,
});

const normalizeOptionalText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Enterprise-grade Accounting Settings page.
 * Standardized with React Query, professional logging, and no informal language/emojis.
 */
export function AccountingSettingsPage() {
  const {
    accounts,
    tiers,
    isLoading,
    createAccount,
    updateAccount,
    createTier,
    updateTier,
    deactivateTier,
  } = useAccounting();

  const [activeTab, setActiveTab] = useState("accounts");
  const [hasSelectedDossier, setHasSelectedDossier] = useState(false);
  const [searchAccountQuery, setSearchAccountQuery] = useState("");
  const [searchTierQuery, setSearchTierQuery] = useState("");
  const [accountClassFilter, setAccountClassFilter] = useState<number | null>(
    null,
  );
  const [tierFilter] = useState<string>("all");
  // Dialog states
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormState>(
    emptyAccountForm(),
  );

  // Tier Dialog State
  const [isTierDialogOpen, setIsTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [tierForm, setTierForm] = useState({
    libelle: "",
    activity: "",
    auxiliaireMode: false,
    tierNumber: "",
    codeTier: "",
    collectifAccount: "",
    ifNumber: "",
    ice: "",
    rcNumber: "",
    defaultChargeAccount: "",
    defaultChargeAccount2: "",
    tvaAccount: "",
    tvaAccount2: "",
    defaultTvaRate: 0,
    defaultTvaRate2: 0,
    taxCode: "",
  });

  // --- ACCOUNTS LOGIC ---
  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (accountClassFilter !== null) {
      result = result.filter(
        (a) =>
          a.classe === accountClassFilter ||
          a.code.startsWith(String(accountClassFilter)),
      );
    }
    if (!searchAccountQuery) return result;
    const lower = searchAccountQuery.toLowerCase();
    return result.filter(
      (a) =>
        a.code.toLowerCase().includes(lower) ||
        a.libelle.toLowerCase().includes(lower) ||
        (a.ville || "").toLowerCase().includes(lower) ||
        (a.activite || "").toLowerCase().includes(lower),
    );
  }, [accounts, searchAccountQuery, accountClassFilter]);

  const getTvaRateForAccount = (code: string): number | null => {
    const account = tvaAccounts.find((item) => item.code === code);
    return account?.tvaRate ?? null;
  };

  const isTvaConfigEnabled = (code: string) =>
    code.startsWith("3455") || code.startsWith("4455");

  function openAddAccount() {
    setEditingAccount(null);
    setAccountForm(emptyAccountForm());
    setIsAccountDialogOpen(true);
  }

  function openEditAccount(account: Account) {
    const taxEnabled = isTvaConfigEnabled(account.code);
    setEditingAccount(account);
    setAccountForm({
      code: account.code,
      libelle: account.libelle,
      classe: account.classe || Number(account.code?.charAt(0) || 4),
      tvaRate: taxEnabled && account.tvaRate != null ? String(account.tvaRate) : "0",
      taxCode: taxEnabled ? account.taxCode || "" : "",
      active: account.active,
    });
    setIsAccountDialogOpen(true);
  }

  async function handleSaveAccount() {
    try {
      if (!accountForm.code.trim()) {
        toast.error("Le numéro de compte est obligatoire");
        return;
      }
      if (!accountForm.libelle.trim()) {
        toast.error("Le libellé est obligatoire");
        return;
      }
      if (!accountForm.classe || accountForm.classe < 1 || accountForm.classe > 8) {
        toast.error("La classe doit être comprise entre 1 et 8");
        return;
      }
      const taxConfigEnabled = isTvaConfigEnabled(accountForm.code.trim());

      const payload: CreateAccountRequest | UpdateAccountRequest = {
        code: accountForm.code.trim(),
        libelle: accountForm.libelle.trim(),
        classe: accountForm.classe,
        tvaRate: Number(accountForm.tvaRate),
        taxCode: taxConfigEnabled ? normalizeOptionalText(accountForm.taxCode) : undefined,
        active: accountForm.active,
      };

      if (editingAccount) {
        await updateAccount({ id: editingAccount.id, data: payload as UpdateAccountRequest });
        toast.success("Compte mis a jour");
      } else {
        await createAccount(payload as CreateAccountRequest);
        toast.success("Compte cree");
      }
      setIsAccountDialogOpen(false);
    } catch (error: any) {
      logger.error("Error saving account", error);
    }
  }

  // --- TIERS LOGIC ---
  const filteredTiers = useMemo(() => {
    let result = tiers;
    if (tierFilter === "missing_config") {
      result = result.filter((t) => !t.hasAccountingConfig);
    } else if (tierFilter === "aux") {
      result = result.filter((t) => t.auxiliaireMode);
    } else if (tierFilter === "no_aux") {
      result = result.filter((t) => !t.auxiliaireMode);
    } else if (tierFilter === "with_ids") {
      result = result.filter((t) => t.ice || t.ifNumber);
    }

    if (!searchTierQuery) return result;
    const lower = searchTierQuery.toLowerCase();
    return result.filter(
      (t) =>
        t.libelle.toLowerCase().includes(lower) ||
        (t.ice && t.ice.includes(lower)) ||
        (t.tierNumber && t.tierNumber.includes(lower)) ||
        (t.codeTier && t.codeTier.includes(lower)),
    );
  }, [tiers, searchTierQuery, tierFilter]);

  function isGlobalAuxModeEnabled() {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("accounting_global_aux_mode") === "true";
  }

  function openAddTier() {
    const useAuxDialog = isGlobalAuxModeEnabled();
    setEditingTier(null);
    setTierForm({
      libelle: "",
      activity: "",
      auxiliaireMode: useAuxDialog,
      tierNumber: "",
      codeTier: "",
      collectifAccount: useAuxDialog ? "441100000" : "",
      ifNumber: "",
      ice: "",
      rcNumber: "",
      defaultChargeAccount: "",
      defaultChargeAccount2: "",
      tvaAccount: "",
      tvaAccount2: "",
      defaultTvaRate: 0,
      defaultTvaRate2: 0,
      taxCode: "",
    });
    setIsTierDialogOpen(true);
  }

  function openEditTier(tier: Tier) {
    setEditingTier(tier);
    setTierForm({
      libelle: tier.libelle,
      activity: tier.activity || "",
      auxiliaireMode: tier.auxiliaireMode,
      tierNumber: tier.tierNumber,
      codeTier: tier.codeTier || "",
      collectifAccount: tier.collectifAccount || "",
      ifNumber: tier.ifNumber || "",
      ice: tier.ice || "",
      rcNumber: tier.rcNumber || "",
      defaultChargeAccount: tier.defaultChargeAccount || "",
      defaultChargeAccount2: tier.defaultChargeAccount2 || "",
      tvaAccount: tier.tvaAccount || "",
      tvaAccount2: tier.tvaAccount2 || "",
      defaultTvaRate:
        tier.defaultTvaRate ?? getTvaRateForAccount(tier.tvaAccount || "") ?? 0,
      defaultTvaRate2:
        tier.defaultTvaRate2 ?? getTvaRateForAccount(tier.tvaAccount2 || "") ?? 0,
      taxCode: tier.taxCode || "",
    });
    setIsTierDialogOpen(true);
  }

  async function handleSaveTier() {
    try {
      if (!tierForm.libelle.trim() || !tierForm.tierNumber.trim()) {
        toast.error("Nom et Numero compte sont obligatoires");
        return;
      }
      if (tierForm.auxiliaireMode && !tierForm.codeTier.trim()) {
        toast.error("Le code tier est obligatoire en mode auxiliaire");
        return;
      }
      if (tierForm.auxiliaireMode && !tierForm.collectifAccount.trim()) {
        toast.error("Le compte collectif est obligatoire en mode auxiliaire");
        return;
      }
      if (editingTier) {
        await updateTier({ id: editingTier.id, data: tierForm });
        toast.success("Fournisseur mis a jour");
      } else {
        await createTier(tierForm);
        toast.success("Fournisseur enregistre");
      }
      setIsTierDialogOpen(false);
    } catch (error: any) {
      logger.error("Error saving tier", error);
      toast.error(error?.message || "Erreur lors de l'enregistrement du fournisseur");
    }
  }

  const chargeAccounts = accounts.filter(
    (a) => a.classe === 6 || a.code.startsWith("6"),
  );
  const tvaAccounts = accounts.filter(
    (a) => a.code.startsWith("3455") || a.code.startsWith("4455"),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawDossierId = window.localStorage.getItem("currentDossierId");
    const dossierId = Number(rawDossierId);
    setHasSelectedDossier(Boolean(rawDossierId) && Number.isFinite(dossierId) && dossierId > 0);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Tabs
        defaultValue="accounts"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="accounts">Plan Comptable</TabsTrigger>
          <TabsTrigger value="tiers">Plan Tiers</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold">
                Liste des Comptes
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-8 w-[250px]"
                    value={searchAccountQuery}
                    onChange={(e) => setSearchAccountQuery(e.target.value)}
                  />
                </div>
                <Button onClick={openAddAccount}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  variant={accountClassFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAccountClassFilter(null)}
                >
                  Tous
                </Button>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <Button
                    key={c}
                    variant={accountClassFilter === c ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAccountClassFilter(c)}
                  >
                    Classe {c}
                  </Button>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Libelle</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Taux TVA</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">
                        {account.code}
                      </TableCell>
                      <TableCell>{account.libelle}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.classeName || `Classe ${account.classe}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {account.tvaRate != null ? `${account.tvaRate}%` : "-"}
                      </TableCell>
                      <TableCell>{account.ville || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={account.active ? "secondary" : "outline"}
                        >
                          {account.active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditAccount(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4 pt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">
                  Annuaire des Fournisseurs
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      className="pl-8 w-[250px]"
                      value={searchTierQuery}
                      onChange={(e) => setSearchTierQuery(e.target.value)}
                    />
                  </div>
                  <Button onClick={openAddTier}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Activité</TableHead>
                      <TableHead>Numero Compte</TableHead>
                      <TableHead>Compte HT</TableHead>
                      <TableHead>Compte TVA</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTiers.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell className="font-medium">
                          {tier.libelle}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {tier.activity || "-"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {tier.tierNumber}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {tier.defaultChargeAccount || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {tier.tvaAccount || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {tier.active ? (
                            <Badge variant="secondary">Actif</Badge>
                          ) : (
                            <Badge variant="outline">Inactif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditTier(tier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deactivateTier(tier.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
      </Tabs>

      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Modifier le compte" : "Ajouter un compte"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>N° Compte</Label>
                <Input
                  value={accountForm.code}
                  disabled={!!editingAccount}
                  onChange={(e) => {
                    const nextCode = e.target.value;
                    const nextEnabled = isTvaConfigEnabled(nextCode.trim());
                    setAccountForm((prev) => ({
                      ...prev,
                      code: nextCode,
                      tvaRate: nextEnabled ? prev.tvaRate || "0" : "0",
                      taxCode: nextEnabled ? prev.taxCode : "",
                    }));
                  }}
                  placeholder="000000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Libelle</Label>
                <Input
                  value={accountForm.libelle}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, libelle: e.target.value })
                  }
                  placeholder="Libellé du compte"
                />
              </div>
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select
                  value={String(accountForm.classe)}
                  onValueChange={(value) =>
                    setAccountForm({ ...accountForm, classe: Number(value) })
                  }
                  disabled={!!editingAccount}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_CLASS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taux TVA (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={accountForm.tvaRate}
                  disabled={!isTvaConfigEnabled(accountForm.code.trim())}
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      tvaRate: e.target.value,
                    })
                  }
                  className={
                    !isTvaConfigEnabled(accountForm.code.trim())
                      ? "bg-muted/60"
                      : undefined
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Code Taxe</Label>
                <Input
                  value={accountForm.taxCode}
                  disabled={!isTvaConfigEnabled(accountForm.code.trim())}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, taxCode: e.target.value })
                  }
                  placeholder="Code taxe"
                  className={
                    !isTvaConfigEnabled(accountForm.code.trim())
                      ? "bg-muted/60"
                      : undefined
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm font-medium">Compte actif</Label>
                    <p className="text-xs text-muted-foreground">
                      Les comptes inactifs restent visibles mais ne sont pas proposés dans les sélections actives.
                    </p>
                  </div>
                  <Switch
                    checked={accountForm.active}
                    onCheckedChange={(checked) =>
                      setAccountForm({ ...accountForm, active: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveAccount}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isTierDialogOpen} onOpenChange={setIsTierDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTier
                ? "Modifier le Fournisseur"
                : tierForm.auxiliaireMode
                  ? "Création du compte"
                  : "Ajouter un Fournisseur"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {tierForm.auxiliaireMode && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Création du compte</Label>
                  <Badge variant="outline">Mode auxiliaire</Badge>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Compte collectif</Label>
                    <Select
                      value={tierForm.collectifAccount}
                      onValueChange={(value) =>
                        setTierForm({ ...tierForm, collectifAccount: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un compte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="441100000">441100000</SelectItem>
                        <SelectItem value="342100000">342100000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Code tier</Label>
                    <Input
                      value={tierForm.codeTier}
                      onChange={(e) =>
                        setTierForm({ ...tierForm, codeTier: e.target.value })
                      }
                      placeholder="Code tier"
                    />
                  </div>
                </div>
              </div>
            )}
            {!tierForm.auxiliaireMode ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Compte tier (ex: 44111234)</Label>
                  <Input
                    className="font-mono"
                    value={tierForm.tierNumber}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, tierNumber: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom / Libelle</Label>
                  <Input
                    value={tierForm.libelle}
                    onChange={(e) =>
                      setTierForm({ ...tierForm, libelle: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nom / Libelle</Label>
                <Input
                  value={tierForm.libelle}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, libelle: e.target.value })
                  }
                />
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label>Activite</Label>
              <Input
                value={tierForm.activity}
                onChange={(e) =>
                  setTierForm({ ...tierForm, activity: e.target.value })
                }
                placeholder="ex: Import-Export, BTP, Telecommunications..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>IF</Label>
                <Input
                  value={tierForm.ifNumber}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, ifNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>ICE</Label>
                <Input
                  value={tierForm.ice}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, ice: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>RC</Label>
                <Input
                  value={tierForm.rcNumber}
                  onChange={(e) =>
                    setTierForm({ ...tierForm, rcNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Compte HT 1</Label>
                  <Select
                    value={tierForm.defaultChargeAccount}
                    onValueChange={(v) =>
                      setTierForm({ ...tierForm, defaultChargeAccount: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {chargeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.code}>
                          {a.code} - {a.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Compte HT 2</Label>
                  <Select
                    value={tierForm.defaultChargeAccount2}
                    onValueChange={(v) =>
                      setTierForm({ ...tierForm, defaultChargeAccount2: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {chargeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.code}>
                          {a.code} - {a.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Compte TVA 1</Label>
                  <Select
                    value={tierForm.tvaAccount}
                    onValueChange={(v) => {
                      const selectedRate = getTvaRateForAccount(v);
                      setTierForm({
                        ...tierForm,
                        tvaAccount: v,
                        defaultTvaRate: selectedRate ?? tierForm.defaultTvaRate,
                        taxCode:
                          v.startsWith("3455") || v.startsWith("4455")
                            ? tierForm.taxCode || "146"
                            : tierForm.taxCode,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {tvaAccounts
                        .filter(
                          (a) =>
                            a.code.startsWith("3455") ||
                            a.code.startsWith("4455"),
                        )
                        .map((a) => (
                          <SelectItem key={a.id} value={a.code}>
                            {a.code} - {a.libelle}
                            {a.tvaRate != null ? ` (TVA ${a.tvaRate}%)` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {tierForm.tvaAccount ? (
                    <p className="text-xs text-muted-foreground">
                      Taux associé au compte TVA:{" "}
                      {getTvaRateForAccount(tierForm.tvaAccount) != null
                        ? `${getTvaRateForAccount(tierForm.tvaAccount)}%`
                        : `${tierForm.defaultTvaRate || 0}%`}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Compte TVA 2</Label>
                  <Select
                    value={tierForm.tvaAccount2}
                    onValueChange={(v) => {
                      const selectedRate = getTvaRateForAccount(v);
                      setTierForm({
                        ...tierForm,
                        tvaAccount2: v,
                        defaultTvaRate2: selectedRate ?? tierForm.defaultTvaRate2,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {tvaAccounts
                        .filter(
                          (a) =>
                            a.code.startsWith("3455") ||
                            a.code.startsWith("4455"),
                        )
                        .map((a) => (
                          <SelectItem key={a.id} value={a.code}>
                            {a.code} - {a.libelle}
                            {a.tvaRate != null ? ` (TVA ${a.tvaRate}%)` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {tierForm.tvaAccount2 ? (
                    <p className="text-xs text-muted-foreground">
                      Taux associé au compte TVA:{" "}
                      {getTvaRateForAccount(tierForm.tvaAccount2) != null
                        ? `${getTvaRateForAccount(tierForm.tvaAccount2)}%`
                        : `${tierForm.defaultTvaRate2 || 0}%`}
                    </p>
                  ) : null}
                </div>

                {(tierForm.tvaAccount?.startsWith("3455") ||
                  tierForm.tvaAccount?.startsWith("4455")) && (
                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div className="space-y-2">
                      <Label>Taux TVA</Label>
                      <Input
                        type="number"
                        value={tierForm.defaultTvaRate}
                        readOnly={Boolean(tierForm.tvaAccount)}
                        onChange={(e) =>
                          setTierForm({
                            ...tierForm,
                            defaultTvaRate: Number(e.target.value),
                          })
                        }
                        className={tierForm.tvaAccount ? "bg-muted/50" : undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code Taux</Label>
                      <Input
                        value={tierForm.taxCode}
                        onChange={(e) =>
                          setTierForm({ ...tierForm, taxCode: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTierDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleSaveTier}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

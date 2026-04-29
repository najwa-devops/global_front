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
  active: boolean;
  xCom: string;
  delai: string;
  ville: string;
  adresse: string;
  activite: string;
  cdClt: string;
  cdFrs: string;
  typeCmpt: string;
  numcat: string;
  idF: string;
  cod: string;
  cnss: string;
  tp: string;
  ice: string;
  rc: string;
  rib: string;
  tva: string;
  charge: string;
  createdBy: string;
  updatedBy: string;
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
  active: true,
  xCom: "",
  delai: "",
  ville: "",
  adresse: "",
  activite: "",
  cdClt: "",
  cdFrs: "",
  typeCmpt: "",
  numcat: "",
  idF: "",
  cod: "",
  cnss: "",
  tp: "",
  ice: "",
  rc: "",
  rib: "",
  tva: "",
  charge: "",
  createdBy: "",
  updatedBy: "",
});

const normalizeOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

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
  const [isAuxDialogOpen, setIsAuxDialogOpen] = useState(false);
  const [auxType, setAuxType] = useState<"client" | "fournisseur">("fournisseur");
  const [auxCollectifAccount, setAuxCollectifAccount] = useState("");
  const [auxTierCode, setAuxTierCode] = useState("");
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
    collectifAccount: "",
    ifNumber: "",
    ice: "",
    rcNumber: "",
    defaultChargeAccount: "",
    tvaAccount: "",
    defaultTvaRate: 0,
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

  function openAddAccount() {
    setEditingAccount(null);
    setAccountForm(emptyAccountForm());
    setIsAccountDialogOpen(true);
  }

  function openEditAccount(account: Account) {
    setEditingAccount(account);
    setAccountForm({
      code: account.code,
      libelle: account.libelle,
      classe: account.classe || Number(account.code?.charAt(0) || 4),
      tvaRate: account.tvaRate != null ? String(account.tvaRate) : "0",
      active: account.active,
      xCom: account.xCom || "",
      delai: account.delai != null ? String(account.delai) : "",
      ville: account.ville || "",
      adresse: account.adresse || "",
      activite: account.activite || "",
      cdClt: account.cdClt != null ? String(account.cdClt) : "",
      cdFrs: account.cdFrs != null ? String(account.cdFrs) : "",
      typeCmpt: account.typeCmpt || "",
      numcat: account.numcat != null ? String(account.numcat) : "",
      idF: account.idF || "",
      cod: account.cod || "",
      cnss: account.cnss || "",
      tp: account.tp || "",
      ice: account.ice || "",
      rc: account.rc || "",
      rib: account.rib || "",
      tva: account.tva || "",
      charge: account.charge || "",
      createdBy: account.createdBy || "",
      updatedBy: account.updatedBy || "",
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
      if (accountForm.tvaRate === null || accountForm.tvaRate === undefined || accountForm.tvaRate === "") {
        toast.error("Le taux de TVA est obligatoire");
        return;
      }

      const payload: CreateAccountRequest | UpdateAccountRequest = {
        code: accountForm.code.trim(),
        libelle: accountForm.libelle.trim(),
        classe: accountForm.classe,
        tvaRate: Number(accountForm.tvaRate),
        active: accountForm.active,
        xCom: normalizeOptionalText(accountForm.xCom),
        delai: normalizeOptionalNumber(accountForm.delai),
        ville: normalizeOptionalText(accountForm.ville),
        adresse: normalizeOptionalText(accountForm.adresse),
        activite: normalizeOptionalText(accountForm.activite),
        cdClt: normalizeOptionalNumber(accountForm.cdClt),
        cdFrs: normalizeOptionalNumber(accountForm.cdFrs),
        typeCmpt: normalizeOptionalText(accountForm.typeCmpt),
        numcat: normalizeOptionalNumber(accountForm.numcat),
        idF: normalizeOptionalText(accountForm.idF),
        cod: normalizeOptionalText(accountForm.cod),
        cnss: normalizeOptionalText(accountForm.cnss),
        tp: normalizeOptionalText(accountForm.tp),
        ice: normalizeOptionalText(accountForm.ice),
        rc: normalizeOptionalText(accountForm.rc),
        rib: normalizeOptionalText(accountForm.rib),
        tva: normalizeOptionalText(accountForm.tva),
        charge: normalizeOptionalText(accountForm.charge),
        createdBy: normalizeOptionalText(accountForm.createdBy),
        updatedBy: normalizeOptionalText(accountForm.updatedBy),
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
        (t.tierNumber && t.tierNumber.includes(lower)),
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
      collectifAccount: "",
      ifNumber: "",
      ice: "",
      rcNumber: "",
      defaultChargeAccount: "",
      tvaAccount: "",
      defaultTvaRate: 0,
      taxCode: "",
    });
    if (useAuxDialog) {
      setAuxType("fournisseur");
      setAuxCollectifAccount("441100000");
      setAuxTierCode("");
      setIsAuxDialogOpen(true);
      return;
    }
    setIsTierDialogOpen(true);
  }

  function openEditTier(tier: Tier) {
    setEditingTier(tier);
    setTierForm({
      libelle: tier.libelle,
      activity: tier.activity || "",
      auxiliaireMode: tier.auxiliaireMode,
      tierNumber: tier.tierNumber,
      collectifAccount: tier.collectifAccount || "",
      ifNumber: tier.ifNumber || "",
      ice: tier.ice || "",
      rcNumber: tier.rcNumber || "",
      defaultChargeAccount: tier.defaultChargeAccount || "",
      tvaAccount: tier.tvaAccount || "",
      defaultTvaRate:
        tier.defaultTvaRate ?? getTvaRateForAccount(tier.tvaAccount || "") ?? 0,
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

  function handleConfirmAuxDialog() {
    const defaultCollectif = auxType === "client" ? "342100000" : "441100000";
    setTierForm((prev) => ({
      ...prev,
      auxiliaireMode: true,
      collectifAccount: auxCollectifAccount || defaultCollectif,
      tierNumber: auxTierCode,
    }));
    setIsAuxDialogOpen(false);
    setIsTierDialogOpen(true);
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Modifier le compte" : "Ajouter un compte"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compte</Label>
                <Input
                  value={accountForm.code}
                  disabled={!!editingAccount}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, code: e.target.value })
                  }
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
                  onChange={(e) =>
                    setAccountForm({
                      ...accountForm,
                      tvaRate: e.target.value,
                    })
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={accountForm.ville}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, ville: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Adresse</Label>
                <Input
                  value={accountForm.adresse}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, adresse: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Activité</Label>
                <Input
                  value={accountForm.activite}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, activite: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Compte X_COM</Label>
                <Input
                  value={accountForm.xCom}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, xCom: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Délai</Label>
                <Input
                  type="number"
                  value={accountForm.delai}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, delai: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Type compte</Label>
                <Input
                  value={accountForm.typeCmpt}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, typeCmpt: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>CD Client</Label>
                <Input
                  type="number"
                  value={accountForm.cdClt}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, cdClt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CD Fournisseur</Label>
                <Input
                  type="number"
                  value={accountForm.cdFrs}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, cdFrs: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Numcat</Label>
                <Input
                  type="number"
                  value={accountForm.numcat}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, numcat: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>ID F</Label>
                <Input
                  value={accountForm.idF}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, idF: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>COD</Label>
                <Input
                  value={accountForm.cod}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, cod: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CNSS</Label>
                <Input
                  value={accountForm.cnss}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, cnss: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>TP</Label>
                <Input
                  value={accountForm.tp}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, tp: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>ICE</Label>
                <Input
                  value={accountForm.ice}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, ice: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>RC</Label>
                <Input
                  value={accountForm.rc}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, rc: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>RIB</Label>
                <Input
                  value={accountForm.rib}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, rib: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>TVA</Label>
                <Input
                  value={accountForm.tva}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, tva: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Charge</Label>
                <Input
                  value={accountForm.charge}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, charge: e.target.value })
                  }
                />
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
                : "Ajouter un Fournisseur"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numero Compte (ex: 44111234)</Label>
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
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Compte HT</Label>
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
                <Label>Compte TVA</Label>
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
                          a.code.startsWith("345") ||
                          a.code.startsWith("445"),
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
              {(tierForm.tvaAccount?.startsWith("3455") ||
                tierForm.tvaAccount?.startsWith("4455")) && (
                <div className="grid grid-cols-2 gap-4">
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
      <Dialog open={isAuxDialogOpen} onOpenChange={setIsAuxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configuration auxiliaire</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={auxType}
                onValueChange={(value: "client" | "fournisseur") => setAuxType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">client</SelectItem>
                  <SelectItem value="fournisseur">fournisseur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Compt collectife</Label>
              <Input
                value={auxCollectifAccount}
                onChange={(e) => setAuxCollectifAccount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Code tier</Label>
              <Input
                value={auxTierCode}
                onChange={(e) => setAuxTierCode(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuxDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmAuxDialog}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

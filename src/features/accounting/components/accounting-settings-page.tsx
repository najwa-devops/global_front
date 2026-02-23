"use client";

import { useState, useMemo } from "react";
import { useAccounting } from "../hooks/use-accounting";
import { Account, Tier } from "@/lib/types";
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
import { Loader2, Search, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/src/lib/logger";

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
  const [accountForm, setAccountForm] = useState({
    code: "",
    libelle: "",
    tvaRate: 20,
    taxCode: "",
    active: true,
  });

  // Tier Dialog State
  const [isTierDialogOpen, setIsTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [tierForm, setTierForm] = useState({
    libelle: "",
    auxiliaireMode: false,
    tierNumber: "",
    collectifAccount: "",
    ifNumber: "",
    ice: "",
    rcNumber: "",
    defaultChargeAccount: "",
    tvaAccount: "",
    defaultTvaRate: 20,
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
        a.libelle.toLowerCase().includes(lower),
    );
  }, [accounts, searchAccountQuery, accountClassFilter]);

  function openAddAccount() {
    setEditingAccount(null);
    setAccountForm({
      code: "",
      libelle: "",
      tvaRate: 20,
      taxCode: "",
      active: true,
    });
    setIsAccountDialogOpen(true);
  }

  function openEditAccount(account: Account) {
    setEditingAccount(account);
    setAccountForm({
      code: account.code,
      libelle: account.libelle,
      tvaRate: account.tvaRate || 20,
      taxCode: account.taxCode || "",
      active: account.active,
    });
    setIsAccountDialogOpen(true);
  }

  async function handleSaveAccount() {
    try {
      if (!/^\d{9}$/.test(accountForm.code)) {
        toast.error("Le code compte doit contenir exactement 9 chiffres");
        return;
      }
      if (editingAccount) {
        await updateAccount({ id: editingAccount.id, data: accountForm });
        toast.success("Compte mis a jour");
      } else {
        await createAccount(accountForm);
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
      auxiliaireMode: useAuxDialog,
      tierNumber: "",
      collectifAccount: "",
      ifNumber: "",
      ice: "",
      rcNumber: "",
      defaultChargeAccount: "",
      tvaAccount: "",
      defaultTvaRate: 20,
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
      auxiliaireMode: tier.auxiliaireMode,
      tierNumber: tier.tierNumber,
      collectifAccount: tier.collectifAccount || "",
      ifNumber: tier.ifNumber || "",
      ice: tier.ice || "",
      rcNumber: tier.rcNumber || "",
      defaultChargeAccount: tier.defaultChargeAccount || "",
      tvaAccount: tier.tvaAccount || "",
      defaultTvaRate: tier.defaultTvaRate || 20,
      taxCode: tier.taxCode || "",
    });
    setIsTierDialogOpen(true);
  }

  async function handleSaveTier() {
    try {
      if (!tierForm.libelle || !tierForm.tierNumber) {
        toast.error("Nom et Compte tier sont obligatoires");
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
    (a) => a.code.startsWith("345") || a.code.startsWith("445"),
  );

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
                {[1, 2, 3, 4, 5, 6, 7].map((c) => (
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
                    <TableHead>Compte Tier</TableHead>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Modifier le compte" : "Ajouter un compte"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Compte</Label>
              <Input
                className="col-span-3"
                value={accountForm.code}
                disabled={!!editingAccount}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, code: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Libelle</Label>
              <Input
                className="col-span-3"
                value={accountForm.libelle}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, libelle: e.target.value })
                }
              />
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
                <Label>Compte Tier (ex: 44111234)</Label>
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

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>IF (Identifiant Fiscal)</Label>
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

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Compte HT (Charge)</Label>
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
                  onValueChange={(v) =>
                    setTierForm({ ...tierForm, tvaAccount: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un compte" />
                  </SelectTrigger>
                  <SelectContent>
                    {tvaAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.code}>
                        {a.code} - {a.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

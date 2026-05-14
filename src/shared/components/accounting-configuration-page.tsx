'use client';

import { useEffect, useState } from "react";
import { BankOption } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/src/lib/logger";
import { api } from "@/lib/api";

type AccountingConfigRow = {
    id: number;
    journal: string;
    designation: string;
    banque: string;
    compteComptable: string;
    rib: string;
};

interface AccountingConfigurationPageProps {
    embedded?: boolean;
}

export function AccountingConfigurationPage({ embedded = false }: AccountingConfigurationPageProps) {
    const [supportedBanks, setSupportedBanks] = useState<BankOption[]>([]);
    const [accountingConfigs, setAccountingConfigs] = useState<AccountingConfigRow[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState<AccountingConfigRow | null>(null);
    const [form, setForm] = useState<Omit<AccountingConfigRow, "id">>({
        journal: "",
        designation: "",
        banque: "",
        compteComptable: "",
        rib: "",
    });

    useEffect(() => {
        const loadBankOptions = async () => {
            try {
                const data = await api.getBankOptions();
                const options = Array.isArray(data.options) ? data.options : [];
                setSupportedBanks(options.filter((opt) => opt.code !== "AUTO"));
            } catch (error) {
                logger.error("Failed to load bank options", error);
                setSupportedBanks([]);
            }
        };
        const loadConfigs = async () => {
            try {
                const rows = await api.getAccountingConfigs();
                setAccountingConfigs(Array.isArray(rows) ? rows as AccountingConfigRow[] : []);
            } catch (error) {
                logger.error("Failed to load accounting configs", error);
                setAccountingConfigs([]);
            }
        };
        loadBankOptions();
        loadConfigs();
    }, []);

    function openAdd() {
        setEditingConfig(null);
        setForm({
            journal: "",
            designation: "",
            banque: "",
            compteComptable: "",
            rib: "",
        });
        setIsDialogOpen(true);
    }

    function openEdit(row: AccountingConfigRow) {
        setEditingConfig(row);
        setForm({
            journal: row.journal,
            designation: row.designation,
            banque: row.banque,
            compteComptable: row.compteComptable,
            rib: row.rib,
        });
        setIsDialogOpen(true);
    }

    async function handleDelete(id: number) {
        try {
            await api.deleteAccountingConfig(id);
            setAccountingConfigs((prev) => prev.filter((row) => row.id !== id));
            toast.success("Configuration supprimée");
        } catch (error) {
            toast.error("Erreur lors de la suppression");
        }
    }

    async function handleSave() {
        if (
            !form.journal.trim() ||
            !form.designation.trim() ||
            !form.banque.trim() ||
            !form.compteComptable.trim() ||
            !form.rib.trim()
        ) {
            toast.error("Tous les champs sont obligatoires");
            return;
        }

        try {
            if (editingConfig) {
                const updated = await api.updateAccountingConfig(editingConfig.id, form);
                setAccountingConfigs((prev) =>
                    prev.map((row) => (row.id === editingConfig.id ? (updated as AccountingConfigRow) : row))
                );
                toast.success("Configuration mise a jour");
            } else {
                const created = await api.createAccountingConfig(form);
                setAccountingConfigs((prev) => [created as AccountingConfigRow, ...prev]);
                toast.success("Configuration ajoutee");
            }
            setIsDialogOpen(false);
        } catch (error) {
            toast.error("Erreur lors de l'enregistrement");
        }
    }

    return (
        <div className={embedded ? "space-y-6" : "space-y-6 p-6"}>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-semibold">Journal de trésorerie</CardTitle>
                    <Button onClick={openAdd}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Journal</TableHead>
                                <TableHead>Designation</TableHead>
                                <TableHead>Banque</TableHead>
                                <TableHead>Compte comptable</TableHead>
                                <TableHead>RIB</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accountingConfigs.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>{row.journal}</TableCell>
                                    <TableCell>{row.designation}</TableCell>
                                    <TableCell>{row.banque}</TableCell>
                                    <TableCell className="font-mono">{row.compteComptable}</TableCell>
                                    <TableCell className="font-mono">{row.rib}</TableCell>
                                    <TableCell className="text-right flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => handleDelete(row.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {accountingConfigs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        Aucun journal de trésorerie configuré
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingConfig ? "Modifier le journal de trésorerie" : "Ajouter un journal de trésorerie"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                            <Label>Journal</Label>
                            <Input
                                value={form.journal}
                                onChange={(e) => setForm((prev) => ({ ...prev, journal: e.target.value }))}
                                placeholder="Saisie manuelle"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Designation</Label>
                            <Input
                                value={form.designation}
                                onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))}
                                placeholder="Saisie manuelle"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Banque</Label>
                            <Select
                                value={form.banque}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, banque: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choisir une banque" />
                                </SelectTrigger>
                                <SelectContent>
                                    {supportedBanks.map((bank) => (
                                        <SelectItem key={bank.code} value={bank.code}>
                                            {bank.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {supportedBanks.length === 0 && (
                                <div className="text-sm text-muted-foreground">Aucune banque disponible</div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Compte comptable</Label>
                            <Input
                                value={form.compteComptable}
                                onChange={(e) => setForm((prev) => ({ ...prev, compteComptable: e.target.value }))}
                                placeholder="Saisie manuelle"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>RIB</Label>
                            <Input
                                value={form.rib}
                                onChange={(e) => setForm((prev) => ({ ...prev, rib: e.target.value }))}
                                placeholder="Saisie manuelle"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleSave}>Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

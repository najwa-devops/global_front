"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GeneralParamsService, DossierGeneralParams } from "@/src/api/services/general-params.service";
import { useAuth } from "@/hooks/use-auth";

const defaultForm: DossierGeneralParams = {
  companyName: "",
  address: "",
  legalForm: "",
  rcNumber: "",
  ifNumber: "",
  tsc: "",
  activity: "",
  category: "",
  professionalTax: "",
  cmRate: 0,
  isRate: 0,
  ice: "",
  cniOrResidenceCard: "",
  legalRepresentative: "",
  capital: null,
  subjectToRas: false,
  individualPerson: false,
  hasFiscalRegularityCertificate: false,
  allowValidatedDocumentDeletion: false,
  allowAccountedDocumentDeletion: false,
};

export function GeneralParamsPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DossierGeneralParams>(defaultForm);

  useEffect(() => {
    const load = async () => {
      try {
        const params = await GeneralParamsService.getParams();
        setForm({
          ...defaultForm,
          ...params,
          cmRate: params.cmRate ?? 0,
          isRate: params.isRate ?? 0,
        });
      } catch {
        toast.error("Erreur lors du chargement des parametres");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasDossier = useMemo(() => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem("currentDossierId");
    const id = Number(raw);
    return Number.isFinite(id) && id > 0;
  }, []);

  const onSave = async () => {
    if (!hasDossier) {
      toast.error("Dossier requis: ouvrez un dossier avant la sauvegarde.");
      return;
    }
    setSaving(true);
    try {
      const saved = await GeneralParamsService.saveParams(form);
      setForm((prev) => ({ ...prev, ...saved }));
      toast.success("Parametres enregistres");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const onText = (key: keyof DossierGeneralParams, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onNumber = (key: keyof DossierGeneralParams, value: string) => {
    const normalized = value.trim();
    setForm((prev) => ({
      ...prev,
      [key]: normalized === "" ? null : Number(normalized),
    }));
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Identifications</CardTitle>
          <CardDescription>Ces parametres sont enregistres par dossier.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName">Nom de la societe</Label>
              <Input
                id="companyName"
                value={form.companyName || ""}
                onChange={(e) => onText("companyName", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Textarea
                id="address"
                value={form.address || ""}
                onChange={(e) => onText("address", e.target.value)}
                disabled={loading}
                className="min-h-[88px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalForm">Forme juridique</Label>
              <Input
                id="legalForm"
                value={form.legalForm || ""}
                onChange={(e) => onText("legalForm", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity">Activite</Label>
              <Input
                id="activity"
                value={form.activity || ""}
                onChange={(e) => onText("activity", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rcNumber">R.C</Label>
              <Input
                id="rcNumber"
                value={form.rcNumber || ""}
                onChange={(e) => onText("rcNumber", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categorie</Label>
              <Input
                id="category"
                value={form.category || ""}
                onChange={(e) => onText("category", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ifNumber">I.F</Label>
              <Input
                id="ifNumber"
                value={form.ifNumber || ""}
                onChange={(e) => onText("ifNumber", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professionalTax">Taxe Prof.</Label>
              <Input
                id="professionalTax"
                value={form.professionalTax || ""}
                onChange={(e) => onText("professionalTax", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tsc">T.S.C</Label>
              <Input
                id="tsc"
                value={form.tsc || ""}
                onChange={(e) => onText("tsc", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ice">ICE</Label>
              <Input
                id="ice"
                value={form.ice || ""}
                onChange={(e) => onText("ice", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cmRate">Taux C.M %</Label>
              <Input
                id="cmRate"
                type="number"
                step="0.01"
                value={form.cmRate ?? ""}
                onChange={(e) => onNumber("cmRate", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cniOrResidenceCard">CNI / carte sejour</Label>
              <Input
                id="cniOrResidenceCard"
                value={form.cniOrResidenceCard || ""}
                onChange={(e) => onText("cniOrResidenceCard", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="isRate">Taux I.S %</Label>
              <Input
                id="isRate"
                type="number"
                step="0.01"
                value={form.isRate ?? ""}
                onChange={(e) => onNumber("isRate", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalRepresentative">Representant legal</Label>
              <Input
                id="legalRepresentative"
                value={form.legalRepresentative || ""}
                onChange={(e) => onText("legalRepresentative", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital">Capital</Label>
              <Input
                id="capital"
                type="number"
                step="0.01"
                value={form.capital ?? ""}
                onChange={(e) => onNumber("capital", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="subjectToRas"
                checked={Boolean(form.subjectToRas)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, subjectToRas: checked === true }))
                }
                disabled={loading}
              />
              <Label htmlFor="subjectToRas">Societe soumise a la RAS</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="individualPerson"
                checked={Boolean(form.individualPerson)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, individualPerson: checked === true }))
                }
                disabled={loading}
              />
              <Label htmlFor="individualPerson">Je suis une personne physique</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasFiscalRegularityCertificate"
                checked={Boolean(form.hasFiscalRegularityCertificate)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    hasFiscalRegularityCertificate: checked === true,
                  }))
                }
                disabled={loading}
              />
              <Label htmlFor="hasFiscalRegularityCertificate">
                Je dispose une attestation de regularite fiscale
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="allowValidatedDocumentDeletion"
                checked={Boolean(form.allowValidatedDocumentDeletion)}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    allowValidatedDocumentDeletion: checked === true,
                  }))
                }
                disabled={loading}
              />
              <Label htmlFor="allowValidatedDocumentDeletion">
                Suppression d&apos;un document déjà validé par le client
              </Label>
            </div>
            {isAdmin() && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allowAccountedDocumentDeletion"
                  checked={Boolean(form.allowAccountedDocumentDeletion)}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      allowAccountedDocumentDeletion: checked === true,
                    }))
                  }
                  disabled={loading}
                />
                <Label htmlFor="allowAccountedDocumentDeletion">
                  Suppression d&apos;un document déjà comptabilisé
                </Label>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={loading || saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


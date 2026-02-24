"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { Tier } from "@/lib/types";

interface TierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tier: Tier) => void;
  initialSearch?: string;
}

export function TierSelectionModal({
  isOpen,
  onClose,
  onSelect,
  initialSearch = "",
}: TierSelectionModalProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    if (isOpen) {
      loadTiers();
      setSearchQuery(initialSearch);
    }
  }, [isOpen, initialSearch]);

  async function loadTiers() {
    setIsLoading(true);
    try {
      const data = await api.getTiers(true); // Get only active tiers
      setTiers(data);
    } catch (error) {
      console.error("Error loading tiers:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTiers = useMemo(() => {
    if (!searchQuery) return tiers;
    const lower = searchQuery.toLowerCase();
    return tiers.filter(
      (t) =>
        t.libelle.toLowerCase().includes(lower) ||
        (t.ice && t.ice.toLowerCase().includes(lower)) ||
        (t.ifNumber && t.ifNumber.toLowerCase().includes(lower)) ||
        (t.tierNumber && t.tierNumber.toLowerCase().includes(lower)),
    );
  }, [tiers, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sélectionner un fournisseur existant</DialogTitle>
          <DialogDescription>
            Recherchez et sélectionnez un fournisseur pour le lier à cette
            facture.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, ICE, IF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Config TVA</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTiers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center h-24 text-muted-foreground"
                    >
                      Aucun fournisseur trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>
                        <div className="font-medium">{tier.libelle}</div>
                        <div className="text-xs text-muted-foreground">
                          {tier.ice
                            ? `ICE: ${tier.ice}`
                            : tier.ifNumber
                              ? `IF: ${tier.ifNumber}`
                              : "Non identifié"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {tier.displayAccount || tier.tierNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tier.hasTvaConfiguration ? (
                          <Badge variant="secondary" className="text-xs">
                            {tier.tvaDisplayFormat || "Configuré"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs text-center block w-8">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => onSelect(tier)}>
                          Sélectionner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

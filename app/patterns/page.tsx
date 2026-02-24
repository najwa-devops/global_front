"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { api } from "@/lib/api";
import type { DetectedFieldPattern, PatternStatistics } from "@/lib/types";
import { toast } from "sonner";
import { PatternCard } from "@/components/pattern-card";
import Link from "next/link";

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<DetectedFieldPattern[]>([]);
  const [filteredPatterns, setFilteredPatterns] = useState<
    DetectedFieldPattern[]
  >([]);
  const [statistics, setStatistics] = useState<PatternStatistics | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPatterns();
    loadStatistics();
  }, []);

  useEffect(() => {
    filterPatterns();
  }, [patterns, searchQuery, activeTab]);

  const loadPatterns = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAllPatterns();
      setPatterns(data);
    } catch (error) {
      console.error("Error loading patterns:", error);
      toast.error("Erreur lors du chargement des patterns");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await api.getPatternStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  };

  const filterPatterns = () => {
    let filtered = patterns;

    // Filter by status
    if (activeTab !== "all") {
      filtered = filtered.filter((p) => p.status.toLowerCase() === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.patternText.toLowerCase().includes(query) ||
          p.fieldLabel.toLowerCase().includes(query) ||
          p.fieldName.toLowerCase().includes(query) ||
          p.invoiceNumber?.toLowerCase().includes(query),
      );
    }

    setFilteredPatterns(filtered);
  };

  const handleApprove = async (patternId: number) => {
    try {
      await api.approvePattern(patternId);
      toast.success("Pattern approuvé");
      loadPatterns();
      loadStatistics();
    } catch (error) {
      console.error("Error approving pattern:", error);
      toast.error("Erreur lors de l'approbation");
    }
  };

  const handleReject = async (patternId: number) => {
    try {
      await api.rejectPattern(patternId);
      toast.success("Pattern rejeté");
      loadPatterns();
      loadStatistics();
    } catch (error) {
      console.error("Error rejecting pattern:", error);
      toast.error("Erreur lors du rejet");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Gestion des Patterns
            </h1>
            <p className="text-sm text-muted-foreground">
              Gérez les patterns détectés pour améliorer l'extraction
              automatique
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Patterns
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.totalPatterns}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.pendingPatterns}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approuvés</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.approvedPatterns}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taux d'approbation
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.approvalRate.toFixed(0)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par pattern, champ, ou facture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patterns List */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Tous ({patterns.length})</TabsTrigger>
              <TabsTrigger value="pending">
                En attente ({statistics?.pendingPatterns || 0})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approuvés ({statistics?.approvedPatterns || 0})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejetés ({statistics?.rejectedPatterns || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Chargement des patterns...
            </div>
          ) : filteredPatterns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun pattern trouvé
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPatterns.map((pattern) => (
                <PatternCard
                  key={pattern.patternId}
                  pattern={pattern}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

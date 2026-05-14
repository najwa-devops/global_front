"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { GeneralSettingsPage } from "@/components/general-settings-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountingConfigurationPage } from "@/components/accounting-configuration-page"
import { GeneralParamsPage } from "@/components/general-params-page"

function PageContent() {
    const [hasSelectedDossier, setHasSelectedDossier] = useState(false)
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState("global")

    useEffect(() => {
        if (typeof window === "undefined") return
        const raw = window.localStorage.getItem("currentDossierId")
        const dossierId = Number(raw)
        setHasSelectedDossier(Boolean(raw) && Number.isFinite(dossierId) && dossierId > 0)
    }, [])

    useEffect(() => {
        const requested = searchParams.get("tab")
        if (requested === "global" || requested === "accounting-config" || requested === "params") {
            setActiveTab(requested)
        }
    }, [searchParams])

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-[760px] grid-cols-3">
                    <TabsTrigger value="global">Parametres globaux</TabsTrigger>
                    <TabsTrigger value="accounting-config">Journal de trésorerie</TabsTrigger>
                    <TabsTrigger value="params">Parametres dossier</TabsTrigger>
                </TabsList>
                <TabsContent value="global" className="pt-2">
                    <GeneralSettingsPage />
                </TabsContent>
                <TabsContent value="accounting-config" className="pt-2">
                    <AccountingConfigurationPage embedded />
                </TabsContent>
                <TabsContent value="params" className="pt-2 space-y-3">
                    {!hasSelectedDossier && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Ouvrez un dossier pour modifier ses parametres ou revenir au tableau de bord dossier.
                        </div>
                    )}
                    <GeneralParamsPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function Page() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <PageContent />
        </Suspense>
    )
}

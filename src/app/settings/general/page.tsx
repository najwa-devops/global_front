"use client"

import { useEffect, useState } from "react"
import { GeneralSettingsPage } from "@/components/general-settings-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountingConfigurationPage } from "@/components/accounting-configuration-page"
import { GeneralParamsPage } from "@/components/general-params-page"

export default function Page() {
    const [hasSelectedDossier, setHasSelectedDossier] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return
        const raw = window.localStorage.getItem("currentDossierId")
        const dossierId = Number(raw)
        setHasSelectedDossier(Boolean(raw) && Number.isFinite(dossierId) && dossierId > 0)
    }, [])

    return (
        <div className="space-y-4">
            <Tabs defaultValue="global" className="w-full">
                <TabsList className={`grid w-full ${hasSelectedDossier ? "max-w-[760px] grid-cols-3" : "max-w-[520px] grid-cols-2"}`}>
                    <TabsTrigger value="global">Parametres globaux</TabsTrigger>
                    <TabsTrigger value="accounting-config">Configuration comptable</TabsTrigger>
                    {hasSelectedDossier && <TabsTrigger value="params">Params</TabsTrigger>}
                </TabsList>
                <TabsContent value="global" className="pt-2">
                    <GeneralSettingsPage />
                </TabsContent>
                <TabsContent value="accounting-config" className="pt-2">
                    <AccountingConfigurationPage embedded />
                </TabsContent>
                {hasSelectedDossier && (
                    <TabsContent value="params" className="pt-2">
                        <GeneralParamsPage />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}

"use client"

import { GeneralSettingsPage } from "@/components/general-settings-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountingConfigurationPage } from "@/components/accounting-configuration-page"

export default function Page() {
    return (
        <div className="space-y-4">
            <Tabs defaultValue="global" className="w-full">
                <TabsList className="grid w-full max-w-[520px] grid-cols-2">
                    <TabsTrigger value="global">Paramètres globaux</TabsTrigger>
                    <TabsTrigger value="accounting-config">Configuration comptable</TabsTrigger>
                </TabsList>
                <TabsContent value="global" className="pt-2">
                    <GeneralSettingsPage />
                </TabsContent>
                <TabsContent value="accounting-config" className="pt-2">
                    <AccountingConfigurationPage embedded />
                </TabsContent>
            </Tabs>
        </div>
    )
}

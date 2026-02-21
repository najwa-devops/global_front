"use client"

import { UploadBankPage } from "@/components/upload-bank-page"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"

export default function BankUploadPage() {
    const router = useRouter()

    const handleUpload = async (files: File[]) => {
        for (const file of files) {
            await api.uploadBankStatement(file)
        }
        router.push("/bank/list")
    }

    const handleViewBankStatement = () => {
        // This is handled via the list or after upload
    }

    return (
        <div className="container mx-auto py-6">
            <UploadBankPage
                onUpload={handleUpload}
                onViewBankStatement={handleViewBankStatement}
            />
        </div>
    )
}

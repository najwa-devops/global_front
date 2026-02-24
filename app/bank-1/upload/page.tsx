"use client";

import { UploadBankPage } from "@/components/upload-bank-page";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { getConfiguredBankCodes } from "@/lib/accounting-config-banks";

export default function BankUploadPage() {
  const router = useRouter();

  const handleUpload = async (files: File[], bankType?: string) => {
    const configuredBanks = await getConfiguredBankCodes();
    const effectiveBankType = bankType || configuredBanks[0] || "AUTO";
    const allowedBanks = configuredBanks;

    for (const file of files) {
      await api.uploadBankStatement(file, effectiveBankType, allowedBanks);
    }
    router.push("/bank/list");
  };

  const handleViewBankStatement = (_statement: any) => {
    // This is handled via the list or after upload
  };

  return (
    <div className="container mx-auto py-6">
      <UploadBankPage
        onUpload={handleUpload}
        onViewBankStatement={handleViewBankStatement}
      />
    </div>
  );
}

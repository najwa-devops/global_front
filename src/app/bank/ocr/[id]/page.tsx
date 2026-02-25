"use client";

import { use } from "react";
import BankOcrPageView from "@/src/features/bank/view/BankOcrPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BankOcrPage({ params }: PageProps) {
  const { id } = use(params);
  return <BankOcrPageView statementId={Number(id)} />;
}

"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function BankUploadPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/bank/list")
    }, [router])

    return null
}

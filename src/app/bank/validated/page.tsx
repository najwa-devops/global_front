"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function BankValidatedPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/bank/list?filter=validated")
    }, [router])

    return null
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function BankAccountedPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/bank/list?filter=accounted")
    }, [router])

    return null
}

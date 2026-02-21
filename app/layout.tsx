import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ClientLayout } from "@/components/client-layout"
import { QueryProvider } from "@/src/components/providers/query-provider"
import { AuthProvider } from "@/src/components/providers/auth-provider"
import { DossierProvider } from "@/src/contexts/dossier-context"
import "./globals.css"

export const metadata: Metadata = {
  title: "FactureOCR - Extraction intelligente de factures",
  description: "Application d'extraction automatique de donnees de factures par OCR",
  generator: "iboice.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <DossierProvider>
              <QueryProvider>
                <ClientLayout>
                  {children}
                </ClientLayout>
              </QueryProvider>
            </DossierProvider>
          </AuthProvider>
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

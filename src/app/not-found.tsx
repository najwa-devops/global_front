"use client"

import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-2rem)] w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col items-center justify-center px-4 py-10">
        <a
          target="_blank"
          rel="noopener noreferrer"
          className="group block w-full max-w-4xl rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-[0_0_32px_color-mix(in_oklab,var(--primary),transparent_82%)]"
        >
          <div className="row">
            <svg
              width="100%"
              height="auto"
              viewBox="0 0 1200 1200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_12px_24px_color-mix(in_oklab,var(--primary),transparent_84%)]"
            >
              <rect width="1200" height="1200" rx="24" fill="color-mix(in oklab, var(--background), white 4%)" />
              <circle cx="600" cy="600" r="250" fill="color-mix(in oklab, var(--primary), transparent 78%)" />
              <text
                className="digit-side"
                x="470"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="220"
                fontWeight="800"
                fill="color-mix(in oklab, var(--foreground), var(--primary) 22%)"
              >
                4
              </text>
              <text
                className="digit-zero"
                x="600"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="220"
                fontWeight="800"
                fill="color-mix(in oklab, var(--foreground), var(--primary) 22%)"
              >
                0
              </text>
              <text
                className="digit-side"
                x="730"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="220"
                fontWeight="800"
                fill="color-mix(in oklab, var(--foreground), var(--primary) 22%)"
              >
                4
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="42"
                fontWeight="600"
                fill="color-mix(in oklab, var(--muted-foreground), var(--foreground) 30%)"
              >
                Page introuvable
              </text>
            </svg>
          </div>
        </a>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">La page demandee n&apos;existe pas ou a ete deplacee.</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Retour Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Aller a l&apos;accueil
            </Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .digit-side,
        .digit-zero {
          transform-box: fill-box;
          transform-origin: center;
        }

        .digit-side {
          animation: nf-side 1.3s ease-in-out infinite alternate;
        }

        .digit-zero {
          animation: nf-zero 1.3s ease-in-out infinite alternate;
        }

        @keyframes nf-side {
          0% {
            transform: translateY(-14px);
          }
          100% {
            transform: translateY(14px);
          }
        }

        @keyframes nf-zero {
          0% {
            transform: translateY(14px);
          }
          100% {
            transform: translateY(-14px);
          }
        }
      `}</style>
    </div>
  )
}

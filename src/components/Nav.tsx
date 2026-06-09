'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/overview', label: '人效总览' },
  { href: '/signal', label: 'AI 投入诊断' },
  { href: '/decision', label: '决策推演' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-blue-500/40 bg-blue-500/10 text-sm font-bold text-blue-300">
            AI
          </span>
          <div>
            <div className="text-sm font-semibold tracking-wide text-zinc-50">AI 人效决策引擎</div>
            <div className="text-[11px] text-zinc-500">AI-Powered Human Capital ROI Engine</div>
          </div>
        </Link>

        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'rounded-md px-4 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                ].join(' ')}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'

const chapters = [
  { href: '/verdict', num: '01', label: '总体判断' },
  { href: '/divergence', num: '02', label: '分化地图' },
  { href: '/attribution', num: '03', label: '根因诊断' },
  { href: '/decision', num: '04', label: '决策推演' },
]

// 旧路由在新章节体系下的归属（高亮用）
const legacyMap: Record<string, string> = {
  '/overview': '/divergence',
  '/signal': '/attribution',
}

export function Nav() {
  const pathname = usePathname()
  const { dataSource, sourceName, resetUploadedData } = useAppData()
  const active = legacyMap[pathname] || pathname

  return (
    <nav className="sticky top-0 z-50 h-14 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-blue-500/40 bg-blue-500/10 text-xs font-bold text-blue-300">
            AI
          </span>
          <div>
            <div className="text-sm font-semibold tracking-wide text-zinc-50">AI 转型驾驶舱</div>
            <div className="text-[10px] tracking-wide text-zinc-600">AI Transformation Cockpit</div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {dataSource === 'uploaded' ? (
            <div className="flex max-w-[280px] items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              <span className="truncate">上传数据：{sourceName}</span>
              <button type="button" onClick={resetUploadedData} className="shrink-0 text-emerald-300 hover:text-white">
                恢复样例
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-0.5">
            {chapters.map((c, i) => {
              const isActive = active === c.href
              return (
                <div key={c.href} className="flex items-center">
                  {i > 0 && <span className="mx-1 h-px w-3 bg-zinc-800" />}
                  <Link
                    href={c.href}
                    className={[
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-blue-500/15 text-blue-300' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200',
                    ].join(' ')}
                  >
                    <span className={`text-[10px] font-bold tabular-nums ${isActive ? 'text-blue-400' : 'text-zinc-700'}`}>{c.num}</span>
                    {c.label}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

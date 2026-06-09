'use client'

import { MarkdownContent } from './MarkdownContent'

interface InsightPanelProps {
  insights: string | null
  isLoading: boolean
  title?: string
}

export function InsightPanel({ insights, isLoading, title = 'AI 自动诊断' }: InsightPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">基于数据自动分析生成</p>
        </div>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-300">
          Insight
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
        </div>
      ) : insights ? (
        <div className="space-y-3">
          <MarkdownContent content={insights} />
        </div>
      ) : (
        <p className="text-sm text-zinc-500">暂无洞察</p>
      )}
    </section>
  )
}

'use client'

/**
 * ui.tsx — design tokens 基础组件（设计方案 v2.1 §6 视觉语言）
 * 规则：界面 chrome 只用 zinc + 蓝 accent；语义色仅用于严重度/评级；
 * 大数字 tabular-nums；统一卡片样式；无 emoji 图标。
 */

import { ReactNode } from 'react'
import Link from 'next/link'

// ── 卡片 ──
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/60 ${className}`}>
      {children}
    </div>
  )
}

export function SectionHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
        {caption ? <p className="mt-0.5 text-xs text-zinc-500">{caption}</p> : null}
      </div>
      {right}
    </div>
  )
}

// ── 大数字 ──
export function BigNumber({ label, value, sub, tone = 'default' }: {
  label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' | 'warn'
}) {
  const toneCls = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-zinc-50'
  return (
    <Card className="px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className={`mt-1.5 text-[32px] font-bold leading-none tabular-nums ${toneCls}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-zinc-500">{sub}</div> : null}
    </Card>
  )
}

// ── 严重度 ──
export type Severity = 'high' | 'medium' | 'low' | 'none'

const SEV_META: Record<Severity, { dot: string; text: string; label: string }> = {
  high: { dot: 'bg-red-500', text: 'text-red-400', label: '高' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-400', label: '中' },
  low: { dot: 'bg-blue-400', text: 'text-blue-300', label: '低' },
  none: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: '正常' },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const m = SEV_META[severity]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

// ── 评级 ──
export function GradeBadge({ grade, label }: { grade: 'A' | 'B' | 'C'; label: string }) {
  const cls = grade === 'A'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    : grade === 'B'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      : 'border-red-500/40 bg-red-500/10 text-red-300'
  return (
    <div className={`flex flex-col items-center rounded-xl border px-5 py-3 ${cls}`}>
      <span className="text-3xl font-bold leading-none">{grade}</span>
      <span className="mt-1.5 text-xs text-zinc-400">{label}</span>
    </div>
  )
}

// ── 事实 vs 判断（双层视觉，v2.1 §9.1） ──
export function FactTag() {
  return <span className="rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">系统计算</span>
}
export function JudgmentTag() {
  return <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-300">AI 研判</span>
}

// ── 章节转场条 ──
export function ChapterTransition({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-900/40 px-6 py-4 transition-colors hover:border-blue-500/40"
    >
      <span className="text-sm text-zinc-400">{text}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-blue-400 group-hover:text-blue-300">
        {cta}
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  )
}

// ── 加载骨架 ──
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-800/60 ${className}`} />
}

// ── 免责标签（模拟数据） ──
export function SimulatedTag() {
  return (
    <span className="rounded border border-zinc-700/60 px-1.5 py-0.5 text-[10px] text-zinc-500" title="业务产出为脱敏模拟数据，用于验证产品链路；架构支持真实数据接入">
      产出为脱敏模拟
    </span>
  )
}

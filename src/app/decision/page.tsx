'use client'

import dynamic from 'next/dynamic'
import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'
import { getCriticalTalentList } from '@/lib/analytics'
import { DecisionResponse } from '@/lib/aiSchemas'
import {
  Card, SectionHeader, FactTag, JudgmentTag, Skeleton, CockpitTopbar, AiBriefing,
} from '@/components/ui'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

function DecisionInner() {
  const params = useSearchParams()
  const { projects, talentRisk, companySummary, isLoading } = useAppData()
  const [ai, setAi] = useState<DecisionResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [activeIntent, setActiveIntent] = useState('')
  const [freeInput, setFreeInput] = useState('')

  const fromProject = params.get('from')
  const cause = params.get('cause')
  const fromName = projects.find(p => p.id === fromProject)?.name

  const critical = useMemo(
    () => (projects.length > 0 ? getCriticalTalentList(talentRisk, projects) : []),
    [projects, talentRisk]
  )
  const criticalByProject = useMemo(() => {
    const m = new Map<string, number>()
    critical.forEach(c => m.set(c.project_name, (m.get(c.project_name) || 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [critical])
  const guardOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 24, right: 24, bottom: 48, left: 58 },
    tooltip: {
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#fafafa' },
      formatter: (params: { data: (number | string)[] }) => `<b>${params.data[3]}</b><br/>${params.data[4]}<br/>CR ${Number(params.data[1]).toFixed(2)}<br/>活跃 ${params.data[2]} 天`,
    },
    xAxis: { type: 'category', name: '项目', data: [...new Set(critical.map(item => item.project_name))], axisLabel: { color: '#94a3b8', rotate: 30 }, splitLine: { show: false } },
    yAxis: { name: '代理CR', min: 0.5, max: 1, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
    series: [{
      type: 'scatter',
      data: critical.map(item => [item.project_name, item.cr, item.active_days, item.id, item.role || '核心岗位']),
      symbolSize: (value: (number | string)[]) => Math.max(12, Math.min(40, Number(value[2]) * 1.2)),
      itemStyle: { color: '#f59e0b', opacity: 0.82 },
    }],
  }), [critical])

  const scenarios = useMemo(() => {
    const list: { label: string; intent: string }[] = []
    if (fromName) {
      list.push({
        label: `基于根因为 ${fromName} 出方案`,
        intent: `针对 ${fromName} 的诊断根因（${cause || '见根因诊断'}），制定提升 AI 使用效果的可执行方案`,
      })
    }
    list.push(
      { label: '提升待优化区 AI 效果', intent: '针对待优化区项目（AI投入高但人效未改善），制定提升 AI 使用效果的方案' },
      { label: '高潜力区 AI 加码', intent: '为高潜力区项目（人效好但AI渗透低）制定加码 AI 的策略；如果给它们的 AI 预算翻倍，用放大器标杆的经验推演预期回报' },
      { label: '方法迁移：标杆 → 落后', intent: '把已验证放大器项目的使用方法迁移到同岗位差距最大的落后部门，给出迁移方案' },
    )
    return list.slice(0, 4)
  }, [fromName, cause])

  async function runDecision(intent: string) {
    if (aiLoading) return
    setActiveIntent(intent)
    setAi(null)
    setAiLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'decision', message: intent }),
      })
      const json = await res.json()
      if (json.data?.action_cards) setAi(json.data)
    } catch { /* ai stays null */ }
    setAiLoading(false)
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 pb-24 pt-8">
      <CockpitTopbar />
      <header>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">04 · 决策推演</div>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-zinc-50">钱和人，接下来怎么投？</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          AI 基于诊断证据生成可执行方案——每张行动卡都有参照标杆与验证方式，触及关键人才时自动亮护栏。
        </p>
      </header>
      <AiBriefing title="推演要闻" prompt="基于决策推演页，给出预算动作与人才护栏的一句经营提醒" />

      {/* 保人名单（事实层，始终在场） */}
      <Card className="border-amber-500/25 p-5">
        <SectionHeader
          title={`人才护栏 · 保人名单 ${critical.length} 人`}
          caption="核心使用者（Power）× 薪酬倒挂（CR<0.9，代理口径）× 团队流失环境——任何方案动到他们都会被拦截"
          right={<FactTag />}
        />
        {isLoading ? (
          <Skeleton className="mt-3 h-64" />
        ) : critical.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">当前无满足三重风险条件的人员。</p>
        ) : (
          <div className="mt-4 grid grid-cols-[1fr_280px] gap-5">
            <ReactECharts option={guardOption} style={{ height: 280 }} />
            <div className="space-y-2">
              {criticalByProject.map(([name, n]) => (
                <div key={name} className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2">
                  <div className="flex justify-between gap-3 text-sm text-amber-100"><span>{name}</span><span>{n} 人</span></div>
                </div>
              ))}
              <p className="pt-2 text-xs leading-5 text-zinc-500"><JudgmentTag /> <span className="ml-1">任何预算动作触达这些人群时，方案必须优先保护额度与激励。</span></p>
            </div>
          </div>
        )}
      </Card>

      {/* 场景入口 */}
      <div>
        <SectionHeader title="场景推演（结构化方案生成）" caption="这里用于生成行动卡与护栏校验；自由追问请使用右侧 AI 对话坞" />
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {scenarios.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => runDecision(s.intent)}
              disabled={aiLoading}
              className={`rounded-xl border p-4 text-left text-sm transition-all disabled:opacity-50 ${
                activeIntent === s.intent
                  ? 'border-blue-500/60 bg-blue-500/10 text-blue-200'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-blue-500/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={freeInput}
            onChange={e => setFreeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && freeInput.trim()) runDecision(freeInput.trim()) }}
            placeholder="描述推演场景：例如「在不动核心人才的前提下，把低效 AI 投入转投高潜力区」…"
            className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => freeInput.trim() && runDecision(freeInput.trim())}
            disabled={aiLoading || !freeInput.trim()}
            className="h-11 rounded-lg bg-blue-500 px-6 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:opacity-40"
          >
            推演
          </button>
        </div>
      </div>

      {/* 结果区 */}
      {aiLoading ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm text-blue-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            AI 正在生成方案（检索标杆 · 校验护栏 · 量化影响）…
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-56" />)}
          </div>
        </Card>
      ) : ai ? (
        <div className="space-y-5">
          {/* 概述 + 护栏命中 */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[15px] leading-relaxed text-zinc-100">{ai.summary}</p>
              <div className="flex shrink-0 items-center gap-2">
                <JudgmentTag />
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                >
                  导出一页纸
                </button>
              </div>
            </div>
            {ai.guardrail_hits.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
                <div className="text-sm font-medium text-amber-300">⚠ 人才护栏命中</div>
                <ul className="mt-1.5 space-y-1">
                  {ai.guardrail_hits.map((h, i) => {
                    const name = projects.find(p => p.id === h.project_id)?.name || h.project_id
                    return (
                      <li key={i} className="text-xs leading-5 text-amber-200/80">
                        {name}：涉及 {h.count} 名保人名单成员——{h.note}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </Card>

          {/* 行动卡组 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {ai.action_cards.map((c, i) => (
              <Card key={i} className={`flex flex-col p-5 ${c.guardrail ? 'border-amber-500/30' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-blue-500/15 text-[11px] font-bold text-blue-300">
                    {i + 1}
                  </span>
                  {c.guardrail && (
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">护栏</span>
                  )}
                </div>
                <p className="mt-3 text-sm font-medium leading-snug text-zinc-100">{c.action}</p>
                <dl className="mt-4 flex-1 space-y-2.5 border-t border-zinc-800/80 pt-3 text-xs leading-5">
                  <div><dt className="text-zinc-600">影响范围</dt><dd className="text-zinc-300">{c.scope}</dd></div>
                  <div><dt className="text-zinc-600">量化影响</dt><dd className="font-medium tabular-nums text-zinc-200">{c.amount}</dd></div>
                  <RoiMiniBar amount={c.amount} />
                  <div><dt className="text-zinc-600">参照标杆</dt><dd className="text-emerald-400/90">{c.benchmark}</dd></div>
                  <div><dt className="text-zinc-600">验证方式</dt><dd className="text-zinc-300">{c.validation}</dd></div>
                  <div><dt className="text-zinc-600">风险</dt><dd className="text-zinc-400">{c.risk}</dd></div>
                  {c.guardrail && (
                    <div><dt className="text-amber-500/80">护栏提示</dt><dd className="text-amber-200/90">{c.guardrail}</dd></div>
                  )}
                </dl>
              </Card>
            ))}
          </div>

          {/* 推演（如有） */}
          {ai.simulation && (
            <Card className="border-blue-500/25 bg-gradient-to-br from-blue-500/[0.06] to-transparent p-5">
              <SectionHeader title="推演对比" caption="前后对比图 + AI 推演研判" right={<JudgmentTag />} />
              <div className="mt-3 grid grid-cols-[1fr_1fr] gap-5">
                <SimulationChart
                  avgProductivity={companySummary.avg_productivity}
                  aiToLaborRatio={companySummary.ai_to_labor_ratio}
                  criticalCount={critical.length}
                  actionCards={ai.action_cards}
                  guardrailHits={ai.guardrail_hits}
                />
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-200">{ai.simulation}</p>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="flex h-56 items-center justify-center">
          <div className="text-center">
            <div className="text-base font-medium text-zinc-400">选择场景开始推演</div>
            <p className="mt-2 max-w-md text-xs leading-5 text-zinc-600">
              AI 将输出 2-3 张行动卡：动作 · 影响 · 量化收益 · 参照标杆 · 验证方式 · 护栏检查，全部基于真实数据实时生成
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

function parseAmount(amount: string) {
  const match = amount.match(/(\d+(\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

function RoiMiniBar({ amount }: { amount: string }) {
  const value = parseAmount(amount)
  const width = Math.max(8, Math.min(100, value))
  return (
    <div>
      <dt className="text-zinc-600">ROI 预期</dt>
      <dd className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
        <span className="block h-full rounded-full bg-cyan-400" style={{ width: `${width}%` }} />
      </dd>
    </div>
  )
}

function SimulationChart({
  avgProductivity,
  aiToLaborRatio,
  criticalCount,
  actionCards,
  guardrailHits,
}: {
  avgProductivity: number
  aiToLaborRatio: number
  criticalCount: number
  actionCards: DecisionResponse['action_cards']
  guardrailHits: DecisionResponse['guardrail_hits']
}) {
  const amountSignal = actionCards
    .map(card => parseAmount(card.amount))
    .filter(value => value > 0)
  const avgSignal = amountSignal.length
    ? amountSignal.reduce((sum, value) => sum + value, 0) / amountSignal.length
    : actionCards.length
  const liftRate = Math.min(0.18, Math.max(0.03, avgSignal / 1000))
  const protectedCount = guardrailHits.reduce((sum, hit) => sum + hit.count, 0)
  const current = [
    Number(avgProductivity.toFixed(2)),
    Number((aiToLaborRatio * 100).toFixed(2)),
    criticalCount,
  ]
  const projected = [
    Number((avgProductivity * (1 + liftRate)).toFixed(2)),
    Number((aiToLaborRatio * 100 * (1 + Math.min(0.2, actionCards.length * 0.04))).toFixed(2)),
    Math.max(0, criticalCount - protectedCount),
  ]
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 24, right: 16, bottom: 34, left: 42 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#fafafa' },
    },
    legend: { top: 0, textStyle: { color: '#94a3b8' } },
    xAxis: { type: 'category', data: ['人效(×)', 'AI投入比(%)', '人才风险(人)'], axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
    series: [
      { name: '当前', type: 'bar', data: current, itemStyle: { color: '#475569', borderRadius: [4, 4, 0, 0] } },
      { name: '推演后', type: 'bar', data: projected, itemStyle: { color: '#22d3ee', borderRadius: [4, 4, 0, 0] } },
    ],
  }
  return <ReactECharts option={option} style={{ height: 260 }} />
}

export default function DecisionPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-40" /></div>}>
      <DecisionInner />
    </Suspense>
  )
}

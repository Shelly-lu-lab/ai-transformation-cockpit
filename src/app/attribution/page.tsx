'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'
import { buildAttributionEvidence, AttributionEvidence } from '@/lib/analytics'
import { AttributionResponse } from '@/lib/aiSchemas'
import { formatProductivity, formatRatio } from '@/lib/format'
import {
  Card, SectionHeader, SeverityBadge, Severity,
  FactTag, JudgmentTag, ChapterTransition, Skeleton, CockpitTopbar, AiBriefing,
} from '@/components/ui'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const quadrantLabel: Record<string, string> = {
  amplifier: 'AI 放大区',
  underperforming: '待优化区',
  high_potential: '高潜力区',
  low_base: '基础区',
}
const quadrantTone: Record<string, string> = {
  amplifier: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  underperforming: 'border-red-500/40 bg-red-500/10 text-red-300',
  high_potential: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  low_base: 'border-zinc-600/40 bg-zinc-700/20 text-zinc-400',
}

function severityScore(severity: Severity) {
  if (severity === 'high') return 90
  if (severity === 'medium') return 62
  if (severity === 'low') return 35
  return 12
}

function MiniStepChart({ step }: { step: AttributionEvidence['steps'][number] }) {
  const values = step.facts.map((fact, index) => ({
    name: fact.label.slice(0, 4),
    value: Math.max(1, Number((fact.value.match(/\d+(\.\d+)?/) || ['1'])[0])),
    itemStyle: { color: ['#22d3ee', '#3b82f6', '#f59e0b'][index % 3] },
  }))
  const option = step.key === 'model'
    ? { backgroundColor: 'transparent', series: [{ type: 'pie', radius: ['45%', '72%'], label: { show: false }, data: values }] }
    : {
        backgroundColor: 'transparent',
        grid: { top: 8, right: 10, bottom: 18, left: 28 },
        xAxis: { type: 'category', data: values.map(v => v.name), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.12)' } } },
        series: [{ type: step.key === 'attrition' ? 'bar' : 'line', smooth: true, data: values, barWidth: '45%', lineStyle: { color: '#22d3ee' }, itemStyle: { color: '#22d3ee' }, areaStyle: step.key === 'depth' ? { color: 'rgba(34,211,238,0.12)' } : undefined }],
      }
  return <ReactECharts option={option} style={{ height: 96 }} />
}

function RootCauseRadar({ evidence, ai }: { evidence: AttributionEvidence | null; ai: AttributionResponse | null }) {
  const steps = evidence?.steps || []
  const scores = steps.map(step => severityScore(ai?.steps.find(item => item.key === step.key)?.severity ?? step.severity))
  const option = {
    backgroundColor: 'transparent',
    radar: {
      indicator: [
        { name: '模型', max: 100 },
        { name: '人群', max: 100 },
        { name: '深度', max: 100 },
        { name: '流失', max: 100 },
        { name: '组织', max: 100 },
      ],
      axisName: { color: '#a1a1aa', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.18)' } },
      splitArea: { areaStyle: { color: ['rgba(15,23,42,0.35)', 'rgba(15,23,42,0.14)'] } },
    },
    series: [{ type: 'radar', data: [{ value: scores.length === 5 ? scores : [0, 0, 0, 0, 0], areaStyle: { color: 'rgba(245,158,11,0.16)' }, lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } }] }],
  }
  return <ReactECharts option={option} style={{ height: 220 }} />
}

function AttributionInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { projects, monthlyTrend, talentRisk, roleMatrix, isLoading } = useAppData()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ai, setAi] = useState<AttributionResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // URL 参数 / 默认项目（优先取待优化区 AI 投入最大的）
  useEffect(() => {
    if (projects.length === 0) return
    const fromUrl = params.get('id')
    if (fromUrl && projects.some(p => p.id === fromUrl)) {
      setSelectedId(fromUrl)
    } else if (!selectedId) {
      const target = [...projects]
        .filter(p => p.quadrant === 'underperforming')
        .sort((a, b) => b.ai_cost - a.ai_cost)[0] || projects[0]
      setSelectedId(target.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, params])

  const evidence: AttributionEvidence | null = selectedId
    ? buildAttributionEvidence(selectedId, projects, monthlyTrend, talentRisk, roleMatrix)
    : null

  // 选择项目 → 调 AI（带会话缓存）
  useEffect(() => {
    if (!selectedId || projects.length === 0) return
    setAi(null)
    setRevealed(0)

    const cacheKey = `attribution-${selectedId}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        setAi(data)
        startReveal()
        return
      }
    } catch { /* ignore */ }

    setAiLoading(true)
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'attribution', project_id: selectedId }),
    })
      .then(r => r.json())
      .then(json => {
        setAiLoading(false)
        if (json.data?.steps) {
          setAi(json.data)
          try { sessionStorage.setItem(cacheKey, JSON.stringify(json.data)) } catch { /* ignore */ }
          startReveal()
        } else {
          setAi(null)
          setRevealed(5)
        }
      })
      .catch(() => { setAiLoading(false); setRevealed(5) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, projects.length])

  function startReveal() {
    setRevealed(0)
    if (revealTimer.current) clearInterval(revealTimer.current)
    let n = 0
    revealTimer.current = setInterval(() => {
      n += 1
      setRevealed(n)
      if (n >= 6 && revealTimer.current) clearInterval(revealTimer.current)
    }, 450)
  }

  useEffect(() => () => { if (revealTimer.current) clearInterval(revealTimer.current) }, [])

  const project = evidence?.project

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 pb-24 pt-8">
      <CockpitTopbar />
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">03 · 根因诊断</div>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight text-zinc-50">
            为什么投了钱，人效没起来？
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">系统沿五条因果线逐步排查，AI 交叉研判根因——每一步都有证据。</p>
        </div>
        <select
          value={selectedId ?? ''}
          onChange={e => router.replace(`/attribution?id=${e.target.value}`)}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-blue-500"
        >
          {[...projects].sort((a, b) => a.productivity - b.productivity).map(p => (
            <option key={p.id} value={p.id}>
              {p.name} · {quadrantLabel[p.quadrant]} · 人效 {formatProductivity(p.productivity)}
            </option>
          ))}
        </select>
      </header>
      <AiBriefing title="诊断要闻" prompt="基于根因诊断页，给出当前项目最值得关注的一句根因要闻" />

      {isLoading || !project ? (
        <Skeleton className="h-24" />
      ) : (
        <Card className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xl font-semibold text-zinc-50">{project.name}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{project.type} · {project.headcount} 人</div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${quadrantTone[project.quadrant]}`}>
              {quadrantLabel[project.quadrant]}
            </span>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">人效</div>
              <div className="text-xl font-bold tabular-nums text-zinc-100">{formatProductivity(project.productivity)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">AI 强度</div>
              <div className="text-xl font-bold tabular-nums text-zinc-100">{formatRatio(project.ai_intensity)}</div>
            </div>
            {evidence?.benchmark && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-600">对照标杆</div>
                <div className="text-sm font-medium text-emerald-400">{evidence.benchmark.name}（人效 {formatProductivity(evidence.benchmark.productivity)}）</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {evidence ? (
        <Card className="p-5">
          <div className="grid grid-cols-5 gap-3">
            {evidence.steps.map((step, index) => {
              const aiStep = ai?.steps.find(s => s.key === step.key)
              const severity: Severity = aiStep?.severity ?? step.severity
              const visible = revealed > index || (!aiLoading && !ai)
              return (
                <div key={step.key} className={`relative rounded-xl border px-3 py-3 transition-all ${visible ? 'border-cyan-400/35 bg-cyan-400/5' : 'border-zinc-800 bg-zinc-950/40 opacity-50'}`}>
                  {index < evidence.steps.length - 1 ? <span className="absolute left-[calc(100%-0.75rem)] top-6 h-px w-6 bg-zinc-700" /> : null}
                  <div className="flex items-center justify-between">
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-zinc-700 text-[11px] font-bold text-zinc-400">{index + 1}</span>
                    <SeverityBadge severity={severity} />
                  </div>
                  <div className="mt-3 text-sm font-medium text-zinc-200">{step.title}</div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      {/* 五步推理链 */}
      <div className="space-y-3">
        {evidence?.steps.map((step, i) => {
          const aiStep = ai?.steps.find(s => s.key === step.key)
          const visible = revealed > i || (!aiLoading && !ai)
          const severity: Severity = aiStep?.severity ?? step.severity
          return (
            <div
              key={step.key}
              className={`transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
            >
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-md border border-zinc-700 text-[11px] font-bold text-zinc-500">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-zinc-100">{step.title}</span>
                  </div>
                  <SeverityBadge severity={severity} />
                </div>
                <div className="grid grid-cols-[1fr_1.2fr] divide-x divide-zinc-800/80">
                  {/* 左：事实 */}
                  <div className="space-y-2.5 px-5 py-4">
                    <FactTag />
                    {step.facts.map((f, j) => (
                      <div key={j} className="flex items-baseline justify-between gap-3">
                        <span className="text-xs text-zinc-500">{f.label}</span>
                        <span className="text-right">
                          <span className="text-sm font-semibold tabular-nums text-zinc-200">{f.value}</span>
                          {f.benchmark && <span className="ml-2 text-[11px] text-zinc-600">{f.benchmark}</span>}
                        </span>
                      </div>
                    ))}
                    <MiniStepChart step={step} />
                    <p className="border-t border-zinc-800/60 pt-2 text-xs leading-5 text-zinc-400">{step.finding}</p>
                  </div>
                  {/* 右：AI 研判 */}
                  <div className="px-5 py-4">
                    <JudgmentTag />
                    {aiLoading ? (
                      <div className="mt-2.5 space-y-2">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-4/5" />
                      </div>
                    ) : (
                      <p className="mt-2.5 text-sm leading-relaxed text-zinc-200">
                        {aiStep?.judgment || 'AI 研判暂不可用，参考左侧系统计算事实。'}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )
        })}
      </div>

      {/* 根因综合 */}
      <div className={`transition-all duration-500 ${revealed >= 6 || (!aiLoading && !ai) ? 'opacity-100' : 'opacity-0'}`}>
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/[0.07] to-transparent p-6">
          <div className="flex items-center justify-between">
            <SectionHeader title="根因综合" caption="AI 将五步证据交叉后的主要矛盾判断" />
            <div className="flex items-center gap-3">
              <JudgmentTag />
              {ai && (
                <span className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-500">
                  置信度 {ai.confidence === 'high' ? '高' : ai.confidence === 'medium' ? '中' : '低'}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[320px_1fr] gap-5">
            <RootCauseRadar evidence={evidence} ai={ai} />
            {aiLoading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
            ) : (
              <p className="text-[15px] leading-relaxed text-zinc-100">
                {ai?.root_cause || 'AI 根因综合暂不可用；请基于上方五步事实自行研判。'}
              </p>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/decision?from=${selectedId}&cause=${encodeURIComponent(ai?.root_cause?.slice(0, 120) || '')}`)}
              className="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              基于此根因生成方案 →
            </button>
          </div>
        </Card>
      </div>

      <ChapterTransition
        text="根因清楚了——接下来钱和人怎么调？"
        href={`/decision?from=${selectedId ?? ''}`}
        cta="04 决策推演"
      />
    </div>
  )
}

export default function AttributionPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-40" /></div>}>
      <AttributionInner />
    </Suspense>
  )
}

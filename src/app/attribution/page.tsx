'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'
import { buildAttributionEvidence, AttributionEvidence } from '@/lib/analytics'
import { AttributionResponse } from '@/lib/aiSchemas'
import { formatProductivity, formatRatio } from '@/lib/format'
import {
  Card, SectionHeader, SeverityBadge, Severity,
  FactTag, JudgmentTag, ChapterTransition, Skeleton,
} from '@/components/ui'

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

function AttributionInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { projects, monthlyTrend, talentRisk, roleMatrix, isLoading } = useAppData()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ai, setAi] = useState<AttributionResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const [followUp, setFollowUp] = useState('')
  const [followUpAnswer, setFollowUpAnswer] = useState<string | null>(null)
  const [followUpLoading, setFollowUpLoading] = useState(false)
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
    setFollowUpAnswer(null)

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

  async function askFollowUp() {
    const q = followUp.trim()
    if (!q || followUpLoading) return
    setFollowUpLoading(true)
    setFollowUpAnswer(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'drilldown', message: q, project_id: selectedId, chapter: 'attribution' }),
      })
      const json = await res.json()
      setFollowUpAnswer(json.data?.answer || json.answer || '未能生成回答。')
    } catch {
      setFollowUpAnswer('追问失败，请重试。')
    }
    setFollowUpLoading(false)
  }

  const project = evidence?.project

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-6 pb-24 pt-8">
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
          {aiLoading ? (
            <div className="mt-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
          ) : (
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-100">
              {ai?.root_cause || 'AI 根因综合暂不可用；请基于上方五步事实自行研判。'}
            </p>
          )}
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

      {/* 追问 */}
      <Card className="p-5">
        <SectionHeader title="追问 AI" caption="带着当前项目的全部证据上下文回答" />
        <div className="mt-3 flex gap-2">
          {['模型错配具体怎么个错法？', '和标杆的差距主要在哪个岗位？', '如果只能先做一件事，做什么？'].map(q => (
            <button
              key={q}
              type="button"
              onClick={() => { setFollowUp(q); }}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-blue-500/50 hover:text-blue-300"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') askFollowUp() }}
            placeholder="输入追问…"
            className="h-10 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={askFollowUp}
            disabled={followUpLoading}
            className="h-10 rounded-lg bg-zinc-800 px-4 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {followUpLoading ? '分析中…' : '追问'}
          </button>
        </div>
        {followUpAnswer && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <JudgmentTag />
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-200">{followUpAnswer}</p>
          </div>
        )}
      </Card>

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

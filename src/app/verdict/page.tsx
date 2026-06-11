'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'
import { buildVerdictInputs } from '@/lib/analytics'
import { VerdictResponse } from '@/lib/aiSchemas'
import { formatWan, formatProductivity } from '@/lib/format'
import {
  Card, SectionHeader, BigNumber, GradeBadge, SeverityBadge,
  JudgmentTag, FactTag, ChapterTransition, Skeleton, SimulatedTag,
} from '@/components/ui'

const CACHE_KEY = 'verdict-cache-v1'

export default function VerdictPage() {
  const router = useRouter()
  const { projects, monthlyTrend, talentRisk, isLoading, error } = useAppData()
  const [ai, setAi] = useState<VerdictResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiFailed, setAiFailed] = useState(false)
  const ran = useRef(false)

  const vi = projects.length > 0 ? buildVerdictInputs(projects, monthlyTrend, talentRisk) : null

  async function runVerdict(force = false) {
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) { setAi(JSON.parse(cached)); return }
      } catch { /* ignore */ }
    }
    setAiLoading(true)
    setAiFailed(false)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'verdict' }),
      })
      const json = await res.json()
      if (json.data?.grades) {
        setAi(json.data)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(json.data)) } catch { /* ignore */ }
      } else {
        setAiFailed(true)
      }
    } catch {
      setAiFailed(true)
    }
    setAiLoading(false)
  }

  useEffect(() => {
    if (projects.length > 0 && !ran.current) {
      ran.current = true
      runVerdict()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length])

  if (error) return <div className="mx-auto max-w-[1440px] p-6 text-red-300">数据加载失败：{error}</div>

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-6 pb-24 pt-8">
      <header>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">01 · 总体判断</div>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-zinc-50">
          这一年的 AI 转型，值不值？
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">AI 已扫描全部 27 个业务单元的投入、效率、产出与人才数据，结论先行。</p>
      </header>

      {/* 北极星指标带 */}
      {isLoading || !vi ? (
        <div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <BigNumber label="全公司人效" value={formatProductivity(vi.northStar.productivity)} sub="利润 ÷ (人力 + AI 投入)" />
          <BigNumber label="AI / 人力投入比" value={(vi.northStar.aiToLaborRatio * 100).toFixed(1) + '%'} sub="月度 AI 成本占人力成本" />
          <BigNumber label="月度业务产出" value={formatWan(vi.northStar.monthlyProfit)} sub={undefined} tone="default" />
          <BigNumber
            label="关键人才在险"
            value={String(vi.northStar.criticalTalentCount) + ' 人'}
            sub="核心使用者 × 薪酬倒挂 × 流失环境"
            tone={vi.northStar.criticalTalentCount > 20 ? 'bad' : vi.northStar.criticalTalentCount > 0 ? 'warn' : 'good'}
          />
        </div>
      )}
      <div className="-mt-6 flex justify-end"><SimulatedTag /></div>

      {/* 健康度总评 */}
      <Card className="p-6">
        <SectionHeader
          title="AI 转型健康度总评"
          caption="三个维度：钱花得值吗 · 效率撬动了吗 · 人扛得住吗"
          right={
            <div className="flex items-center gap-3">
              <JudgmentTag />
              <button
                type="button"
                onClick={() => runVerdict(true)}
                disabled={aiLoading}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-50"
              >
                {aiLoading ? '分析中…' : '重新分析'}
              </button>
            </div>
          }
        />
        {aiLoading ? (
          <div className="mt-5 space-y-4">
            <div className="flex gap-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-24" />)}</div>
            <Skeleton className="h-12" />
          </div>
        ) : ai ? (
          <div className="mt-5 flex items-start gap-6">
            <div className="flex shrink-0 gap-3">
              <GradeBadge grade={ai.grades.money} label="钱花得值吗" />
              <GradeBadge grade={ai.grades.efficiency} label="效率撬动了吗" />
              <GradeBadge grade={ai.grades.people} label="人扛得住吗" />
            </div>
            <p className="text-[15px] leading-relaxed text-zinc-200">{ai.overall}</p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-500">
            {aiFailed ? 'AI 研判暂不可用——下方系统计算事实不受影响，可点击"重新分析"重试。' : '等待数据加载…'}
          </div>
        )}

        {/* 事实层（系统计算，AI 失败时仍在） */}
        {vi && (
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
            <div className="text-xs leading-5 text-zinc-500">
              <FactTag /> <span className="ml-1">放大器已验证 {vi.moneyDim.amplifierConfirmed} 个 · 待优化 {vi.moneyDim.underperforming} 个（月烧 {formatWan(vi.moneyDim.underperformingAiCost)}）· 趋势↑ {vi.moneyDim.trendUpCount}/27</span>
            </div>
            <div className="text-xs leading-5 text-zinc-500">
              <FactTag /> <span className="ml-1">Power {vi.efficiencyDim.powerCount} 人撑起 {(vi.efficiencyDim.powerCostShare * 100).toFixed(0)}% 个人 AI 成本 · 低活跃项目 {vi.efficiencyDim.lowActiveProjects} 个</span>
            </div>
            <div className="text-xs leading-5 text-zinc-500">
              <FactTag /> <span className="ml-1">关键人才在险 {vi.peopleDim.criticalTalent.length} 人 · Power 已流失 {vi.peopleDim.totalPowerExits} 人</span>
            </div>
          </div>
        )}
      </Card>

      {/* AI 巡检发现 */}
      <div>
        <SectionHeader title="AI 巡检发现" caption="主动扫描全量数据后，最值得经营层关注的信号" right={<JudgmentTag />} />
        <div className="mt-4 space-y-3">
          {aiLoading ? (
            [0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)
          ) : ai && ai.findings.length > 0 ? (
            ai.findings.map((f, i) => (
              <Card
                key={i}
                className="group cursor-pointer p-5 transition-colors hover:border-blue-500/40"
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    const target = f.target_chapter === 'attribution' && f.target_project_id
                      ? `/attribution?id=${f.target_project_id}`
                      : `/${f.target_chapter}`
                    router.push(target)
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1"><SeverityBadge severity={f.severity} /></div>
                      <div>
                        <div className="text-[15px] font-medium leading-snug text-zinc-100">{f.title}</div>
                        <ul className="mt-2 space-y-1">
                          {f.evidence.map((e, j) => (
                            <li key={j} className="text-xs leading-5 text-zinc-500">· {e}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-600 transition-colors group-hover:text-blue-400">
                      查看详情 →
                    </span>
                  </div>
                </button>
              </Card>
            ))
          ) : (
            <Card className="p-5 text-sm text-zinc-500">
              {aiFailed ? 'AI 巡检暂不可用。' : '暂无发现。'}
            </Card>
          )}
        </div>
      </div>

      <ChapterTransition
        text="总评的背后，27 个业务单元的表现天差地别——钱到底花在哪成了、哪没成？"
        href="/divergence"
        cta="02 分化地图"
      />
    </div>
  )
}

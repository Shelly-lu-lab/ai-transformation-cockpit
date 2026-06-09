'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatPanel } from '@/components/ChatPanel'
import { InsightPanel } from '@/components/InsightPanel'
import { KPICard } from '@/components/KPICard'
import { useAppData } from '@/lib/DataProvider'
import { formatNumber, formatProductivity, formatRatio, formatWan } from '@/lib/format'
import { ProjectWithMetrics, Quadrant } from '@/lib/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const quadrantColor: Record<Quadrant, string> = {
  amplifier: '#22c55e',
  underperforming: '#ef4444',
  high_potential: '#3b82f6',
  low_base: '#71717a',
}

const quadrantLabel: Record<Quadrant, string> = {
  amplifier: 'AI 放大区',
  underperforming: '待优化区',
  high_potential: '高潜力区',
  low_base: '基础区',
}

type ChartPoint = [number, number, number, string, string, number, string]

function buildOverviewInsights(projects: ProjectWithMetrics[]) {
  if (projects.length === 0) return null
  const byProductivity = [...projects].sort((a, b) => b.productivity - a.productivity)
  const highPotential = projects.filter((project) => project.quadrant === 'high_potential')
  const underperforming = projects.filter((project) => project.quadrant === 'underperforming')
  const amplifier = projects.filter((project) => project.quadrant === 'amplifier')
  const underAiCost = underperforming.reduce((sum, project) => sum + project.ai_cost, 0)

  return [
    `**人效冠军：** ${byProductivity[0].name}，人效 ${formatProductivity(byProductivity[0].productivity)}，以 ${byProductivity[0].headcount} 人团队创造 ${formatWan(byProductivity[0].profit)} 利润。`,
    '',
    `**高潜力机会：** ${highPotential.length} 个项目人效高但 AI 渗透低——加码 AI 投入可能获得高回报。`,
    '',
    `**待优化预警：** ${underperforming.length} 个项目 AI 投入高但人效未达预期，累计 AI 投入 ${formatWan(underAiCost)}。`,
    '',
    `**AI 放大验证：** ${amplifier.length} 个项目处于放大区，AI 正在有效驱动人效提升。`,
  ].join('\n')
}

export default function OverviewPage() {
  const router = useRouter()
  const { projects, companySummary, isLoading, error } = useAppData()
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [aiInsights, setAiInsights] = useState<string | null>(null)
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false)

  const maxHeadcount = Math.max(...projects.map((project) => project.headcount), 1)
  const fallbackInsights = useMemo(() => buildOverviewInsights(projects), [projects])
  const diagnosisRan = useRef(false)

  // AI 自动诊断（仅在数据加载后运行一次）
  useEffect(() => {
    if (projects.length > 0 && !diagnosisRan.current) {
      diagnosisRan.current = true
      setAiInsightsLoading(true)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '', page: 'overview_auto_diagnosis' }),
        signal: controller.signal,
      })
        .then(res => res.json())
        .then(data => {
          clearTimeout(timeout)
          const answer = data.answer || ''
          if (answer.includes('系统配置异常') || answer.includes('分析异常') || answer.length < 20) {
            setAiInsights(null)
          } else {
            setAiInsights(answer)
          }
          setAiInsightsLoading(false)
        })
        .catch(() => {
          clearTimeout(timeout)
          setAiInsightsLoading(false)
        })
    }
  }, [projects.length])

  async function handleSend(message: string) {
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: 'overview' }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || '暂无分析结果' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '分析请求失败，请重试。' }])
    }
    setChatLoading(false)
  }

  const option = {
    backgroundColor: 'transparent',
    grid: { top: 28, right: 36, bottom: 56, left: 72 },
    legend: {
      bottom: 8,
      textStyle: { color: '#a1a1aa' },
      data: Object.values(quadrantLabel),
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#27272a',
      borderColor: '#3f3f46',
      textStyle: { color: '#fafafa' },
      formatter: (params: unknown) => {
        const data = (params as unknown as { data: ChartPoint }).data
        return [
          `<b>${data[3]}</b>`,
          `人数：${data[5]}`,
          `人效：${formatProductivity(Number(data[4]))}`,
          `AI 强度：${data[6]}`,
          `总投入：${formatWan(data[0])}`,
          `利润：${formatWan(data[1])}`,
        ].join('<br/>')
      },
    },
    xAxis: {
      name: '总投入',
      type: 'log',
      min: Math.max(1, Math.min(...projects.map(p => p.labor_cost + p.ai_cost)) * 0.7),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#a1a1aa', formatter: (value: number) => formatWan(value) },
      nameTextStyle: { color: '#a1a1aa' },
    },
    yAxis: {
      name: '利润',
      type: 'log',
      min: Math.max(1, Math.min(...projects.map(p => p.profit)) * 0.7),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#a1a1aa', formatter: (value: number) => formatWan(value) },
      nameTextStyle: { color: '#a1a1aa' },
    },
    series: Object.entries(quadrantLabel).map(([quadrant, label]) => ({
      name: label,
      type: 'scatter',
      data: projects
        .filter((project) => project.quadrant === quadrant)
        .map((project) => [
          project.labor_cost + project.ai_cost,
          project.profit,
          project.headcount,
          project.name,
          project.productivity,
          project.headcount,
          formatRatio(project.ai_intensity),
          project.id,
        ]),
      itemStyle: { color: quadrantColor[quadrant as Quadrant], opacity: 0.85 },
      symbolSize: (value: unknown) => {
        const point = value as ChartPoint
        return Math.max(20, Math.min(80, 20 + (point[2] / maxHeadcount) * 60))
      },
      emphasis: {
        scale: 1.1,
        label: { show: true, formatter: '{@[3]}', color: '#fafafa' },
      },
      markLine:
        quadrant === 'amplifier'
          ? {
              symbol: ['none', 'none'],
              lineStyle: { color: '#52525b', type: 'dashed' },
              label: { show: true, position: 'end', formatter: '平均人效线', color: '#71717a', fontSize: 10 },
              data: [
                [
                  { coord: [Math.max(1, Math.min(...projects.map(p => p.labor_cost + p.ai_cost)) * 0.8), Math.max(1, Math.min(...projects.map(p => p.labor_cost + p.ai_cost)) * 0.8 * companySummary.avg_productivity)] },
                  {
                    coord: [
                      Math.max(...projects.map((project) => project.labor_cost + project.ai_cost), 1),
                      Math.max(...projects.map((project) => project.labor_cost + project.ai_cost), 1) *
                        companySummary.avg_productivity,
                    ],
                  },
                ],
              ],
            }
          : undefined,
    })),
  }

  if (error) {
    return <div className="mx-auto max-w-[1440px] p-6 text-red-300">数据加载失败：{error}</div>
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 pb-44 pt-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">人效全景</h1>
          <p className="mt-1 text-sm text-zinc-400">投入、利润与 AI 强度的全局分布</p>
        </div>
        <div className="text-xs text-zinc-500">Demo Corp · 2026-04</div>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <KPICard label="业务单元数" value={isLoading ? '--' : formatNumber(companySummary.project_count)} sub="可点击下钻到价值信号" />
        <KPICard
          label="总人力+AI投入"
          value={isLoading ? '--' : formatWan(companySummary.total_labor_cost + companySummary.total_ai_cost)}
          sub={`AI/人力 ${formatRatio(companySummary.ai_to_labor_ratio)}`}
        />
        <KPICard label="总利润" value={isLoading ? '--' : formatWan(companySummary.total_profit)} sub="收入/利润为脱敏模拟" />
        <KPICard label="平均人效" value={isLoading ? '--' : formatProductivity(companySummary.avg_productivity)} sub="利润 ÷ 总投入" />
      </section>

      <section className="grid grid-cols-[1fr_360px] gap-4">
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">投入产出散点图</h2>
            <span className="text-xs text-zinc-500">气泡大小 = 人数</span>
          </div>
          {isLoading ? (
            <div className="h-[520px] animate-pulse rounded bg-zinc-800/60" />
          ) : (
            <ReactECharts
              option={option}
              style={{ height: 520 }}
              onEvents={{
                click: (params: { data?: unknown }) => {
                  const data = params.data as (ChartPoint & { 7?: string }) | undefined
                  const projectId = data?.[7]
                  if (projectId) router.push(`/signal?id=${projectId}`)
                },
              }}
            />
          )}
        </div>
        <InsightPanel insights={aiInsights || fallbackInsights} isLoading={isLoading || aiInsightsLoading} />
      </section>

      <section className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-300">AI 放大区</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-400">AI 投入高于中位数，且人效高于中位数。说明 AI 投入正在有效放大业务产出。</p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-red-300">待优化区</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-400">AI 投入高于中位数，但人效低于中位数。AI 投入尚未转化为产出提升，需诊断原因。</p>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-blue-300">高潜力区</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-400">人效高于中位数，但 AI 投入低于中位数。业务基础好，加码 AI 可能获得高回报。</p>
        </div>
        <div className="rounded-lg border border-zinc-600/20 bg-zinc-800/30 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">基础区</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-400">AI 投入和人效均低于中位数。需先诊断业务基本面，再考虑 AI 投入策略。</p>
        </div>
      </section>

      <ChatPanel
        quickButtons={[
          { label: '人效最高的项目', prompt: '哪个项目人效最高？' },
          { label: 'AI投入最大的', prompt: 'AI 投入最大的项目是谁？' },
          { label: '待优化区有哪些', prompt: '待优化区有哪些项目？' },
        ]}
        onSend={handleSend}
        messages={messages}
        isLoading={chatLoading}
      />
    </div>
  )
}

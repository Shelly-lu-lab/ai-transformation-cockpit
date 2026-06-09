'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { InsightPanel } from '@/components/InsightPanel'
import { RiskAlert } from '@/components/RiskAlert'
import { useAppData } from '@/lib/DataProvider'
import { getTalentRiskSummary } from '@/lib/calculations'
import { formatPercent, formatProductivity, formatRatio, formatWan } from '@/lib/format'
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

type QuadrantPoint = [number, number, string, string, Quadrant]

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid] || 0
}

function topEntries(record: Record<string, number>, limit = 3) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

function buildProjectInsight(project: ProjectWithMetrics) {
  const lines: string[] = []
  const perCapitaAi = project.ai_cost / Math.max(project.headcount, 1)

  // AI 投入与人效的核心判断
  if (project.quadrant === 'underperforming') {
    lines.push(`**人效信号：** 该项目 AI 强度 ${formatRatio(project.ai_intensity)}（高于中位数），但人效仅 ${formatProductivity(project.productivity)}（低于中位数）。AI 投入尚未有效转化为产出，需诊断原因。`)
  } else if (project.quadrant === 'high_potential') {
    lines.push(`**人效信号：** 该项目人效 ${formatProductivity(project.productivity)} 表现优秀，但 AI 渗透较低（强度 ${formatRatio(project.ai_intensity)}）。加码 AI 投入预期可进一步放大产出。`)
  } else if (project.quadrant === 'amplifier') {
    lines.push(`**人效信号：** AI 投入与人效正相关——AI 强度 ${formatRatio(project.ai_intensity)}，人效 ${formatProductivity(project.productivity)}，属于 AI 放大区标杆。`)
  } else {
    lines.push(`**人效信号：** AI 投入和人效均偏低，建议先诊断业务基本面后再决定 AI 投入策略。`)
  }

  // AI 使用深度
  lines.push(`**AI 使用深度：** 人均 AI 成本 ${formatWan(perCapitaAi)}/月，覆盖率 ${formatPercent(project.ai_penetration)}，月均活跃 ${project.avg_active_days.toFixed(1)} 天。Power 用户 ${project.power_user_profile.count} 人，占比 ${formatPercent(project.power_user_ratio)}。`)

  // 人才风险
  if (project.recent_turnover.power_user_exits > 0) {
    lines.push(`**人才风险：** 近期有 ${project.recent_turnover.power_user_exits} 名 Power 用户流失，AI 经验正在外流。需关注保留策略。`)
  } else if (project.recent_turnover.total_exits > 3) {
    lines.push(`**人才流动：** 近期离职 ${project.recent_turnover.total_exits} 人（被动 ${project.recent_turnover.involuntary_exits} 人），需监控是否影响产能。`)
  }

  return lines.join('\n\n')
}

export default function SignalPage() {
  const { projects, monthlyTrend, talentRisk, isLoading, error } = useAppData()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [insightLoading, setInsightLoading] = useState(true)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id')
    if (id) setSelectedProjectId(id)
  }, [])

  useEffect(() => {
    if (!selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id)
  }, [projects, selectedProjectId])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0]
  const selectedTrend = selectedProject
    ? monthlyTrend.filter((record) => record.project_id === selectedProject.id)
    : []
  const riskSummary = selectedProject
    ? getTalentRiskSummary(selectedProject.id, talentRisk)
    : { project_id: '', total: 0, power_users: 0, high_risk_count: 0, high_risk_profiles: [] }

  useEffect(() => {
    setInsightLoading(true)
    const timer = window.setTimeout(() => setInsightLoading(false), 700)
    return () => window.clearTimeout(timer)
  }, [selectedProjectId])

  async function handleSend(message: string) {
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: 'signal', selected_project_id: selectedProjectId }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || '暂无分析结果' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '分析请求失败，请重试。' }])
    }
    setChatLoading(false)
  }

  const medianProductivity = useMemo(() => median(projects.map((project) => project.productivity)), [projects])
  const medianAiIntensity = useMemo(() => median(projects.map((project) => project.ai_intensity)), [projects])

  const quadrantOption = {
    backgroundColor: 'transparent',
    grid: { top: 24, right: 24, bottom: 48, left: 54 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#27272a',
      borderColor: '#3f3f46',
      textStyle: { color: '#fafafa' },
      formatter: (params: unknown) => {
        const data = (params as unknown as { data: QuadrantPoint }).data
        return [`<b>${data[2]}</b>`, `AI 强度：${formatRatio(data[0])}`, `人效：${formatProductivity(data[1])}`, quadrantLabel[data[4]]].join('<br/>')
      },
    },
    xAxis: {
      name: 'AI强度',
      type: 'log',
      min: 0.005,
      max: Math.min(5, Math.max(...projects.map(p => p.ai_intensity)) * 1.2),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#a1a1aa', formatter: (value: number) => formatRatio(value) },
      nameTextStyle: { color: '#a1a1aa' },
    },
    yAxis: {
      name: '人效',
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#a1a1aa' },
      nameTextStyle: { color: '#a1a1aa' },
    },
    series: [
      {
        type: 'scatter',
        data: projects.map((project) => [
          project.ai_intensity,
          project.productivity,
          project.name,
          project.id,
          project.quadrant,
        ]),
        symbolSize: 18,
        itemStyle: {
          color: (params: unknown) => {
            const data = (params as { data: QuadrantPoint }).data
            return quadrantColor[data[4]]
          },
          opacity: 0.9,
        },
        markLine: {
          symbol: ['none', 'none'],
          lineStyle: { color: '#52525b', type: 'dashed' },
          label: { color: '#a1a1aa' },
          data: [{ xAxis: medianAiIntensity }, { yAxis: medianProductivity }],
        },
        emphasis: {
          scale: 1.35,
          label: { show: true, formatter: '{@[2]}', color: '#fafafa' },
        },
      },
    ],
  }

  const cumulativeAi = selectedTrend.reduce<number[]>((acc, record, index) => {
    acc[index] = (acc[index - 1] || 0) + record.ai_cost
    return acc
  }, [])

  const trendOption = {
    backgroundColor: 'transparent',
    grid: { top: 28, right: 58, bottom: 36, left: 58 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#27272a',
      borderColor: '#3f3f46',
      textStyle: { color: '#fafafa' },
    },
    legend: { top: 0, textStyle: { color: '#a1a1aa' } },
    xAxis: {
      type: 'category',
      data: selectedTrend.map((record) => record.month),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#a1a1aa' },
    },
    yAxis: [
      {
        type: 'value',
        name: 'AI累计',
        axisLabel: { color: '#a1a1aa', formatter: (value: number) => formatWan(value) },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        splitLine: { lineStyle: { color: '#27272a' } },
      },
      {
        type: 'value',
        name: '人效',
        axisLabel: { color: '#a1a1aa' },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'AI累计投入',
        type: 'line',
        smooth: true,
        areaStyle: { color: 'rgba(59, 130, 246, 0.18)' },
        itemStyle: { color: '#3b82f6' },
        data: cumulativeAi,
      },
      {
        name: '人效走势',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        itemStyle: { color: '#22c55e' },
        data: selectedTrend.map((record) => record.productivity),
      },
    ],
  }

  if (error) {
    return <div className="mx-auto max-w-[1440px] p-6 text-red-300">数据加载失败：{error}</div>
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 pb-44 pt-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">AI 价值信号</h1>
          <p className="mt-1 text-sm text-zinc-400">按 AI 强度、人效、岗位和人才护栏解释投入信号</p>
        </div>
        {selectedProject ? <div className="text-xs text-zinc-500">当前：{selectedProject.name}</div> : null}
      </header>

      <section className="grid grid-cols-[40fr_60fr] gap-4">
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">四象限矩阵</h2>
          {isLoading ? (
            <div className="h-[560px] animate-pulse rounded bg-zinc-800/60" />
          ) : (
            <ReactECharts
              option={quadrantOption}
              style={{ height: 560 }}
              onEvents={{
                click: (params: { data?: unknown }) => {
                  const data = params.data as QuadrantPoint | undefined
                  if (data?.[3]) setSelectedProjectId(data[3])
                },
              }}
            />
          )}
        </div>

        <div className="space-y-4">
          {selectedProject ? (
            <>
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-50">{selectedProject.name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">{selectedProject.type}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs text-zinc-950"
                    style={{ backgroundColor: quadrantColor[selectedProject.quadrant] }}
                  >
                    {quadrantLabel[selectedProject.quadrant]}
                  </span>
                </div>
                <div className="mt-4">
                  <ReactECharts option={trendOption} style={{ height: 260 }} />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_300px] gap-4">
                <InsightPanel insights={buildProjectInsight(selectedProject)} isLoading={insightLoading} />
                <RiskAlert
                  highRiskCount={riskSummary.high_risk_count}
                  powerUsers={riskSummary.power_users}
                  projectName={selectedProject.name}
                />
              </div>

              <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
                <h3 className="text-sm font-semibold text-zinc-100">项目画像</h3>
                <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                  <ProfileBlock title="团队结构" rows={topEntries(selectedProject.role_distribution, 4).map(([k, v]) => `${k} ${v}人`)} />
                  <ProfileBlock
                    title="AI 使用概况"
                    rows={[
                      `月 AI 总成本 ${formatWan(selectedProject.ai_cost)}`,
                      `人均 AI 成本 ${formatWan(selectedProject.ai_cost / Math.max(selectedProject.headcount, 1))}`,
                      `覆盖率 ${formatPercent(selectedProject.ai_penetration)}`,
                      `重度用户(Power) ${formatPercent(selectedProject.power_user_ratio)}`,
                    ]}
                  />
                  <ProfileBlock
                    title="流动与风险"
                    rows={[
                      `近期离职 ${selectedProject.recent_turnover.total_exits}人`,
                      `其中被动 ${selectedProject.recent_turnover.involuntary_exits}人`,
                      `Power用户流失 ${selectedProject.recent_turnover.power_user_exits}人`,
                      `高风险人才 ${riskSummary.high_risk_count}人`,
                    ]}
                  />
                  <ProfileBlock
                    title="敬业度"
                    rows={[
                      `总体 ${selectedProject.engagement_dimensions?.overall ?? '--'}`,
                      `职业发展 ${selectedProject.engagement_dimensions?.career_development ?? '--'}`,
                      `留任意愿 ${selectedProject.engagement_dimensions?.stay_intention ?? '--'}`,
                    ]}
                  />
                </div>
                <div className="mt-3 rounded-md bg-zinc-800/50 px-3 py-2 text-[11px] text-zinc-500">
                  <span className="text-zinc-400">术语说明：</span>
                  Power 用户 = 月 AI 成本 ≥ ¥7,000 且活跃 ≥ 20 天的深度使用者 ·
                  高风险人才 = Power 用户且薪酬竞争力 (CR) &lt; 0.9 ·
                  AI 强度 = AI 成本 ÷ 人力成本
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <ChatPanel
        quickButtons={[
          { label: '为什么人效低', prompt: '为什么这个项目人效低？' },
          { label: 'AI用在哪了', prompt: '这个项目 AI 主要用在哪些模型上？' },
          { label: '核心人才情况', prompt: '这个项目核心人才风险如何？' },
        ]}
        onSend={handleSend}
        messages={messages}
        isLoading={chatLoading}
      />
    </div>
  )
}

function ProfileBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="mt-3 space-y-1">
        {rows.map((row) => (
          <div key={row} className="text-sm text-zinc-300">
            {row}
          </div>
        ))}
      </div>
    </div>
  )
}

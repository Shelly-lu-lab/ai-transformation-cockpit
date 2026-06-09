'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { DecisionCard } from '@/components/DecisionCard'
import { useAppData } from '@/lib/DataProvider'
import { getTalentRiskSummary } from '@/lib/calculations'
import { formatProductivity, formatRatio, formatWan } from '@/lib/format'
import { ChatResponse, ProjectWithMetrics, Quadrant } from '@/lib/types'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const quadrantColor: Record<Quadrant, string> = {
  amplifier: '#22c55e',
  underperforming: '#ef4444',
  high_potential: '#3b82f6',
  low_base: '#71717a',
}

type DecisionCardData = NonNullable<ChatResponse['decision_card']>

function pickProjects(projects: ProjectWithMetrics[]) {
  const underperforming =
    [...projects].filter((project) => project.quadrant === 'underperforming').sort((a, b) => b.ai_cost - a.ai_cost)[0] ||
    [...projects].sort((a, b) => b.ai_cost - a.ai_cost)[0]
  const highPotential =
    [...projects].filter((project) => project.quadrant === 'high_potential').sort((a, b) => b.productivity - a.productivity)[0] ||
    [...projects].sort((a, b) => b.productivity - a.productivity)[0]
  const lowBase =
    [...projects].filter((project) => project.quadrant === 'low_base').sort((a, b) => b.labor_cost - a.labor_cost)[0] ||
    [...projects].sort((a, b) => b.labor_cost - a.labor_cost)[0]
  return { underperforming, highPotential, lowBase }
}

export default function DecisionPage() {
  const { projects, talentRisk, companySummary, isLoading } = useAppData()
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [decisionCard, setDecisionCard] = useState<DecisionCardData | null>(null)

  const selected = useMemo(() => pickProjects(projects), [projects])

  function buildMockDecision(message: string): DecisionCardData {
    const savingTarget = (companySummary.total_labor_cost * 0.1) || 0
    const highRisk = selected.underperforming
      ? getTalentRiskSummary(selected.underperforming.id, talentRisk).high_risk_profiles[0]
      : null

    return {
      title: message.includes('报告') ? '董事会 AI 转型复盘方案' : '保核心战力的 10% 成本优化方案',
      expected_saving: formatWan(savingTarget),
      productivity_delta: '+8% ~ +12%',
      actions: [
        {
          target: selected.underperforming?.name || '待优化项目',
          action: '将低产出的 AI 预算缩减 35%，保留 Power 用户必需模型额度。',
          impact: `释放约 ${formatWan((selected.underperforming?.ai_cost || 0) * 0.35)} AI 预算`,
        },
        {
          target: selected.lowBase?.name || '基础区项目',
          action: '冻结非核心岗位增补，通过自然减员吸收成本压力。',
          impact: `控制 ${selected.lowBase?.headcount || 0} 人团队的边际成本`,
        },
        {
          target: selected.highPotential?.name || '高潜力项目',
          action: '把节省资源转投高潜力区，优先增加开发/产品角色的 AI 工具供给。',
          impact: `当前人效 ${formatProductivity(selected.highPotential?.productivity || 0)}，具备加码验证价值`,
        },
      ],
      talent_guards: highRisk
        ? [
            {
              target: highRisk.id,
              role: highRisk.role || '核心岗位',
              reason: `CR=${highRisk.cr_value}，AI成本/工资=${formatRatio(highRisk.ai_cost_ratio)}，建议调薪或转岗锁定。`,
            },
          ]
        : [
            {
              target: selected.underperforming?.name || '待优化项目',
              role: 'Power 用户',
              reason: '未发现高风险人才，但预算调整前仍需保留关键 AI 使用者额度。',
            },
          ],
      evidence: [
        `${selected.underperforming?.name || '待优化项目'} AI 强度 ${formatRatio(selected.underperforming?.ai_intensity || 0)}，人效 ${formatProductivity(selected.underperforming?.productivity || 0)}`,
        `${selected.highPotential?.name || '高潜力项目'} 属于高潜力区，AI 加码优先级高`,
        `组合平均人效 ${formatProductivity(companySummary.avg_productivity)}，总 AI/人力占比 ${formatRatio(companySummary.ai_to_labor_ratio)}`,
      ],
    }
  }

  async function handleSend(message: string) {
    setMessages([{ role: 'user', content: message }])
    setChatLoading(true)
    setDecisionCard(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: 'decision' }),
      })
      const data = await res.json()
      if (data.decision_card) {
        setDecisionCard(data.decision_card)
      } else {
        // AI 没有返回结构化卡片，使用 mock 兜底
        setDecisionCard(buildMockDecision(message))
      }
      setMessages([
        { role: 'user', content: message },
        { role: 'assistant', content: data.answer || '方案已生成，请查看下方卡片。' },
      ])
      // TODO: handle data.warning for guardrail modal
    } catch {
      // API 失败时使用 mock 兜底
      const card = buildMockDecision(message)
      setDecisionCard(card)
      setMessages([
        { role: 'user', content: message },
        { role: 'assistant', content: '已切换至基础分析模式（AI 暂不可用）。' },
      ])
    }
    setChatLoading(false)
  }

  const miniOption = {
    backgroundColor: 'transparent',
    grid: { top: 12, right: 24, bottom: 28, left: 44 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#27272a',
      borderColor: '#3f3f46',
      textStyle: { color: '#fafafa' },
      formatter: (params: unknown) => {
        const data = (params as unknown as { data: [number, number, string, Quadrant] }).data
        return `${data[2]}<br/>投入：${formatWan(data[0])}<br/>利润：${formatWan(data[1])}`
      },
    },
    xAxis: {
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { show: false },
    },
    yAxis: {
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { show: false },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: 14,
        data: projects.map((project) => [project.labor_cost + project.ai_cost, project.profit, project.name, project.quadrant]),
        itemStyle: {
          color: (params: unknown) => {
            const data = (params as { data: [number, number, string, Quadrant] }).data
            return quadrantColor[data[3]]
          },
          opacity: 0.85,
        },
      },
    ],
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 py-5">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-50">决策推演台</h1>
        <p className="mt-1 text-sm text-zinc-400">描述你的决策意图，AI 基于数据生成可执行方案</p>
      </header>

      <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-100">快捷意图</div>
        <div className="flex gap-3">
          {[
            ['优化10%人力成本', '在保住核心产能前提下，优化 10% 人力成本'],
            ['AI预算再分配', '把待优化区的 AI 预算转投高潜力区'],
            ['生成董事会报告', '生成一份 AI 转型投资复盘报告给董事会'],
          ].map(([label, prompt]) => (
            <button
              key={label}
              type="button"
              onClick={() => handleSend(prompt)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-300 hover:border-blue-500/60 hover:text-blue-200"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="min-h-[430px] rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded bg-zinc-800" />
        ) : decisionCard ? (
          <DecisionCard {...decisionCard} onAdjust={() => setDecisionCard(null)} />
        ) : (
          <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 text-center">
            <div>
              <div className="text-lg font-semibold text-zinc-200">等待决策意图</div>
              <p className="mt-2 text-sm text-zinc-500">选择一个快捷意图，或在底部输入框描述目标和约束。</p>
            </div>
          </div>
        )}
      </section>

      {decisionCard ? (
        <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
          <div className="mb-2 text-sm font-semibold text-zinc-100">方案影响视图</div>
          <ReactECharts option={miniOption} style={{ height: 200 }} />
        </section>
      ) : null}

      <ChatPanel
        quickButtons={[
          { label: '优化10%成本', prompt: '在保住核心产能前提下，优化 10% 人力成本' },
          { label: '预算转投高潜', prompt: '把待优化区的 AI 预算转投高潜力区' },
          { label: '董事会报告', prompt: '生成一份 AI 转型投资复盘报告给董事会' },
        ]}
        onSend={handleSend}
        messages={messages}
        isLoading={chatLoading}
      />
    </div>
  )
}

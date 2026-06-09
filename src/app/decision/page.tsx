'use client'

import { useMemo, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { DecisionCard } from '@/components/DecisionCard'
import { MarkdownContent } from '@/components/MarkdownContent'
import { useAppData } from '@/lib/DataProvider'
import { getTalentRiskSummary } from '@/lib/calculations'
import { formatProductivity, formatRatio, formatWan } from '@/lib/format'
import { ChatResponse, ProjectWithMetrics } from '@/lib/types'


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
    setMessages(prev => [...prev, { role: 'user' as const, content: message }])
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
      }
      setMessages(prev => [...prev, { role: 'assistant' as const, content: data.answer || '推演完成。' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant' as const, content: '推演服务暂不可用，请稍后重试。' }])
    }
    setChatLoading(false)
  }


  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 pb-44 pt-5">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-50">决策推演</h1>
        <p className="mt-1 text-sm text-zinc-400">选择推演场景，AI 展示完整的分析过程和决策依据</p>
      </header>

      <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-100">推演场景</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['提升待优化区 AI 效果', '针对待优化区项目（AI投入高但人效低），分析原因并给出如何提升 AI 使用效果的具体方案'],
            ['高潜力区 AI 加码方案', '分析高潜力区项目（人效好但AI渗透低），推演加码 AI 投入的具体策略和预期回报'],
            ['为项目定制 AI 赋能', `针对 ${selected.underperforming?.name || '某个项目'} 制定 AI 赋能方案：岗位匹配、模型选型、使用深度提升策略`],
            ['AI 转型效果复盘', '基于当前数据，复盘整体 AI 转型效果：哪里有效、哪里待改善、下一步优先级'],
          ].map(([label, prompt]) => (
            <button
              key={label}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={chatLoading}
              className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-left transition-colors hover:border-blue-500/50 hover:bg-zinc-900 disabled:opacity-50"
            >
              <div className="text-sm font-medium text-zinc-200">{label}</div>
              <div className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{prompt.slice(0, 50)}...</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
        {chatLoading ? (
          <div className="space-y-4">
            <div className="text-sm font-medium text-blue-300">AI 正在推演中...</div>
            <div className="space-y-3">
              {['分析对象锁定', '当前状态诊断', '关键约束识别', '建议方案生成'].map((step, i) => (
                <div key={step} className="flex items-center gap-3 text-sm">
                  <div className={`h-2 w-2 rounded-full ${i < 2 ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                  <span className={i < 2 ? 'text-zinc-200' : 'text-zinc-600'}>{step}</span>
                </div>
              ))}
            </div>
            <div className="h-32 animate-pulse rounded bg-zinc-800/50" />
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-green-300">推演完成</span>
            </div>
            <div className="max-h-[600px] overflow-auto">
              {messages.filter(m => m.role === 'assistant').map((msg, i) => (
                <div key={i} className="prose prose-invert prose-sm max-w-none">
                  <MarkdownContent content={msg.content} />
                </div>
              ))}
            </div>
            {decisionCard && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <DecisionCard {...decisionCard} onAdjust={() => setDecisionCard(null)} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-center">
            <div>
              <div className="text-lg font-semibold text-zinc-300">选择推演场景开始分析</div>
              <p className="mt-2 text-sm text-zinc-500">AI 将展示完整的推理过程：诊断 → 约束 → 方案 → 风险提示</p>
            </div>
          </div>
        )}
      </section>

      <ChatPanel
        quickButtons={[
          { label: '某项目 AI 赋能', prompt: `为 ${selected.highPotential?.name || '项目'} 定制 AI 赋能方案` },
          { label: '提升 AI 使用深度', prompt: '分析哪些项目的 AI 使用深度偏低，应如何提升人均活跃天数和使用平台覆盖' },
          { label: '效果复盘总结', prompt: '基于所有项目数据，总结 AI 转型整体效果和下一步建议' },
        ]}
        onSend={handleSend}
        messages={messages}
        isLoading={chatLoading}
      />
    </div>
  )
}

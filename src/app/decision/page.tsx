'use client'

import { useMemo, useRef, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { ReasoningSteps, ReasoningStep, buildLocalReasoning } from '@/components/ReasoningSteps'
import { useAppData } from '@/lib/DataProvider'
import { ProjectWithMetrics } from '@/lib/types'

function pickProjects(projects: ProjectWithMetrics[]) {
  const underperforming =
    [...projects].filter((p) => p.quadrant === 'underperforming').sort((a, b) => b.ai_cost - a.ai_cost)[0] ||
    [...projects].sort((a, b) => b.ai_cost - a.ai_cost)[0]
  const highPotential =
    [...projects].filter((p) => p.quadrant === 'high_potential').sort((a, b) => b.productivity - a.productivity)[0] ||
    [...projects].sort((a, b) => b.productivity - a.productivity)[0]
  return { underperforming, highPotential }
}

interface ReasoningResult {
  steps: ReasoningStep[]
  relatedProjects: ProjectWithMetrics[]
  summary?: string
}

export default function DecisionPage() {
  const { projects, isLoading } = useAppData()
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [reasoning, setReasoning] = useState<ReasoningResult | null>(null)
  const [activeScenario, setActiveScenario] = useState<string>('')
  const resultRef = useRef<HTMLElement>(null)

  const selected = useMemo(() => pickProjects(projects), [projects])

  const scenarios = useMemo(() => [
    { label: '提升待优化区 AI 效果', prompt: '针对待优化区项目（AI投入高但人效低），分析原因并给出提升 AI 使用效果的方案', icon: '🔧' },
    { label: '高潜力区 AI 加码', prompt: '分析高潜力区项目（人效好但AI渗透低），推演加码 AI 投入的策略和预期回报', icon: '🚀' },
    { label: `${selected.underperforming?.name || '项目'} AI 赋能`, prompt: `针对 ${selected.underperforming?.name || '某项目'} 制定 AI 赋能方案：诊断使用现状、岗位匹配、提升策略`, icon: '🎯' },
    { label: 'AI 转型效果复盘', prompt: '复盘 AI 转型效果：放大区的成功因素、待优化区的改进方向、下一步优先级', icon: '📋' },
  ], [selected])

  async function handleSend(message: string) {
    setActiveScenario(message)
    setMessages([{ role: 'user' as const, content: message }])
    setChatLoading(true)
    setReasoning(null)

    // 用本地规则生成结构化推演（确保一定有好的展示，不依赖 AI）
    const localResult = buildLocalReasoning(message, projects)

    // 先立刻展示本地结果
    setReasoning(localResult)
    setChatLoading(false)
    setMessages(prev => [...prev, { role: 'assistant' as const, content: '推演完成。' }])
    // 自动滚动到结果区
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)

    // 然后异步尝试获取 AI 补充分析
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: 'decision' }),
      })
      const data = await res.json()
      const aiSummary = data.answer || ''
      if (aiSummary.length > 50) {
        setReasoning(prev => prev ? { ...prev, summary: aiSummary } : prev)
      }
    } catch {
      // AI 失败不影响已展示的结果
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 pb-44 pt-5">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-50">决策推演</h1>
        <p className="mt-1 text-sm text-zinc-400">选择推演场景，系统基于数据展示完整的推理链条和可视化分析</p>
      </header>

      {/* 场景选择 */}
      <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-100">推演场景</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {scenarios.map(({ label, prompt, icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={chatLoading}
              className={`rounded-lg border p-3 text-left transition-all disabled:opacity-50 ${
                activeScenario === prompt
                  ? 'border-blue-500/60 bg-blue-500/10'
                  : 'border-zinc-700 bg-zinc-950 hover:border-blue-500/40 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="text-sm font-medium text-zinc-200">{label}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 推演结果 */}
      <section ref={resultRef} className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-5">
        {chatLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              <span className="text-sm font-medium text-blue-300">AI 正在推演中...</span>
            </div>
            <div className="space-y-3">
              {['🎯 锁定分析对象', '📊 诊断当前状态', '⚠️ 识别关键约束', '💡 生成建议方案'].map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <div className={`h-6 w-6 rounded-full border text-center text-[11px] leading-6 ${
                    i < 2 ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-zinc-700 text-zinc-600'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-sm ${i < 2 ? 'text-zinc-200' : 'text-zinc-600'}`}>{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 h-40 animate-pulse rounded-lg bg-zinc-800/40" />
          </div>
        ) : reasoning ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-sm font-medium text-green-300">推演完成</span>
              </div>
              <button
                type="button"
                onClick={() => { setReasoning(null); setActiveScenario('') }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                清除重来
              </button>
            </div>

            {/* 结构化推演步骤 + 图表 */}
            <ReasoningSteps steps={reasoning.steps} relatedProjects={reasoning.relatedProjects} />

            {/* AI 补充总结（如果有） */}
            {reasoning.summary && (
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-950 p-4">
                <div className="mb-2 text-xs font-medium text-zinc-400">AI 补充分析</div>
                <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">
                  {reasoning.summary.replace(/```json\n?[\s\S]*?```/g, '').replace(/[{}"]/g, '').replace(/\\n/g, '\n').trim().slice(0, 800)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-center">
            <div>
              <div className="text-3xl text-zinc-700">📐</div>
              <div className="mt-3 text-lg font-semibold text-zinc-300">选择推演场景</div>
              <p className="mt-2 max-w-sm text-sm text-zinc-500">
                系统将基于真实数据，按步骤展示：分析对象 → 现状诊断 → 约束识别 → 建议方案，每步附可视化数据支撑
              </p>
            </div>
          </div>
        )}
      </section>

      <ChatPanel
        quickButtons={[
          { label: '某项目 AI 赋能', prompt: `为 ${selected.highPotential?.name || '项目'} 定制 AI 赋能方案` },
          { label: '提升使用深度', prompt: '分析哪些项目 AI 使用深度偏低，应如何提升' },
          { label: '复盘总结', prompt: '基于所有项目数据，总结 AI 转型效果和下一步建议' },
        ]}
        onSend={handleSend}
        messages={messages}
        isLoading={chatLoading}
      />
    </div>
  )
}

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { DecisionCard } from '@/components/DecisionCard'
import { ReasoningSteps, ReasoningStep, buildLocalReasoning } from '@/components/ReasoningSteps'
import { useAppData } from '@/lib/DataProvider'
import { getTalentRiskSummary } from '@/lib/calculations'
import { formatProductivity, formatRatio, formatWan } from '@/lib/format'
import { ChatResponse, ProjectWithMetrics, TalentRecord } from '@/lib/types'
import { buildDecisionContext } from '@/lib/buildContext'

type DecisionCardData = NonNullable<ChatResponse['decision_card']>
type VisualChange = NonNullable<DecisionCardData['visual_changes']>[number]
type ImpactPoint = [number, number, number, string, string, VisualChange['change_type'] | 'none']

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

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
  decisionCard: DecisionCardData
  guardSummary: {
    projectName: string
    highRiskCount: number
    powerUsers: number
  }
  summary?: string
}

function buildDeepLinkPrompt(project: ProjectWithMetrics, intent: string | null) {
  if (intent === 'growth' || project.quadrant === 'high_potential') {
    return `针对 ${project.name} 生成高潜力区 AI 加码方案：识别优先岗位、预算增量、验证周期和人才护栏`
  }
  if (intent === 'benchmark' || project.quadrant === 'amplifier') {
    return `复盘 ${project.name} 的 AI 放大效果：提炼可复制经验，并生成向其他项目迁移的方案`
  }
  if (intent === 'baseline' || project.quadrant === 'low_base') {
    return `针对 ${project.name} 生成基础区 AI 试点方案：先锁定核心流程和关键岗位，避免平均摊派预算`
  }
  return `针对 ${project.name} 生成待优化区 AI 预算优化方案：保留核心 Power 用户，缩减低效消耗，并给出三个月观察指标`
}

function buildLocalDecisionCard(
  message: string,
  projects: ProjectWithMetrics[],
  talentRisk: TalentRecord[],
  preferredProjectId?: string
) {
  const selected = pickProjects(projects)
  const preferredProject = preferredProjectId ? projects.find((project) => project.id === preferredProjectId) : undefined
  const isGrowthScenario = message.includes('加码') || message.includes('高潜力') || preferredProject?.quadrant === 'high_potential'
  const isBenchmarkScenario = message.includes('复盘') || preferredProject?.quadrant === 'amplifier'
  const isBaselineScenario = message.includes('试点') || preferredProject?.quadrant === 'low_base'
  const isInvestScenario = isGrowthScenario || isBenchmarkScenario || isBaselineScenario
  const target = preferredProject || (isGrowthScenario ? selected.highPotential : selected.underperforming) || projects[0]
  const growthTarget = isInvestScenario
    ? target
    : selected.highPotential || projects.find((project) => project.id !== target?.id) || target
  const averageProductivity = projects.reduce((sum, project) => sum + project.productivity, 0) / Math.max(projects.length, 1)
  const riskSummary = target
    ? getTalentRiskSummary(target.id, talentRisk)
    : { project_id: '', total: 0, power_users: 0, high_risk_count: 0, high_risk_profiles: [] }
  const releasedBudget = target ? target.ai_cost * 0.35 : 0
  const targetBelowAverage = target ? target.productivity < averageProductivity : false
  const firstAction = isInvestScenario
    ? {
        target: target?.name || '目标项目',
        action: isBaselineScenario ? '启动小范围 AI 试点，先覆盖 1-2 个高频流程，暂不做平均预算铺开。' : '追加受控 AI 预算，优先覆盖高产出岗位和已验证的 Power 用户工作流。',
        impact: `以 ${formatProductivity(target?.productivity || 0)} 当前人效作为验证基线`,
      }
    : {
        target: target?.name || '待优化项目',
        action: '缩减低效 AI 消耗 35%，冻结非 Power 用户的高价模型扩张。',
        impact: `预计释放 ${formatWan(releasedBudget)} 月度预算`,
      }

  const decisionCard: DecisionCardData = {
    title: isBenchmarkScenario ? 'AI 放大区经验复盘与迁移方案' : isGrowthScenario ? '高潜力项目 AI 加码验证方案' : isBaselineScenario ? '基础区 AI 小步试点方案' : '保核心战力的 AI 预算重配方案',
    expected_saving: isInvestScenario ? '预算增量受控' : `${formatWan(releasedBudget)}/月`,
    productivity_delta: targetBelowAverage ? '+8% ~ +12%' : '+5% ~ +8%',
    actions: [
      firstAction,
      {
        target: target?.name || '待优化项目',
        action: '保留 Power 用户和关键岗位的高阶模型额度，避免把有效产能一起切掉。',
        impact: `保护 ${riskSummary.power_users} 名 Power 用户的生产力供给`,
      },
      {
        target: growthTarget?.name || '高潜力项目',
        action: isInvestScenario ? '沉淀岗位工作流和模型选型规则，作为跨项目复制样板。' : '把释放预算转投高潜力区，优先覆盖技术研发/产品等高产出岗位。',
        impact: `当前人效 ${formatProductivity(growthTarget?.productivity || 0)}，具备验证价值`,
      },
      {
        target: '经营复盘机制',
        action: '设置 3 个月观察点，跟踪 AI 活跃天数、Power 用户占比和人效变化。',
        impact: '避免一次性预算调整，改为可回滚的投资实验',
      },
    ],
    talent_guards: riskSummary.high_risk_profiles.length > 0
      ? riskSummary.high_risk_profiles.slice(0, 3).map((profile) => ({
          target: profile.id,
          role: profile.role || '核心岗位',
          reason: `Power 用户且 CR=${profile.cr_value}，活跃 ${profile.active_days} 天，预算调整时必须排除在缩减名单外。`,
        }))
      : [
          {
            target: target?.name || '目标项目',
            role: 'Power 用户',
            reason: '未发现高风险 Power 用户，但仍需保留关键使用者的模型额度和学习曲线。',
          },
        ],
    evidence: [
      `${target?.name || '目标项目'} 当前象限为 ${target?.quadrant || '--'}，AI 强度 ${formatRatio(target?.ai_intensity || 0)}，人效 ${formatProductivity(target?.productivity || 0)}`,
      `${growthTarget?.name || '目标项目'} 人效 ${formatProductivity(growthTarget?.productivity || 0)}，适合作为本次方案的验证对象`,
      `人才护栏扫描：${riskSummary.high_risk_count} 名高风险核心人才，${riskSummary.power_users} 名 Power 用户`,
    ],
    visual_changes: [
      ...(target && !isInvestScenario ? [{ project_id: target.id, change_type: 'shrink' as const }] : []),
      ...(growthTarget ? [{ project_id: growthTarget.id, change_type: 'grow' as const }] : []),
      ...(riskSummary.high_risk_count > 0 && target ? [{ project_id: target.id, change_type: 'highlight_risk' as const }] : []),
    ],
  }

  return {
    decisionCard,
    guardSummary: {
      projectName: target?.name || '目标项目',
      highRiskCount: riskSummary.high_risk_count,
      powerUsers: riskSummary.power_users,
    },
  }
}

export default function DecisionPage() {
  const { projects, talentRisk, isLoading, dataSource } = useAppData()
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [reasoning, setReasoning] = useState<ReasoningResult | null>(null)
  const [activeScenario, setActiveScenario] = useState<string>('')
  const resultRef = useRef<HTMLElement>(null)
  const autoRunRef = useRef(false)

  const selected = useMemo(() => pickProjects(projects), [projects])

  const scenarios = useMemo(() => [
    { label: '保核心战力降本', prompt: '在不误伤核心 Power 用户前提下，优化待优化区 AI 预算并释放资源', icon: '01' },
    { label: '高潜力区加码', prompt: '分析高潜力区项目（人效好但AI渗透低），推演加码 AI 投入的策略和预期回报', icon: '02' },
    { label: `${selected.underperforming?.name || '项目'} AI 赋能`, prompt: `针对 ${selected.underperforming?.name || '某项目'} 制定 AI 赋能方案：诊断使用现状、岗位匹配、提升策略`, icon: '03' },
    { label: '董事会复盘', prompt: '复盘 AI 转型效果：放大区的成功因素、待优化区的改进方向、下一步优先级', icon: '04' },
  ], [selected])

  async function handleSend(message: string, preferredProjectId?: string) {
    setActiveScenario(message)
    setMessages([{ role: 'user' as const, content: message }])
    setChatLoading(true)
    setReasoning(null)

    // 用本地规则生成结构化推演（确保一定有好的展示，不依赖 AI）
    const localResult = buildLocalReasoning(message, projects, preferredProjectId)
    const localDecision = buildLocalDecisionCard(message, projects, talentRisk, preferredProjectId)

    // 先立刻展示本地结果
    setReasoning({ ...localResult, ...localDecision })
    setChatLoading(false)
    setMessages(prev => [...prev, { role: 'assistant' as const, content: '推演完成。' }])
    // 自动滚动到结果区
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)

    // 然后异步尝试获取 AI 补充分析
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          page: 'decision',
          selected_project_id: preferredProjectId,
          client_context: dataSource === 'uploaded' ? buildDecisionContext(projects, talentRisk) : undefined,
        }),
      })
      const data = await res.json()
      const aiSummary = data.answer || ''
      if (aiSummary.length > 50 || data.decision_card) {
        setReasoning(prev => prev ? {
          ...prev,
          summary: aiSummary.length > 50 ? aiSummary : prev.summary,
          decisionCard: data.decision_card || prev.decisionCard,
        } : prev)
      }
    } catch {
      // AI 失败不影响已展示的结果
    }
  }

  useEffect(() => {
    if (autoRunRef.current || isLoading || projects.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const projectId = params.get('project')
    const intent = params.get('intent')
    if (!projectId && !intent) return

    const project = projects.find((item) => item.id === projectId) || projects[0]
    if (!project) return

    autoRunRef.current = true
    void handleSend(buildDeepLinkPrompt(project, intent), project.id)
  }, [isLoading, projects])

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-6 pb-44 pt-5">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-50">决策推演</h1>
        <p className="mt-1 text-sm text-zinc-400">选择经营目标，系统生成预算动作、人才护栏和证据链</p>
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
              disabled={chatLoading || isLoading || projects.length === 0}
              className={`rounded-lg border p-3 text-left transition-all disabled:opacity-50 ${
                activeScenario === prompt
                  ? 'border-blue-500/60 bg-blue-500/10'
                  : 'border-zinc-700 bg-zinc-950 hover:border-blue-500/40 hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">{icon}</span>
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
              {['锁定分析对象', '诊断当前状态', '识别关键约束', '生成建议方案'].map((step, i) => (
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

            <GuardrailBanner guardSummary={reasoning.guardSummary} />

            <ImpactView projects={projects} visualChanges={reasoning.decisionCard.visual_changes || []} />

            <DecisionCard
              {...reasoning.decisionCard}
              onAdjust={() => {
                setReasoning(null)
                setActiveScenario('')
              }}
            />

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
              <div className="mx-auto h-8 w-8 rounded border border-zinc-700 bg-zinc-900" />
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

function ImpactView({ projects, visualChanges }: { projects: ProjectWithMetrics[]; visualChanges: VisualChange[] }) {
  const changeByProject = new Map(visualChanges.map((change) => [change.project_id, change.change_type]))
  const maxHeadcount = Math.max(...projects.map((project) => project.headcount), 1)
  const impactProjects = projects.filter((project) => changeByProject.has(project.id))
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 22, right: 24, bottom: 36, left: 56 },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#27272a',
      borderColor: '#3f3f46',
      textStyle: { color: '#fafafa' },
      formatter: (params: unknown) => {
        const data = (params as { data: ImpactPoint }).data
        const action = data[5] === 'shrink' ? '缩减预算' : data[5] === 'grow' ? '加码验证' : data[5] === 'highlight_risk' ? '人才护栏' : '观察'
        return [`<b>${data[3]}</b>`, `动作：${action}`, `AI 强度：${formatRatio(data[0])}（AI成本/人力成本）`, `人效：${formatProductivity(data[1])}`, `人数：${data[2]}`].join('<br/>')
      },
    },
    xAxis: {
      name: 'AI强度(AI/人力)',
      type: 'log',
      min: 0.005,
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
        name: '项目组合',
        type: 'scatter',
        data: projects.map((project) => {
          const changeType = changeByProject.get(project.id) || 'none'
          return [project.ai_intensity, project.productivity, project.headcount, project.name, project.id, changeType]
        }),
        symbolSize: (value: unknown) => {
          const point = value as ImpactPoint
          const changed = point[5] !== 'none'
          return Math.max(changed ? 22 : 12, Math.min(changed ? 54 : 28, 12 + (point[2] / maxHeadcount) * 42))
        },
        itemStyle: {
          color: (params: unknown) => {
            const data = (params as { data: ImpactPoint }).data
            if (data[5] === 'shrink') return '#ef4444'
            if (data[5] === 'grow') return '#22c55e'
            if (data[5] === 'highlight_risk') return '#f59e0b'
            return '#52525b'
          },
          opacity: (params: unknown) => {
            const data = (params as { data: ImpactPoint }).data
            return data[5] === 'none' ? 0.35 : 0.95
          },
          borderColor: (params: unknown) => {
            const data = (params as { data: ImpactPoint }).data
            return data[5] === 'none' ? 'transparent' : '#fafafa'
          },
          borderWidth: (params: unknown) => {
            const data = (params as { data: ImpactPoint }).data
            return data[5] === 'none' ? 0 : 1
          },
        },
        label: {
          show: true,
          formatter: (params: unknown) => {
            const data = (params as { data: ImpactPoint }).data
            return data[5] === 'none' ? '' : data[3]
          },
          color: '#fafafa',
          fontSize: 11,
          position: 'top',
        },
      },
    ],
  }

  return (
    <section className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">方案影响视图</h3>
          <p className="mt-1 text-xs text-zinc-500">红色为缩减对象，绿色为加码对象，琥珀色为人才护栏关注对象；横轴 AI 强度 = AI 成本 / 人力成本。</p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <LegendDot color="bg-red-500" label="缩减" />
          <LegendDot color="bg-green-500" label="加码" />
          <LegendDot color="bg-amber-500" label="护栏" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_260px] gap-4">
        <ReactECharts option={option} style={{ height: 260 }} />
        <div className="space-y-2">
          {impactProjects.length > 0 ? impactProjects.map((project) => {
            const change = changeByProject.get(project.id)
            const label = change === 'shrink' ? '缩减预算' : change === 'grow' ? '加码验证' : '人才保护'
            const tone = change === 'shrink' ? 'border-red-500/30 bg-red-500/5 text-red-200' : change === 'grow' ? 'border-green-500/30 bg-green-500/5 text-green-200' : 'border-amber-500/30 bg-amber-500/5 text-amber-200'
            return (
              <div key={`${project.id}-${change}`} className={`rounded-md border px-3 py-2 ${tone}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-zinc-100">{project.name}</span>
                  <span className="shrink-0 text-[11px]">{label}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">人效 {formatProductivity(project.productivity)} · AI强度 {formatRatio(project.ai_intensity)}</div>
              </div>
            )
          }) : (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">方案尚未标注具体影响项目。</div>
          )}
        </div>
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function GuardrailBanner({ guardSummary }: { guardSummary: ReasoningResult['guardSummary'] }) {
  const hasHighRisk = guardSummary.highRiskCount > 0

  return (
    <section className={hasHighRisk ? 'rounded-lg border border-amber-500/40 bg-amber-500/10 p-4' : 'rounded-lg border border-green-500/30 bg-green-500/10 p-4'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={hasHighRisk ? 'text-xs font-medium uppercase tracking-[0.16em] text-amber-300' : 'text-xs font-medium uppercase tracking-[0.16em] text-green-300'}>
            人才护栏校验
          </div>
          <h3 className="mt-2 text-sm font-semibold text-zinc-50">
            {hasHighRisk ? `${guardSummary.highRiskCount} 名高风险 Power 用户已纳入保护` : '未触发高风险人才拦截'}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-300">
            {hasHighRisk
              ? `${guardSummary.projectName} 的预算调整将自动排除高风险 Power 用户，保留其高阶模型额度和关键产能。`
              : `${guardSummary.projectName} 当前没有高风险 Power 用户，但方案仍保留 ${guardSummary.powerUsers} 名 Power 用户的 AI 额度。`}
          </p>
        </div>
        <div className="rounded-md border border-zinc-700/50 bg-zinc-950 px-3 py-2 text-right">
          <div className="text-2xl font-semibold tabular-nums text-zinc-50">{guardSummary.powerUsers}</div>
          <div className="text-[11px] text-zinc-500">Power 用户</div>
        </div>
      </div>
    </section>
  )
}

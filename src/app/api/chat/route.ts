import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Project, ProjectWithMetrics, MonthlyRecord, TalentRecord, RoleDeptCell } from '@/lib/types'
import { enrichProjects } from '@/lib/calculations'
import {
  buildVerdictInputs,
  buildAttributionEvidence,
  getCriticalTalentList,
  getLeverageMatrix,
  getModelMismatch,
  getRoleDeptDivergence,
} from '@/lib/analytics'
import { buildOverviewContext, buildSignalContext, buildDecisionContext } from '@/lib/buildContext'
import {
  AiMode, extractJson,
  normalizeVerdict, normalizeAttribution, normalizeDecision, normalizeDrilldown,
} from '@/lib/aiSchemas'
import { VERDICT_PROMPT, ATTRIBUTION_PROMPT, DECISION_PROMPT, DRILLDOWN_PROMPT } from '@/lib/prompts'

// ───────── 数据加载（服务端缓存） ─────────
function loadJSON<T>(filename: string): T {
  const filePath = join(process.cwd(), 'public', 'data', 'demo', filename)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

let cache: {
  projects: ProjectWithMetrics[]
  trend: MonthlyRecord[]
  talents: TalentRecord[]
  matrix: RoleDeptCell[] | null
} | null = null

function getData() {
  if (!cache) {
    const projects = enrichProjects(loadJSON<Project[]>('projects.json'))
    const trend = loadJSON<MonthlyRecord[]>('monthly_trend.json')
    const talents = loadJSON<TalentRecord[]>('talent_risk.json')
    let matrix: RoleDeptCell[] | null = null
    try { matrix = loadJSON<RoleDeptCell[]>('role_dept_matrix.json') } catch { matrix = null }
    cache = { projects, trend, talents, matrix }
  }
  return cache
}

// ───────── mode 上下文组装（确定性计算在服务端完成，AI 只研判） ─────────

function fmtWan(v: number) { return (v / 10000).toFixed(1) + '万' }

function verdictContext(): string {
  const { projects, trend, talents } = getData()
  const vi = buildVerdictInputs(projects, trend, talents)
  const mm = getModelMismatch(projects).filter(m => m.flag === 'mismatch_suspect')
  const div = getRoleDeptDivergence(getData().matrix).slice(0, 4)
  const lm = getLeverageMatrix(projects, trend)
  const topUnder = lm.points.filter(p => p.verdict === 'underperforming')
    .sort((a, b) => b.ai_intensity - a.ai_intensity).slice(0, 3)
  const confirmed = lm.points.filter(p => p.verdict === 'amplifier_confirmed')

  return `【北极星】人效 ${vi.northStar.productivity.toFixed(2)}｜AI/人力 ${(vi.northStar.aiToLaborRatio * 100).toFixed(1)}%｜关键高流失风险人才 ${vi.northStar.criticalTalentCount} 人

【钱】有效样本已验证 ${vi.moneyDim.amplifierConfirmed} 个（${confirmed.map(p => `${p.name} 人效趋势+${(p.monthlyRate * 100).toFixed(1)}%/月`).join('、') || '无'}）；未验证有效样本 ${vi.moneyDim.amplifierUnproven} 个（高投入高人效但趋势未上行）；待改善 ${vi.moneyDim.underperforming} 个、AI 月投入 ${fmtWan(vi.moneyDim.underperformingAiCost)}（Top: ${topUnder.map(p => `${p.name}(AI投入强度${(p.ai_intensity * 100).toFixed(0)}%人效${p.productivity.toFixed(2)})`).join('、')}）；人效人效在改善项目 ${vi.moneyDim.trendUpCount}/${projects.length}

【效率】重度使用者 ${vi.efficiencyDim.powerCount} 人占个人AI成本 ${(vi.efficiencyDim.powerCostShare * 100).toFixed(0)}%；活跃<12天的项目 ${vi.efficiencyDim.lowActiveProjects} 个；疑似模型错配 ${mm.length} 个（${mm.slice(0, 3).map(m => `${m.name}:${m.dominantRole}主导但高价模型${(m.expensiveShare * 100).toFixed(0)}%`).join('、')}）；同岗位跨部门差距 Top（${div.map(d => `${d.role} ${d.gapMultiple}×`).join('、')}）

【人】高流失风险人才 ${vi.peopleDim.criticalTalent.length} 人（重度使用者∩薪酬位档偏低∩流失环境），集中在 ${[...new Set(vi.peopleDim.criticalTalent.slice(0, 10).map(c => c.project_name))].join('、')}；重度使用者已流失 ${vi.peopleDim.totalPowerExits} 人；低留任团队 ${vi.peopleDim.lowStayProjects} 个`
}

function attributionContext(projectId: string): string | null {
  const { projects, trend, talents, matrix } = getData()
  const ev = buildAttributionEvidence(projectId, projects, trend, talents, matrix)
  if (!ev) return null
  const stepsText = ev.steps.map(s =>
    `[${s.key}] ${s.title}｜系统预判严重度=${s.severity}｜事实：${s.facts.map(f => `${f.label}=${f.value}${f.benchmark ? `（${f.benchmark}）` : ''}`).join('；')}｜系统计算结论：${s.finding}`
  ).join('\n')
  return `目标项目：${ev.project.name}（${ev.project.type}，${ev.project.headcount}人，象限=${ev.project.quadrant}，人效=${ev.project.productivity.toFixed(2)}，AI投入强度=${(ev.project.ai_intensity * 100).toFixed(0)}%）
对照标杆：${ev.benchmark ? `${ev.benchmark.name}（人效=${ev.benchmark.productivity.toFixed(2)}，AI投入强度=${(ev.benchmark.ai_intensity * 100).toFixed(0)}%）` : '无'}

五步证据包：
${stepsText}`
}

function decisionContext(message: string): string {
  const { projects, trend, talents } = getData()
  const base = buildDecisionContext(projects, talents)
  const critical = getCriticalTalentList(talents, projects)
  const byProject = new Map<string, number>()
  critical.forEach(c => byProject.set(c.project_id, (byProject.get(c.project_id) || 0) + 1))
  const guardText = [...byProject.entries()]
    .map(([pid, n]) => `${projects.find(p => p.id === pid)?.name || pid}(${pid}): ${n} 人`)
    .join('；')
  const lm = getLeverageMatrix(projects, trend)
  const confirmed = lm.points.filter(p => p.verdict === 'amplifier_confirmed')
  return `${base}

【保人名单（护栏，强制检查）】共 ${critical.length} 人：${guardText || '无'}

【可用标杆】已验证有效样本：${confirmed.map(p => `${p.name}（AI投入强度${(p.ai_intensity * 100).toFixed(0)}%，人效${p.productivity.toFixed(2)}，月增${(p.monthlyRate * 100).toFixed(1)}%）`).join('、') || '无'}

【用户意图】${message}`
}

function drilldownContext(chapter: string | undefined, projectId: string | undefined): string {
  const { projects, trend, talents, matrix } = getData()
  if (projectId) {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      const ev = attributionContext(projectId)
      return ev || buildSignalContext(project, trend, talents)
    }
  }
  if (chapter === 'decision') return buildDecisionContext(projects, talents)
  return buildOverviewContext(projects)
}

// ───────── 请求处理 ─────────

interface ChatBody {
  mode?: AiMode
  message?: string
  project_id?: string
  chapter?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  // 旧字段兼容
  page?: string
  selected_project_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatBody = await request.json()

    // 旧 page 协议映射（过渡期兼容）
    let mode: AiMode = body.mode
      || (body.page === 'overview_auto_diagnosis' ? 'verdict' : 'drilldown')
    const projectId = body.project_id || body.selected_project_id
    const message = body.message || ''

    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'no_api_key', answer: 'AI 服务未配置（缺少 API Key）。系统计算结果不受影响。' }, { status: 200 })
    }
    const client = new Anthropic({
      apiKey,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    })
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

    let system = ''
    let user = ''
    let maxTokens = 1500

    if (mode === 'verdict') {
      system = VERDICT_PROMPT
      user = `全公司聚合分析结果如下，请生成健康度总评：\n\n${verdictContext()}`
      maxTokens = 1800
    } else if (mode === 'attribution') {
      if (!projectId) return NextResponse.json({ error: 'missing_project_id' }, { status: 400 })
      const ctx = attributionContext(projectId)
      if (!ctx) return NextResponse.json({ error: 'project_not_found' }, { status: 404 })
      system = ATTRIBUTION_PROMPT
      user = `请对以下项目做五步根因研判：\n\n${ctx}`
      maxTokens = 1600
    } else if (mode === 'decision') {
      system = DECISION_PROMPT
      user = decisionContext(message)
      maxTokens = 3500
    } else {
      system = DRILLDOWN_PROMPT + `\n\n当前数据上下文：\n${drilldownContext(body.chapter, projectId)}`
      const hist = (body.history || []).slice(-4)
      user = hist.length > 0
        ? `${hist.map(h => `${h.role === 'user' ? '用户' : '你'}：${h.content}`).join('\n')}\n用户：${message}`
        : message
      maxTokens = 800
    }

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })

    const textBlock = response.content.find(c => c.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const parsed = extractJson(text)
    if (parsed === null) {
      console.error(`[ai] JSON parse failed for mode=${mode}. stop_reason=${response.stop_reason} len=${text.length} raw=${JSON.stringify(text.slice(0, 500))}`)
    }

    switch (mode) {
      case 'verdict':
        return NextResponse.json({ mode, data: normalizeVerdict(parsed) })
      case 'attribution':
        return NextResponse.json({ mode, data: normalizeAttribution(parsed) })
      case 'decision':
        return NextResponse.json({ mode, data: normalizeDecision(parsed) })
      default: {
        const d = normalizeDrilldown(parsed, text.trim() || '未能生成回答，请重试。')
        // 旧页面兼容：顶层也给 answer
        return NextResponse.json({ mode, data: d, answer: d.answer })
      }
    }
  } catch (error) {
    console.error('Chat API error:', error)
    const msg = error instanceof Error ? error.message : '未知错误'
    const friendly = msg.includes('429') || msg.includes('rate_limit')
      ? '请求过于频繁，请稍后再试。'
      : 'AI 研判暂不可用，系统计算结果不受影响。'
    return NextResponse.json({ error: 'ai_failed', detail: msg, answer: friendly }, { status: 200 })
  }
}

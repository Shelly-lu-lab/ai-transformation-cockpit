/**
 * aiSchemas.ts — 四种 AI 模式的响应类型 + 服务端校验归一（v2.1 §9.4）
 * 原则：结构化模式校验失败必须归一为可渲染默认对象；raw text fallback 仅限 drilldown。
 */

export type AiMode = 'verdict' | 'attribution' | 'decision' | 'drilldown'

export type Grade = 'A' | 'B' | 'C'
export type Severity = 'high' | 'medium' | 'low' | 'none'

// ── verdict ──
export interface VerdictFinding {
  severity: Severity
  title: string          // 一句尖锐结论
  evidence: string[]     // 2-3 个证据数字句
  target_chapter: 'divergence' | 'attribution' | 'decision'
  target_project_id?: string
}
export interface VerdictResponse {
  grades: { money: Grade; efficiency: Grade; people: Grade }
  overall: string        // 总评语 1-2 句
  findings: VerdictFinding[]
}

// ── attribution ──
export interface AttributionStepJudgment {
  key: 'model' | 'people' | 'depth' | 'attrition' | 'org'
  judgment: string       // AI 研判 1-2 句
  severity: Severity
}
export interface AttributionResponse {
  steps: AttributionStepJudgment[]
  root_cause: string     // 交叉综合后的根因 1-2 句
  confidence: 'high' | 'medium' | 'low'
}

// ── decision ──
export interface ActionCard {
  action: string
  scope: string          // 影响范围
  amount: string         // 预计金额/量化影响
  benchmark: string      // 参照标杆
  validation: string     // 验证方式
  risk: string
  guardrail: string      // 护栏提示（无则空串）
}
export interface DecisionResponse {
  summary: string
  action_cards: ActionCard[]
  guardrail_hits: { project_id: string; count: number; note: string }[]
  simulation?: string    // 预设推演文本（可选）
}

// ── drilldown ──
export interface DrilldownResponse {
  answer: string
}

const GRADES: Grade[] = ['A', 'B', 'C']
const SEVERITIES: Severity[] = ['high', 'medium', 'low', 'none']
const STEP_KEYS = ['model', 'people', 'depth', 'attrition', 'org'] as const

const str = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb)
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

export function normalizeVerdict(raw: unknown): VerdictResponse {
  const r = (raw ?? {}) as Record<string, unknown>
  const g = (r.grades ?? {}) as Record<string, unknown>
  const grade = (v: unknown): Grade => (GRADES.includes(v as Grade) ? (v as Grade) : 'B')
  const sev = (v: unknown): Severity => (SEVERITIES.includes(v as Severity) ? (v as Severity) : 'medium')
  return {
    grades: { money: grade(g.money), efficiency: grade(g.efficiency), people: grade(g.people) },
    overall: str(r.overall, 'AI 总评生成失败，请点击重新分析。'),
    findings: arr<Record<string, unknown>>(r.findings).slice(0, 5).map(f => ({
      severity: sev(f.severity),
      title: str(f.title, '（信号解析失败）'),
      evidence: arr<string>(f.evidence).filter(e => typeof e === 'string').slice(0, 3),
      target_chapter: (['divergence', 'attribution', 'decision'].includes(f.target_chapter as string)
        ? f.target_chapter : 'divergence') as VerdictFinding['target_chapter'],
      target_project_id: typeof f.target_project_id === 'string' ? f.target_project_id : undefined,
    })),
  }
}

export function normalizeAttribution(raw: unknown): AttributionResponse {
  const r = (raw ?? {}) as Record<string, unknown>
  const sev = (v: unknown): Severity => (SEVERITIES.includes(v as Severity) ? (v as Severity) : 'medium')
  const stepsIn = arr<Record<string, unknown>>(r.steps)
  const steps: AttributionStepJudgment[] = STEP_KEYS.map(key => {
    const found = stepsIn.find(s => s.key === key)
    return {
      key,
      judgment: str(found?.judgment, 'AI 研判暂不可用，参考左侧系统计算事实。'),
      severity: sev(found?.severity),
    }
  })
  return {
    steps,
    root_cause: str(r.root_cause, 'AI 根因综合暂不可用；请基于上方五步事实自行研判。'),
    confidence: (['high', 'medium', 'low'].includes(r.confidence as string)
      ? r.confidence : 'low') as AttributionResponse['confidence'],
  }
}

export function normalizeDecision(raw: unknown): DecisionResponse {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    summary: str(r.summary, '方案生成失败，请重试。'),
    action_cards: arr<Record<string, unknown>>(r.action_cards).slice(0, 4).map(c => ({
      action: str(c.action, '--'),
      scope: str(c.scope, '--'),
      amount: str(c.amount, '--'),
      benchmark: str(c.benchmark, '--'),
      validation: str(c.validation, '--'),
      risk: str(c.risk, '--'),
      guardrail: str(c.guardrail),
    })),
    guardrail_hits: arr<Record<string, unknown>>(r.guardrail_hits).map(h => ({
      project_id: str(h.project_id),
      count: typeof h.count === 'number' ? h.count : 0,
      note: str(h.note),
    })),
    simulation: typeof r.simulation === 'string' ? r.simulation : undefined,
  }
}

export function normalizeDrilldown(raw: unknown, fallbackText: string): DrilldownResponse {
  const r = (raw ?? {}) as Record<string, unknown>
  return { answer: str(r.answer, fallbackText) }
}

/** 从 AI 文本提取 JSON（容忍 code fence / 前后缀文字 / 字符串内裸换行 / 尾逗号） */
export function extractJson(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/g, '').trim()
  const m = s.match(/\{[\s\S]*\}/)
  if (m) s = m[0]
  try { return JSON.parse(s) } catch { /* 渐进修复 */ }
  // 修复1：字符串内裸换行（JSON 非法）→ 空格；结构性换行变空格无副作用
  let repaired = s.replace(/\r?\n/g, ' ')
  // 修复2：尾逗号
  repaired = repaired.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(repaired) } catch { /* 修复3 */ }
  // 修复3：中文引号被当作 JSON 引号使用的罕见情况——仅当仍失败时把全角引号转义
  repaired = repaired.replace(/(?<=[一-龥，。；：])"(?=[一-龥])/g, '\\"')
  try { return JSON.parse(repaired) } catch { return null }
}

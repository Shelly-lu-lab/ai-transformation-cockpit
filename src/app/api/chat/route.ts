import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ChatRequest, ChatResponse, Project, ProjectWithMetrics, MonthlyRecord, TalentRecord } from '@/lib/types'
import { enrichProjects } from '@/lib/calculations'
import { buildOverviewContext, buildSignalContext, buildDecisionContext } from '@/lib/buildContext'
import {
  SYSTEM_PROMPT,
  AUTO_DIAGNOSIS_PROMPT,
  OVERVIEW_CONTEXT_PROMPT,
  SIGNAL_CONTEXT_PROMPT,
  DECISION_CONTEXT_PROMPT,
} from '@/lib/prompts'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadJSON<T>(filename: string): T {
  const filePath = join(process.cwd(), 'public', 'data', 'demo', filename)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

let cachedProjects: ProjectWithMetrics[] | null = null
let cachedTrend: MonthlyRecord[] | null = null
let cachedTalent: TalentRecord[] | null = null

function getProjects(): ProjectWithMetrics[] {
  if (!cachedProjects) {
    const raw = loadJSON<Project[]>('projects.json')
    cachedProjects = enrichProjects(raw)
  }
  return cachedProjects
}

function getTrend(): MonthlyRecord[] {
  if (!cachedTrend) cachedTrend = loadJSON<MonthlyRecord[]>('monthly_trend.json')
  return cachedTrend
}

function getTalent(): TalentRecord[] {
  if (!cachedTalent) cachedTalent = loadJSON<TalentRecord[]>('talent_risk.json')
  return cachedTalent
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { message, page, selected_project_id, client_context } = body

    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { answer: '系统配置异常：未设置 API Key', highlights: [] } as ChatResponse,
        { status: 200 }
      )
    }

    const clientOptions: { apiKey: string; baseURL?: string } = { apiKey }
    if (process.env.ANTHROPIC_BASE_URL) {
      clientOptions.baseURL = process.env.ANTHROPIC_BASE_URL
    }
    const client = new Anthropic(clientOptions)
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514'

    let contextPrompt = ''
    let dataContext = ''

    if (client_context?.trim()) {
      if (page === 'decision') contextPrompt = DECISION_CONTEXT_PROMPT
      else if (page === 'signal') contextPrompt = SIGNAL_CONTEXT_PROMPT
      else if (page === 'overview_auto_diagnosis') contextPrompt = AUTO_DIAGNOSIS_PROMPT
      else contextPrompt = OVERVIEW_CONTEXT_PROMPT
      dataContext = client_context.slice(0, 30000)
    } else if (page === 'overview_auto_diagnosis') {
      const projects = getProjects()
      contextPrompt = AUTO_DIAGNOSIS_PROMPT
      dataContext = buildOverviewContext(projects)
    } else if (page === 'overview') {
      const projects = getProjects()
      contextPrompt = OVERVIEW_CONTEXT_PROMPT
      dataContext = buildOverviewContext(projects)
    } else if (page === 'signal' && selected_project_id) {
      const projects = getProjects()
      const trend = getTrend()
      const talent = getTalent()
      const project = projects.find(p => p.id === selected_project_id)
      if (project) {
        contextPrompt = SIGNAL_CONTEXT_PROMPT
        dataContext = buildSignalContext(project, trend, talent)
      } else {
        contextPrompt = OVERVIEW_CONTEXT_PROMPT
        dataContext = buildOverviewContext(projects)
      }
    } else if (page === 'decision') {
      const projects = getProjects()
      const talent = getTalent()
      contextPrompt = DECISION_CONTEXT_PROMPT
      dataContext = buildDecisionContext(projects, talent)
    } else {
      const projects = getProjects()
      contextPrompt = OVERVIEW_CONTEXT_PROMPT
      dataContext = buildOverviewContext(projects)
    }

    const userMessage = page === 'overview_auto_diagnosis'
      ? '请执行全局自动诊断。'
      : message

    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT + '\n\n' + contextPrompt + '\n\n数据上下文：\n' + dataContext,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find(c => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { answer: 'AI 未返回有效内容，请重试。', highlights: [] } as ChatResponse,
        { status: 200 }
      )
    }

    let parsed: ChatResponse
    try {
      // Strip markdown code fences and any leading/trailing whitespace
      let jsonStr = textBlock.text.trim()
      // Remove ```json ... ``` wrapping
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/g, '').trim()
      // Try to extract JSON object if there's surrounding text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
      parsed = JSON.parse(jsonStr)
    } catch {
      // If JSON parsing fails, wrap the raw text as answer
      parsed = { answer: textBlock.text.replace(/```json\n?|\n?```/g, '').trim(), highlights: [] }
    }

    // Normalize response to prevent frontend crashes
    if (!parsed.answer) parsed.answer = ''
    if (!Array.isArray(parsed.highlights)) parsed.highlights = []
    if (parsed.decision_card) {
      const card = parsed.decision_card
      if (!Array.isArray(card.actions)) card.actions = []
      if (!Array.isArray(card.talent_guards)) card.talent_guards = []
      if (!Array.isArray(card.evidence)) card.evidence = []
      if (!card.title) card.title = '决策方案'
      if (!card.expected_saving) card.expected_saving = '--'
      if (!card.productivity_delta) card.productivity_delta = '--'
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Chat API error:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'

    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      return NextResponse.json(
        { answer: '请求过于频繁，请稍后再试。', highlights: [] } as ChatResponse,
        { status: 200 }
      )
    }

    return NextResponse.json(
      { answer: `分析异常：${errorMessage}。已切换至基础分析模式。`, highlights: [] } as ChatResponse,
      { status: 200 }
    )
  }
}

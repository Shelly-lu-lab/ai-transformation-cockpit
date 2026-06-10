'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel'
import { ProjectDashboard } from '@/components/ProjectDashboard'
import { useAppData } from '@/lib/DataProvider'
import { formatProductivity, formatRatio } from '@/lib/format'
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


export default function SignalPage() {
  const { projects, monthlyTrend, talentRisk, isLoading, error } = useAppData()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

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
              <div className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-zinc-900 px-4 py-3">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-50">{selectedProject.name}</h2>
                  <p className="text-sm text-zinc-400">{selectedProject.type} · {selectedProject.headcount} 人</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium text-zinc-950"
                  style={{ backgroundColor: quadrantColor[selectedProject.quadrant] }}
                >
                  {quadrantLabel[selectedProject.quadrant]}
                </span>
              </div>
              <ProjectDashboard project={selectedProject} trend={selectedTrend} talents={talentRisk} />
            </>
          ) : (
            <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50">
              <p className="text-sm text-zinc-500">点击左侧四象限图中的项目查看详情</p>
            </div>
          )}
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


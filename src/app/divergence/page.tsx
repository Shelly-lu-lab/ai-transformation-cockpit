'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'
import {
  getDependencyFragility,
  getLeverageMatrix,
  getModelMismatch,
  getPricingMismatch,
  LeveragePoint,
} from '@/lib/analytics'
import { formatProductivity, formatRatio, formatWan } from '@/lib/format'
import { Card, SectionHeader, FactTag, JudgmentTag, ChapterTransition, Skeleton, SimulatedTag, CockpitTopbar, AiBriefing } from '@/components/ui'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const verdictMeta: Record<LeveragePoint['verdict'], { label: string; color: string }> = {
  amplifier_confirmed: { label: '放大器·已验证', color: '#22d3ee' },
  amplifier_unproven: { label: '放大器·待验证', color: '#67e8f9' },
  underperforming: { label: '待优化区', color: '#ef4444' },
  high_potential: { label: '高潜力区', color: '#3b82f6' },
  low_base: { label: '基础区', color: '#71717a' },
}

const models = ['Claude Opus', 'Claude Sonnet', 'GPT', 'Cursor/IDE', 'Mivo', '其他']
const modelColors = ['#ef4444', '#22d3ee', '#3b82f6', '#8b5cf6', '#f59e0b', '#71717a']

export default function DivergencePage() {
  const router = useRouter()
  const { projects, monthlyTrend, talentRisk, roleMatrix, isLoading } = useAppData()

  const leverage = useMemo(
    () => (projects.length > 0 ? getLeverageMatrix(projects, monthlyTrend) : null),
    [projects, monthlyTrend]
  )
  const mismatch = useMemo(() => getModelMismatch(projects), [projects])
  const pricing = useMemo(() => getPricingMismatch(talentRisk), [talentRisk])
  const fragility = useMemo(() => getDependencyFragility(talentRisk, projects), [talentRisk, projects])
  const projectName = useMemo(() => new Map(projects.map(project => [project.id, project.name])), [projects])

  const leverageOption = useMemo(() => {
    if (!leverage) return {}
    const groups = new Map<LeveragePoint['verdict'], LeveragePoint[]>()
    leverage.points.forEach(point => groups.set(point.verdict, [...(groups.get(point.verdict) || []), point]))
    const maxHC = Math.max(...leverage.points.map(point => point.headcount), 1)
    return {
      backgroundColor: 'transparent',
      grid: { top: 28, right: 28, bottom: 46, left: 52 },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#fafafa' },
        formatter: (params: { data: (number | string)[] }) => {
          const data = params.data
          return `<b>${data[3]}</b><br/>人效 ${formatProductivity(Number(data[1]))}<br/>AI强度 ${formatRatio(Number(data[0]))}<br/>人数 ${data[2]}`
        },
      },
      xAxis: { type: 'log', name: 'AI强度', axisLabel: { color: '#94a3b8', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
      yAxis: { name: '人效', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
      series: [...groups.entries()].map(([verdict, points]) => ({
        name: verdictMeta[verdict].label,
        type: 'scatter',
        data: points.map(point => [point.ai_intensity, point.productivity, point.headcount, point.name, point.project_id, point.trend]),
        symbolSize: (value: number[]) => Math.max(12, Math.min(52, 12 + (value[2] / maxHC) * 42)),
        itemStyle: { color: verdictMeta[verdict].color, opacity: 0.9 },
        label: { show: false },
        emphasis: { label: { show: true, formatter: '{@[3]}', color: '#fafafa' } },
        markLine: verdict === 'underperforming' ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#475569', type: 'dashed' },
          label: { show: false },
          data: [{ xAxis: leverage.medianIntensity }, { yAxis: leverage.medianProductivity }],
        } : undefined,
      })),
    }
  }, [leverage])

  const heatmapOption = useMemo(() => {
    const cells = roleMatrix || []
    const roles = Array.from(new Set(cells.map(cell => cell.role)))
    const departments = Array.from(new Set(cells.map(cell => projectName.get(cell.project_id) || cell.project_id)))
    const max = Math.max(...cells.map(cell => cell.per_capita), 1)
    return {
      backgroundColor: 'transparent',
      grid: { top: 28, right: 10, bottom: 70, left: 70 },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#fafafa' },
        formatter: (params: { data: [number, number, number, number, number, string] }) => {
          const [x, y, value, headcount, active, projectId] = params.data
          return `<b>${departments[x]} · ${roles[y]}</b><br/>人均AI ${formatWan(value)}<br/>人数 ${headcount}<br/>活跃 ${active} 天<br/>${projectId}`
        },
      },
      xAxis: { type: 'category', data: departments, axisLabel: { color: '#94a3b8', rotate: 55, fontSize: 10 } },
      yAxis: { type: 'category', data: roles, axisLabel: { color: '#94a3b8', fontSize: 11 } },
      visualMap: { min: 0, max, show: false, inRange: { color: ['#0f172a', '#164e63', '#22d3ee', '#f59e0b'] } },
      series: [{
        type: 'heatmap',
        data: cells.flatMap(cell => {
          const x = departments.indexOf(projectName.get(cell.project_id) || cell.project_id)
          const y = roles.indexOf(cell.role)
          return x >= 0 && y >= 0 ? [[x, y, cell.per_capita, cell.headcount, cell.avg_active_days, cell.project_id]] : []
        }),
      }],
    }
  }, [roleMatrix, projectName])

  const stackedOption = useMemo(() => {
    const cells = roleMatrix || []
    const roles = Array.from(new Set(cells.map(cell => cell.role)))
    const roleMix = roles.map(role => {
      const roleCells = cells.filter(cell => cell.role === role)
      const totals = Object.fromEntries(models.map(model => [model, 0]))
      let weight = 0
      roleCells.forEach(cell => {
        const cellWeight = Math.max(cell.ai_cost, 1)
        weight += cellWeight
        models.forEach(model => { totals[model] += (cell.model_mix?.[model] || 0) * cellWeight })
      })
      return Object.fromEntries(models.map(model => [model, weight > 0 ? totals[model] / weight : 0]))
    })
    return {
      backgroundColor: 'transparent',
      grid: { top: 26, right: 12, bottom: 45, left: 50 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#fafafa' } },
      legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
      xAxis: { type: 'category', data: roles, axisLabel: { color: '#94a3b8', rotate: 30 } },
      yAxis: { type: 'value', max: 1, axisLabel: { color: '#94a3b8', formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
      series: models.map((model, index) => ({
        name: model,
        type: 'bar',
        stack: 'model',
        data: roleMix.map(mix => Number(mix[model] || 0)),
        itemStyle: { color: modelColors[index] },
      })),
    }
  }, [roleMatrix])

  const pricingOption = useMemo(() => {
    const rows = [
      ...pricing.highPaidLowUse.slice(0, 80).map(talent => [talent.ai_cost_ratio, talent.cr_value, 18, talent.id, '高薪低用']),
      ...pricing.highUseLowPaid.slice(0, 80).map(talent => [talent.ai_cost_ratio, talent.cr_value, 28, talent.id, '高用低薪']),
    ]
    return {
      backgroundColor: 'transparent',
      grid: { top: 24, right: 24, bottom: 42, left: 50 },
      tooltip: { backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#fafafa' }, formatter: (params: { data: (number | string)[] }) => `<b>${params.data[3]}</b><br/>${params.data[4]}<br/>AI/薪酬 ${formatRatio(Number(params.data[0]))}<br/>CR ${Number(params.data[1]).toFixed(2)}` },
      xAxis: { name: 'AI/薪酬', axisLabel: { color: '#94a3b8', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
      yAxis: { name: '代理CR', min: 0.5, max: 1.7, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
      series: [{ type: 'scatter', data: rows, symbolSize: (value: number[]) => value[2], itemStyle: { color: (params: { data: (number | string)[] }) => params.data[4] === '高用低薪' ? '#ef4444' : '#f59e0b', opacity: 0.78 } }],
    }
  }, [pricing])

  const fragilityOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 24, right: 24, bottom: 42, left: 50 },
    tooltip: { backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#fafafa' }, formatter: (params: { data: (number | string | boolean)[] }) => `<b>${params.data[3]}</b><br/>部门占比 ${formatRatio(Number(params.data[0]))}<br/>CR ${Number(params.data[1]).toFixed(2)}<br/>${projectName.get(String(params.data[4])) || params.data[4]}` },
    xAxis: { name: '个人占部门AI比', max: 1, axisLabel: { color: '#94a3b8', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
    yAxis: { name: '代理CR', min: 0.5, max: 1.7, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)' } } },
    series: [{
      type: 'scatter',
      data: fragility.points.slice(0, 360).map(point => [point.deptShare, point.cr, point.tier === 'power' ? 18 : 11, point.id, point.project_id, point.fragile]),
      symbolSize: (value: number[]) => value[2],
      itemStyle: { color: (params: { data: (number | string | boolean)[] }) => params.data[5] ? '#ef4444' : '#22d3ee', opacity: 0.72 },
      markArea: { silent: true, itemStyle: { color: 'rgba(239,68,68,0.10)' }, data: [[{ xAxis: 0.1, yAxis: 0.5 }, { xAxis: 1, yAxis: 0.9 }]] },
    }],
  }), [fragility, projectName])

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 pb-24 pt-8">
      <CockpitTopbar />
      <header>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">02 · 分化地图</div>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight text-zinc-50">钱花在哪成了，哪没成？</h1>
        <p className="mt-1.5 text-sm text-zinc-500">以五张交叉图定位 AI 投入、人效、岗位、模型与人才定价之间的分化。</p>
      </header>
      <AiBriefing title="分化要闻" prompt="基于分化地图，指出最重要的业务单元分化信号" />

      {isLoading || !leverage ? (
        <Skeleton className="h-[620px]" />
      ) : (
        <>
          <section className="grid grid-cols-12 gap-5">
            <Card className="col-span-5 p-5">
              <SectionHeader title="杠杆矩阵" caption="X=AI强度，Y=人效，气泡=人数" right={<FactTag />} />
              <ReactECharts option={leverageOption} style={{ height: 420 }} onEvents={{ click: (params: { data?: (number | string)[] }) => {
                const id = params.data?.[4]
                if (typeof id === 'string') router.push(`/attribution?id=${id}`)
              } }} />
              <Insight text="高投入不等于有效，真正值得复制的是高人效且趋势上行的放大器。" />
            </Card>
            <Card className="col-span-4 p-5">
              <SectionHeader title="岗位×部门热力图" caption="颜色=同岗位人均 AI 成本" right={<FactTag />} />
              <ReactECharts option={heatmapOption} style={{ height: 420 }} />
              <Insight text="同岗位差距越大，越说明内部存在可迁移的方法样本。" />
            </Card>
            <Card className="col-span-3 p-5">
              <SectionHeader title="模型×角色错配" caption="角色维度模型成本结构" right={<FactTag />} />
              <ReactECharts option={stackedOption} style={{ height: 420 }} />
              <Insight text={`${mismatch.filter(item => item.flag === 'mismatch_suspect').length} 个项目存在非技术主导但高价模型占比偏高的疑似错配。`} />
            </Card>
          </section>

          <section className="grid grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionHeader title="薪酬倒挂 Bubble" caption="高薪低用 / 高用低薪两类人才定价错配" right={<SimulatedTag />} />
              <ReactECharts option={pricingOption} style={{ height: 360 }} />
              <Insight text={`CR 为 ${pricing.crSource === 'proxy' ? '代理' : '真实'}口径，高用低薪是预算调整时最需要保护的人群。`} />
            </Card>
            <Card className="p-5">
              <SectionHeader title="个人依赖 × CR 脆弱扫描" caption="右下角=高依赖且薪酬倒挂" right={<FactTag />} />
              <ReactECharts option={fragilityOption} style={{ height: 360 }} />
              <Insight text={`${fragility.fragileCount} 名使用者落入高依赖低 CR 警戒区，需进入保人名单校验。`} />
            </Card>
          </section>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <JudgmentTag />
              <p className="text-[15px] leading-7 text-zinc-200">
                分化研判：先处理待优化区的模型错配和低活跃问题，再把已验证放大器的方法迁移到同岗位差距最大的部门；涉及高依赖低 CR 人才时必须进入护栏。
              </p>
            </div>
          </Card>
        </>
      )}

      <ChapterTransition
        text="从分化地图进入根因诊断，解释高投入未转化为人效的原因。"
        href="/attribution"
        cta="03 根因诊断"
      />
    </div>
  )
}

function Insight({ text }: { text: string }) {
  return (
    <p className="mt-2 rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-sm leading-6 text-zinc-400">
      <JudgmentTag /> <span className="ml-2">{text.slice(0, 80)}</span>
    </p>
  )
}

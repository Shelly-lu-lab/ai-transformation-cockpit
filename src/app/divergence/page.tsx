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
import { Card, SectionHeader, FactTag, JudgmentTag, ChapterTransition, Skeleton, CockpitTopbar, AiBriefing } from '@/components/ui'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const verdictMeta: Record<LeveragePoint['verdict'], { label: string; color: string }> = {
  amplifier_confirmed: { label: 'AI 已让人效变好', color: '#0891b2' },
  amplifier_unproven: { label: '效果待验证', color: '#06b6d4' },
  underperforming: { label: '待改善', color: '#dc2626' },
  high_potential: { label: '待加码', color: '#2563eb' },
  low_base: { label: '基础区', color: '#64748b' },
}

const models = ['Claude Opus', 'Claude Sonnet', 'GPT', 'Cursor/IDE', 'Mivo', '其他']
const modelColors = ['#dc2626', '#0891b2', '#2563eb', '#7c3aed', '#d97706', '#64748b']

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
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        textStyle: { color: '#1a2332' },
        formatter: (params: { data: (number | string)[] }) => {
          const data = params.data
          return `<b>${data[3]}</b><br/>人效 ${formatProductivity(Number(data[1]))}<br/>AI投入强度 ${formatRatio(Number(data[0]))}<br/>人数 ${data[2]}`
        },
      },
      xAxis: { type: 'log', name: 'AI投入强度', axisLabel: { color: '#475569', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      yAxis: { name: '人效', axisLabel: { color: '#475569' }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      series: [...groups.entries()].map(([verdict, points]) => ({
        name: verdictMeta[verdict].label,
        type: 'scatter',
        data: points.map(point => [point.ai_intensity, point.productivity, point.headcount, point.name, point.project_id, point.trend]),
        symbolSize: (value: number[]) => Math.max(12, Math.min(52, 12 + (value[2] / maxHC) * 42)),
        itemStyle: { color: verdictMeta[verdict].color, opacity: 0.9 },
        label: { show: false },
        emphasis: { label: { show: true, formatter: '{@[3]}', color: '#1a2332' } },
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
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        textStyle: { color: '#1a2332' },
        formatter: (params: { data: [number, number, number, number, number, string] }) => {
          const [x, y, value, headcount, active, projectId] = params.data
          return `<b>${departments[x]} · ${roles[y]}</b><br/>人均AI ${formatWan(value)}<br/>人数 ${headcount}<br/>活跃 ${active} 天<br/>${projectId}`
        },
      },
      xAxis: { type: 'category', data: departments, axisLabel: { color: '#475569', rotate: 55, fontSize: 10 } },
      yAxis: { type: 'category', data: roles, axisLabel: { color: '#475569', fontSize: 11 } },
      visualMap: { min: 0, max, show: false, inRange: { color: ['#ffffff', '#164e63', '#0891b2', '#d97706'] } },
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#ffffff', borderColor: '#cbd5e1', textStyle: { color: '#1a2332' } },
      legend: { bottom: 0, textStyle: { color: '#475569', fontSize: 10 } },
      xAxis: { type: 'category', data: roles, axisLabel: { color: '#475569', rotate: 30 } },
      yAxis: { type: 'value', max: 1, axisLabel: { color: '#475569', formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
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
      tooltip: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', textStyle: { color: '#1a2332' }, formatter: (params: { data: (number | string)[] }) => `<b>${params.data[3]}</b><br/>${params.data[4]}<br/>AI/薪酬 ${formatRatio(Number(params.data[0]))}<br/>CR ${Number(params.data[1]).toFixed(2)}` },
      xAxis: { name: 'AI/薪酬', axisLabel: { color: '#475569', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      yAxis: { name: '薪酬位档', min: 0.5, max: 1.7, axisLabel: { color: '#475569' }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      series: [{ type: 'scatter', data: rows, symbolSize: (value: number[]) => value[2], itemStyle: { color: (params: { data: (number | string)[] }) => params.data[4] === '高用低薪' ? '#dc2626' : '#d97706', opacity: 0.78 } }],
    }
  }, [pricing])

  const fragilityOption = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { top: 24, right: 24, bottom: 42, left: 50 },
    tooltip: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', textStyle: { color: '#1a2332' }, formatter: (params: { data: (number | string | boolean)[] }) => `<b>${params.data[3]}</b><br/>部门占比 ${formatRatio(Number(params.data[0]))}<br/>CR ${Number(params.data[1]).toFixed(2)}<br/>${projectName.get(String(params.data[4])) || params.data[4]}` },
    xAxis: { name: '个人占部门AI比', max: 1, axisLabel: { color: '#475569', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
    yAxis: { name: '薪酬位档', min: 0.5, max: 1.7, axisLabel: { color: '#475569' }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
    series: [{
      type: 'scatter',
      data: fragility.points.slice(0, 360).map(point => [point.deptShare, point.cr, point.tier === 'power' ? 18 : 11, point.id, point.project_id, point.fragile]),
      symbolSize: (value: number[]) => value[2],
      itemStyle: { color: (params: { data: (number | string | boolean)[] }) => params.data[5] ? '#dc2626' : '#0891b2', opacity: 0.72 },
      markArea: { silent: true, itemStyle: { color: 'rgba(220,38,38,0.08)' }, data: [[{ xAxis: 0.1, yAxis: 0.5 }, { xAxis: 1, yAxis: 0.9 }]] },
    }],
  }), [fragility, projectName])

  return (
    <div className="w-full space-y-6 px-8 pb-24 pt-8">
      <CockpitTopbar />
      <header>
        <h1 className="text-[30px] font-semibold leading-tight text-[#1a2332]">钱花在哪成了，哪没成？</h1>
        <p className="mt-1.5 text-sm text-slate-500">以五张交叉图定位 AI 投入、人效、岗位、模型与人才定价之间的分化。</p>
      </header>
      <AiBriefing title="分化洞察" prompt="基于分化地图，指出最重要的业务单元分化信号" />

      {isLoading || !leverage ? (
        <Skeleton className="h-[620px]" />
      ) : (
        <>
          <section className="grid grid-cols-12 gap-5">
            <Card className="col-span-5 p-5">
              <SectionHeader title="杠杆矩阵" caption="X=AI投入强度，Y=人效，气泡=人数" right={<FactTag />} />
              <ReactECharts option={leverageOption} style={{ height: 420 }} onEvents={{ click: (params: { data?: (number | string)[] }) => {
                const id = params.data?.[4]
                if (typeof id === 'string') router.push(`/attribution?id=${id}`)
              } }} />
              <Insight text="高投入不等于有效，真正值得复制的是高人效且持续改善的项目。" />
            </Card>
            <Card className="col-span-4 p-5">
              <SectionHeader title="岗位×部门热力图" caption="颜色=同岗位人均 AI 成本" right={<FactTag />} />
              <ReactECharts option={heatmapOption} style={{ height: 420 }} />
              <Insight text="同岗位差距越大，越说明内部存在可迁移的方法样本。" />
            </Card>
            <Card className="col-span-3 p-5">
              <SectionHeader title="模型用错地方了" caption="角色维度模型成本结构" right={<FactTag />} />
              <ReactECharts option={stackedOption} style={{ height: 420 }} />
              <Insight text={`${mismatch.filter(item => item.flag === 'mismatch_suspect').length} 个项目存在非技术主导但高价模型占比偏高的疑似错配。`} />
            </Card>
          </section>

          <section className="grid grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionHeader title="薪酬偏低 Bubble" caption="高薪低用 / 高用低薪两类人才定价错配" right={<FactTag />} />
              <ReactECharts option={pricingOption} style={{ height: 360 }} />
              <Insight text={`薪酬位档为${pricing.crSource === 'proxy' ? '代理' : '真实'}口径，高用低薪是预算调整时最需要保护的人群。`} />
            </Card>
            <Card className="p-5">
              <SectionHeader title="个人依赖 × 薪酬位档扫描" caption="右下角=高依赖且薪酬偏低" right={<FactTag />} />
              <ReactECharts option={fragilityOption} style={{ height: 360 }} />
              <Insight text={`${fragility.fragileCount} 名使用者落入高依赖低 CR 警戒区，需进入保人名单校验。`} />
            </Card>
          </section>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <JudgmentTag />
              <p className="text-[15px] leading-7 text-slate-800">
                分化研判：先处理待改善项目的模型使用不匹配和低活跃问题，再把已让人效变好的方法迁移到同岗位差距最大的部门；涉及高依赖且薪酬偏低人才时必须进入护栏。
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
    <p className="mt-2 rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-sm leading-6 text-slate-600">
      <JudgmentTag /> <span className="ml-2">{text.slice(0, 80)}</span>
    </p>
  )
}

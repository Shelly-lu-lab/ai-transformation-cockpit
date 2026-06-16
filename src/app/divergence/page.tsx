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
import { TermTooltip } from '@/components/TermTooltip'

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

function jitter(seed: string, range = 0.02) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return ((hash % 1000) / 1000 - 0.5) * range
}

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
  const topRoleCell = useMemo(() => {
    const cells = roleMatrix || []
    return [...cells].sort((a, b) => b.per_capita - a.per_capita)[0]
  }, [roleMatrix])

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
    const valuesAll = cells.map(cell => cell.per_capita).filter(v => Number.isFinite(v))
    const sorted = [...valuesAll].sort((a, b) => a - b)
    const quantile = (p: number) => sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    const visualMin = quantile(0.05)
    const visualMax = Math.max(quantile(0.9), visualMin + 1)
    return {
      backgroundColor: 'transparent',
      grid: { top: 28, right: 24, bottom: 90, left: 100 },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        textStyle: { color: '#1a2332' },
        formatter: (params: { data: [number, number, number, number, number, string] }) => {
          const [x, y, value, headcount, active, projectId] = params.data
          return `<b>${departments[x]} · ${roles[y]}</b><br/>人均AI ${formatWan(value)}<br/>人数 ${headcount}<br/>活跃 ${active} 天<br/>${projectId}`
        },
      },
      xAxis: {
        type: 'category',
        data: departments,
        axisLabel: {
          color: '#475569',
          rotate: 35,
          fontSize: 11,
          interval: 0,
          formatter: (value: string) => value.length > 6 ? `${value.slice(0, 6)}...` : value,
        },
      },
      yAxis: { type: 'category', data: roles, axisLabel: { color: '#475569', fontSize: 12, interval: 0 } },
      visualMap: {
        min: visualMin,
        max: visualMax,
        dimension: 2,
        show: true,
        orient: 'horizontal',
        bottom: 4,
        left: 'center',
        itemWidth: 10,
        itemHeight: 240,
        text: ['高', '低'],
        textStyle: { color: '#475569', fontSize: 10 },
        calculable: false,
        inRange: { color: ['#e0f2fe', '#7dd3fc', '#0891b2', '#155e75', '#b91c1c'] },
      },
      series: [{
        type: 'heatmap',
        itemStyle: { borderColor: 'rgba(148,163,184,0.35)', borderWidth: 1 },
        emphasis: { itemStyle: { borderColor: '#1a2332', borderWidth: 2 } },
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
      grid: { top: 50, right: 12, bottom: 60, left: 50 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#ffffff', borderColor: '#cbd5e1', textStyle: { color: '#1a2332' } },
      legend: { top: 0, left: 'center', type: 'scroll', textStyle: { color: '#475569', fontSize: 11 }, itemWidth: 14, itemHeight: 8, itemGap: 12 },
      xAxis: {
        type: 'category',
        data: roles,
        axisLabel: {
          color: '#475569',
          rotate: 0,
          interval: 0,
          fontSize: 11,
          formatter: (value: string) => value.length > 4 ? value.slice(0, 4) : value,
        },
      },
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
      ...pricing.highPaidLowUse.slice(0, 80).map(talent => [talent.ai_cost_ratio, talent.cr_value + jitter(talent.id), 8, talent.id, '高薪低用']),
      ...pricing.highUseLowPaid.slice(0, 80).map(talent => [talent.ai_cost_ratio, talent.cr_value + jitter(talent.id), 14, talent.id, '高用低薪']),
    ]
    const xValues = rows.map(row => Number(row[0])).filter(value => Number.isFinite(value))
    const useLogXAxis = xValues.length > 0 && Math.min(...xValues) > 0
    return {
      backgroundColor: 'transparent',
      grid: { top: 24, right: 24, bottom: 42, left: 50 },
      tooltip: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', textStyle: { color: '#1a2332' }, formatter: (params: { data: (number | string)[] }) => `<b>${params.data[3]}</b><br/>${params.data[4]}<br/>AI/薪酬 ${formatRatio(Number(params.data[0]))}<br/>薪酬位档 ${Number(params.data[1]).toFixed(2)}` },
      xAxis: { type: useLogXAxis ? 'log' : 'value', logBase: 10, min: useLogXAxis ? 0.01 : undefined, name: 'AI/薪酬', axisLabel: { color: '#475569', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      yAxis: { name: '薪酬位档', min: 0.5, max: 1.7, axisLabel: { color: '#475569' }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      series: [{
        type: 'scatter',
        data: rows,
        symbolSize: (value: number[]) => value[2],
        itemStyle: { color: (params: { data: (number | string)[] }) => params.data[4] === '高用低薪' ? '#dc2626' : '#d97706', opacity: 0.5 },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#94a3b8', type: 'dashed' },
          label: { color: '#64748b', fontSize: 10 },
          data: [{ yAxis: 1 }, { xAxis: 0.5 }, { xAxis: 1 }],
        },
      }],
    }
  }, [pricing])

  const fragilityOption = useMemo(() => {
    const points = fragility.points.slice(0, 360).map(point => [point.deptShare, point.cr + jitter(point.id, 0.015), point.tier === 'power' ? 10 : 6, point.id, point.project_id, point.fragile, point.tier])
    const powerPoints = points.filter(point => point[6] === 'power')
    const regularPoints = points.filter(point => point[6] !== 'power')
    return {
      backgroundColor: 'transparent',
      grid: { top: 40, right: 24, bottom: 42, left: 50 },
      legend: { top: 0, left: 'center', textStyle: { color: '#475569', fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
      tooltip: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', textStyle: { color: '#1a2332' }, formatter: (params: { data: (number | string | boolean)[] }) => `<b>${params.data[3]}</b><br/>部门占比 ${formatRatio(Number(params.data[0]))}<br/>薪酬位档 ${Number(params.data[1]).toFixed(2)}<br/>${projectName.get(String(params.data[4])) || params.data[4]}` },
      xAxis: { name: '个人占部门AI比', max: 1, axisLabel: { color: '#475569', formatter: (v: number) => formatRatio(v) }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      yAxis: { name: '薪酬位档', min: 0.5, max: 1.7, axisLabel: { color: '#475569' }, splitLine: { lineStyle: { color: 'rgba(203,213,225,0.65)' } } },
      series: [
        {
          name: '普通使用者',
          type: 'scatter',
          symbol: 'circle',
          data: regularPoints,
          symbolSize: (value: number[]) => value[2],
          itemStyle: { color: '#0891b2', opacity: 0.5 },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(220,38,38,0.14)', borderColor: '#dc2626', borderType: 'dashed', borderWidth: 1 },
            data: [[{ xAxis: 0.1, yAxis: 0.5 }, { xAxis: 1, yAxis: 0.9 }]],
          },
        },
        {
          name: '重度使用者',
          type: 'scatter',
          symbol: 'triangle',
          data: powerPoints,
          symbolSize: (value: number[]) => value[2],
          itemStyle: { color: '#dc2626', opacity: 0.5 },
        },
      ],
    }
  }, [fragility, projectName])

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
            <Card className="col-span-7 p-5">
              <SectionHeader title={<TermTooltip term="leverage_matrix">项目分布矩阵</TermTooltip>} caption="X=AI投入强度，Y=人效，气泡=人数" right={<FactTag />} />
              <ReactECharts option={leverageOption} style={{ height: 420 }} onEvents={{ click: (params: { data?: (number | string)[] }) => {
                const id = params.data?.[4]
                if (typeof id === 'string') router.push(`/attribution?id=${id}`)
              } }} />
              <Insight text={`已变好 ${leverage.counts.amplifier_confirmed} 个，待改善 ${leverage.counts.underperforming + leverage.counts.low_base} 个；先看高投入低人效气泡。`} />
            </Card>
            <Card className="col-span-5 p-5">
              <SectionHeader title="角色 × 模型成本结构" caption="X=角色，Y=各模型成本占比，颜色=模型类型" right={<FactTag />} />
              <ReactECharts option={stackedOption} style={{ height: 460 }} />
              <Insight text={`${mismatch.filter(item => item.flag === 'mismatch_suspect').length} 个项目疑似模型用错地方，高价模型更多集中在非技术主导项目。`} />
            </Card>
          </section>

          <section>
            <Card className="p-5">
              <SectionHeader title="岗位×部门 AI 投入热力图" caption={<span>颜色越深 = 同岗位人均 AI 投入越高，红色 = 异常高值；重点看<TermTooltip term="role_gap">同岗位人效差距（倍）</TermTooltip></span>} right={<FactTag />} />
              <ReactECharts option={heatmapOption} style={{ height: 480 }} />
              <Insight text={topRoleCell ? `${projectName.get(topRoleCell.project_id) || topRoleCell.project_id} 的 ${topRoleCell.role} 人均 AI 成本最高，人数 ${topRoleCell.headcount}。` : '热力图暂无足够岗位数据。'} />
            </Card>
          </section>

          <section className="grid grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionHeader title="AI 投入 × 薪酬位档分布" caption="X=AI成本/薪酬，Y=薪酬位档，气泡颜色=高薪低用或高用低薪" right={<FactTag />} />
              <ReactECharts option={pricingOption} style={{ height: 380 }} />
              <Insight text={`高用低薪 ${pricing.highUseLowPaid.length} 人，高薪低用 ${pricing.highPaidLowUse.length} 人；先保护高用低薪人群。`} />
            </Card>
            <Card className="p-5">
              <SectionHeader title="员工部门依赖 × 薪酬位档分布" caption="X=个人占部门 AI 成本比例，Y=薪酬位档，形状=使用深度" right={<FactTag />} />
              <ReactECharts option={fragilityOption} style={{ height: 380 }} />
              <Insight text={`${fragility.fragileCount} 名使用者落入右下警戒区：部门依赖高且薪酬位档偏低。`} />
            </Card>
          </section>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <JudgmentTag />
              <p className="text-[15px] leading-7 text-slate-800">
                分化研判：先处理待改善项目的模型使用不匹配和低活跃问题，再把已让人效变好的方法迁移到同岗位差距最大的部门；涉及高依赖且薪酬偏低人才时必须进入关键人才保护检查。
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

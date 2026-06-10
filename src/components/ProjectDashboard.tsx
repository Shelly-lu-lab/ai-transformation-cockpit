'use client'

import dynamic from 'next/dynamic'
import { ProjectWithMetrics, TalentRecord, MonthlyRecord } from '@/lib/types'
import { formatWan, formatPercent, formatRatio, formatProductivity } from '@/lib/format'
import { getTalentRiskSummary } from '@/lib/calculations'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface ProjectDashboardProps {
  project: ProjectWithMetrics
  trend: MonthlyRecord[]
  talents: TalentRecord[]
}

export function ProjectDashboard({ project, trend, talents }: ProjectDashboardProps) {
  const riskSummary = getTalentRiskSummary(project.id, talents)
  const projectTalents = talents.filter(t => t.project_id === project.id)
  const tierCounts = {
    power: projectTalents.filter(t => t.tier === 'power').length,
    regular: projectTalents.filter(t => t.tier === 'regular').length,
    light: projectTalents.filter(t => t.tier === 'light').length,
  }
  const totalTracked = tierCounts.power + tierCounts.regular + tierCounts.light

  // 1. 成本构成环形图
  const costPieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#27272a', borderColor: '#3f3f46', textStyle: { color: '#fafafa' } },
    legend: { bottom: 0, textStyle: { color: '#a1a1aa', fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '42%'],
      label: { show: false },
      data: [
        { value: project.labor_cost, name: '人力成本', itemStyle: { color: '#3b82f6' } },
        { value: project.ai_cost, name: 'AI 成本', itemStyle: { color: '#22c55e' } },
      ],
    }],
  }

  // 2. AI 用户分层柱状图
  const tierBarOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#27272a', borderColor: '#3f3f46', textStyle: { color: '#fafafa' } },
    grid: { top: 8, right: 10, bottom: 24, left: 50 },
    xAxis: {
      type: 'category',
      data: ['重度(Power)', '中度(Regular)', '轻度(Light)'],
      axisLabel: { color: '#a1a1aa', fontSize: 10 },
      axisLine: { lineStyle: { color: '#3f3f46' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#a1a1aa', fontSize: 10 },
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLine: { lineStyle: { color: '#3f3f46' } },
    },
    series: [{
      type: 'bar',
      data: [
        { value: tierCounts.power, itemStyle: { color: '#22c55e' } },
        { value: tierCounts.regular, itemStyle: { color: '#3b82f6' } },
        { value: tierCounts.light, itemStyle: { color: '#f59e0b' } },
      ],
      barWidth: '50%',
    }],
  }

  // 3. 模型消耗横向条形图
  const modelEntries = Object.entries(project.ai_model_mix).filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1])
  const modelBarOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#27272a', borderColor: '#3f3f46', textStyle: { color: '#fafafa' }, formatter: (params: unknown) => {
      const p = (params as Array<{name: string; value: number}>)[0]
      return `${p.name}: ${(p.value * 100).toFixed(1)}%`
    }},
    grid: { top: 4, right: 30, bottom: 4, left: 90 },
    xAxis: { type: 'value', max: 1, axisLabel: { show: false }, splitLine: { lineStyle: { color: '#27272a' } }, axisLine: { show: false } },
    yAxis: {
      type: 'category',
      data: modelEntries.map(([k]) => k),
      axisLabel: { color: '#a1a1aa', fontSize: 10 },
      axisLine: { lineStyle: { color: '#3f3f46' } },
    },
    series: [{
      type: 'bar',
      data: modelEntries.map(([, v]) => v),
      barWidth: '60%',
      itemStyle: { color: '#6366f1', borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: (p: {value: number}) => `${(p.value * 100).toFixed(0)}%`, color: '#a1a1aa', fontSize: 10 },
    }],
  }

  // 4. 月度趋势（保留已有逻辑）
  const cumulativeAi = trend.reduce<number[]>((acc, _, i) => {
    acc[i] = (acc[i - 1] || 0) + trend[i].ai_cost
    return acc
  }, [])
  const trendOption = {
    backgroundColor: 'transparent',
    grid: { top: 24, right: 50, bottom: 28, left: 50 },
    tooltip: { trigger: 'axis', backgroundColor: '#27272a', borderColor: '#3f3f46', textStyle: { color: '#fafafa' } },
    legend: { top: 0, textStyle: { color: '#a1a1aa', fontSize: 10 } },
    xAxis: {
      type: 'category',
      data: trend.map(r => r.month.slice(5)),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#a1a1aa', fontSize: 10 },
    },
    yAxis: [
      { type: 'value', name: 'AI累计', axisLabel: { color: '#a1a1aa', fontSize: 10, formatter: (v: number) => formatWan(v) }, splitLine: { lineStyle: { color: '#27272a' } }, axisLine: { lineStyle: { color: '#3f3f46' } } },
      { type: 'value', name: '人效', axisLabel: { color: '#a1a1aa', fontSize: 10 }, splitLine: { show: false }, axisLine: { lineStyle: { color: '#3f3f46' } } },
    ],
    series: [
      { name: 'AI累计投入', type: 'line', areaStyle: { color: 'rgba(59,130,246,0.15)' }, lineStyle: { color: '#3b82f6' }, itemStyle: { color: '#3b82f6' }, data: cumulativeAi, smooth: true },
      { name: '人效走势', type: 'line', yAxisIndex: 1, smooth: true, itemStyle: { color: '#22c55e' }, lineStyle: { color: '#22c55e' }, data: trend.map(r => r.productivity) },
    ],
  }

  // 5. 风险分布环形
  const riskPieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#27272a', borderColor: '#3f3f46', textStyle: { color: '#fafafa' } },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '50%'],
      label: { show: false },
      data: [
        { value: riskSummary.high_risk_count, name: '高风险', itemStyle: { color: '#ef4444' } },
        { value: projectTalents.filter(t => t.risk_level === 'medium').length, name: '中风险', itemStyle: { color: '#f59e0b' } },
        { value: projectTalents.filter(t => t.risk_level === 'low').length, name: '低风险', itemStyle: { color: '#22c55e' } },
      ],
    }],
  }

  return (
    <div className="space-y-4">
      {/* 顶部 KPI 行 */}
      <div className="grid grid-cols-5 gap-3">
        <MiniKPI label="人效" value={formatProductivity(project.productivity)} color={project.quadrant === 'amplifier' ? 'green' : project.quadrant === 'underperforming' ? 'red' : 'blue'} />
        <MiniKPI label="AI 强度" value={formatRatio(project.ai_intensity)} />
        <MiniKPI label="AI 月成本" value={formatWan(project.ai_cost)} />
        <MiniKPI label="人均 AI" value={formatWan(project.ai_cost / Math.max(project.headcount, 1))} />
        <MiniKPI label="覆盖率" value={formatPercent(project.ai_penetration)} />
      </div>

      {/* 月度趋势 */}
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-3">
        <div className="mb-1 text-xs font-medium text-zinc-400">AI 投入 vs 人效趋势（12 个月）</div>
        <ReactECharts option={trendOption} style={{ height: 200 }} />
      </div>

      {/* 中间三图 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-400">成本构成</div>
          <ReactECharts option={costPieOption} style={{ height: 160 }} />
          <div className="mt-1 text-center text-[11px] text-zinc-500">
            AI 占比 {formatRatio(project.ai_cost / (project.labor_cost + project.ai_cost))}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-400">AI 用户分层</div>
          <ReactECharts option={tierBarOption} style={{ height: 160 }} />
          <div className="mt-1 text-center text-[11px] text-zinc-500">
            共 {totalTracked} 人 · Power {tierCounts.power} 人 ({totalTracked > 0 ? ((tierCounts.power / totalTracked) * 100).toFixed(0) : 0}%)
          </div>
        </div>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-400">模型消耗分布</div>
          <ReactECharts option={modelBarOption} style={{ height: 160 }} />
        </div>
      </div>

      {/* 底部：风险 + 敬业度 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-400">人才风险分布</div>
          <div className="flex items-center gap-4">
            <div className="w-24">
              <ReactECharts option={riskPieOption} style={{ height: 80 }} />
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> 高风险 {riskSummary.high_risk_count} 人</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 中风险 {projectTalents.filter(t => t.risk_level === 'medium').length} 人</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" /> 低风险 {projectTalents.filter(t => t.risk_level === 'low').length} 人</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">高风险 = Power 用户 + 薪酬竞争力 CR &lt; 0.9</div>
        </div>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-400">敬业度关键维度</div>
          {project.engagement_dimensions ? (
            <div className="mt-2 space-y-2">
              {[
                { label: '总体', value: project.engagement_dimensions.overall },
                { label: '职业发展', value: project.engagement_dimensions.career_development },
                { label: '薪酬认可', value: project.engagement_dimensions.compensation_recognition },
                { label: '留任意愿', value: project.engagement_dimensions.stay_intention },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-14 text-[11px] text-zinc-400">{item.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${item.value ?? 0}%`,
                        backgroundColor: (item.value ?? 0) >= 65 ? '#22c55e' : (item.value ?? 0) >= 50 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] text-zinc-300">{item.value ?? '--'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-center text-xs text-zinc-600">暂无调研数据</div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniKPI({ label, value, color = 'default' }: { label: string; value: string; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : color === 'blue' ? 'text-blue-400' : 'text-zinc-100'
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 p-2 text-center">
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  )
}

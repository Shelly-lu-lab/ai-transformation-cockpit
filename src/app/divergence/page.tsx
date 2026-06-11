'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppData } from '@/lib/DataProvider'
import { getLeverageMatrix, getRoleDeptDivergence, LeveragePoint } from '@/lib/analytics'
import { formatWan, formatProductivity, formatRatio } from '@/lib/format'
import { Card, SectionHeader, FactTag, ChapterTransition, Skeleton, SimulatedTag } from '@/components/ui'

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

const verdictMeta: Record<LeveragePoint['verdict'], { label: string; color: string }> = {
  amplifier_confirmed: { label: '放大器·已验证', color: '#10b981' },
  amplifier_unproven: { label: '放大器·未验证', color: '#67e8f9' },
  underperforming: { label: '待优化区', color: '#ef4444' },
  high_potential: { label: '高潜力区', color: '#3b82f6' },
  low_base: { label: '基础区', color: '#71717a' },
}

type Tab = 'tiers' | 'types' | 'roles'

export default function DivergencePage() {
  const router = useRouter()
  const { projects, monthlyTrend, talentRisk, roleMatrix, isLoading } = useAppData()
  const [tab, setTab] = useState<Tab>('roles')

  const matrix = useMemo(
    () => (projects.length > 0 ? getLeverageMatrix(projects, monthlyTrend) : null),
    [projects, monthlyTrend]
  )
  const divergence = useMemo(() => getRoleDeptDivergence(roleMatrix), [roleMatrix])

  const tierStats = useMemo(() => {
    const tiers = { power: 0, regular: 0, light: 0 }
    let powerCost = 0, totalCost = 0
    talentRisk.forEach(t => {
      tiers[t.tier] += 1
      const c = t.ai_cost_cny ?? 0
      totalCost += c
      if (t.tier === 'power') powerCost += c
    })
    return { tiers, powerCostShare: totalCost > 0 ? powerCost / totalCost : 0, total: talentRisk.length }
  }, [talentRisk])

  const chartOption = useMemo(() => {
    if (!matrix) return {}
    const groups = new Map<LeveragePoint['verdict'], LeveragePoint[]>()
    matrix.points.forEach(p => {
      const list = groups.get(p.verdict) || []
      list.push(p)
      groups.set(p.verdict, list)
    })
    const maxHC = Math.max(...matrix.points.map(p => p.headcount), 1)
    const minX = Math.max(0.004, Math.min(...matrix.points.map(p => p.ai_intensity)) * 0.7)

    return {
      backgroundColor: 'transparent',
      grid: { top: 30, right: 40, bottom: 60, left: 60 },
      legend: { bottom: 6, textStyle: { color: '#a1a1aa', fontSize: 11 }, itemGap: 16 },
      tooltip: {
        backgroundColor: '#18181b', borderColor: '#3f3f46', textStyle: { color: '#fafafa', fontSize: 12 },
        formatter: (params: { data: (number | string)[] }) => {
          const d = params.data
          const arrow = d[6] === 'up' ? '↑ 上行' : d[6] === 'down' ? '↓ 下行' : '→ 平稳'
          return `<b>${d[3]}</b><br/>人效 ${formatProductivity(Number(d[1]))} · ${arrow}<br/>AI 强度 ${formatRatio(Number(d[0]))} · ${d[2]} 人`
        },
      },
      xAxis: {
        name: 'AI 强度（log）', type: 'log', min: minX,
        nameTextStyle: { color: '#71717a', fontSize: 11 },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        splitLine: { lineStyle: { color: '#1f1f23' } },
        axisLabel: { color: '#71717a', fontSize: 10, formatter: (v: number) => formatRatio(v) },
      },
      yAxis: {
        name: '人效', nameTextStyle: { color: '#71717a', fontSize: 11 },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        splitLine: { lineStyle: { color: '#1f1f23' } },
        axisLabel: { color: '#71717a', fontSize: 10 },
      },
      series: [...groups.entries()].map(([verdict, pts]) => ({
        name: verdictMeta[verdict].label,
        type: 'scatter',
        itemStyle: { color: verdictMeta[verdict].color, opacity: 0.88 },
        symbolSize: (d: number[]) => Math.max(14, Math.min(56, 14 + (Number(d[2]) / maxHC) * 42)),
        emphasis: { scale: 1.15, label: { show: true, formatter: '{@[3]}', color: '#fafafa', fontSize: 11 } },
        data: pts.map(p => [p.ai_intensity, p.productivity, p.headcount, p.name, p.project_id, p.verdict, p.trend]),
        markLine: verdict === 'underperforming' ? {
          silent: true, symbol: 'none',
          lineStyle: { color: '#3f3f46', type: 'dashed', width: 1 },
          label: { show: false },
          data: [{ xAxis: matrix.medianIntensity }, { yAxis: matrix.medianProductivity }],
        } : undefined,
      })),
    }
  }, [matrix])

  const typeGroups = useMemo(() => {
    if (!matrix) return []
    const order: LeveragePoint['verdict'][] = ['amplifier_confirmed', 'amplifier_unproven', 'high_potential', 'underperforming', 'low_base']
    return order.map(v => ({ verdict: v, ...verdictMeta[v], items: matrix.points.filter(p => p.verdict === v) }))
  }, [matrix])

  const underBurn = useMemo(() =>
    projects.filter(p => p.quadrant === 'underperforming').reduce((s, p) => s + p.ai_cost, 0),
  [projects])

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-6 pb-24 pt-8">
      <header>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">02 · 分化地图</div>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight text-zinc-50">钱花在哪成了，哪没成？</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          同样投 AI，结果天差地别。位置 = 投入 × 人效，箭头 = 近 6 个月人效趋势——绝对值高不算赢，趋势上行才是真放大。
        </p>
      </header>

      {/* 主图：杠杆有效性矩阵 */}
      <Card className="p-5">
        <SectionHeader
          title="AI 杠杆有效性矩阵"
          caption="气泡大小 = 团队人数 · 虚线 = 全公司中位数 · 点击气泡进入根因诊断"
          right={<div className="flex items-center gap-2"><FactTag /><SimulatedTag /></div>}
        />
        {isLoading || !matrix ? (
          <Skeleton className="mt-4 h-[460px]" />
        ) : (
          <ReactECharts
            option={chartOption}
            style={{ height: 460 }}
            onEvents={{
              click: (params: { data?: (number | string)[] }) => {
                const id = params.data?.[4]
                if (typeof id === 'string') router.push(`/attribution?id=${id}`)
              },
            }}
          />
        )}
        {matrix && (
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            <FactTag /> <span className="ml-1.5">
              已验证放大器仅 {matrix.counts.amplifier_confirmed} 个；{matrix.counts.amplifier_unproven} 个高投入高人效项目趋势未上行（尚不能归功于 AI）；
              {matrix.counts.underperforming} 个待优化项目月烧 {formatWan(underBurn)}；{matrix.counts.high_potential} 个高潜力项目人效好但 AI 渗透低——最该加码的方向。
            </span>
          </p>
        )}
      </Card>

      {/* 三切面 */}
      <div>
        <div className="flex items-center gap-1">
          {([
            ['roles', '同岗位跨部门差距'],
            ['tiers', '用户分层'],
            ['types', '项目分型清单'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${tab === key ? 'bg-blue-500/15 text-blue-300' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Card className="mt-3 p-5">
          {tab === 'roles' && (
            <div>
              <SectionHeader
                title="同一个岗位，不同部门用 AI 的深度差多少倍？"
                caption="人均 AI 成本极值倍数（已剔除小样本与极端值）——差距大 = 内部存在可学习的方法样本"
                right={<FactTag />}
              />
              {divergence.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">上传数据模式暂不支持该分析（缺少序列×部门矩阵）。</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {divergence.slice(0, 6).map(d => {
                    const nameOf = (pid: string) => projects.find(p => p.id === pid)?.name || pid
                    return (
                      <div key={d.role} className="flex items-center gap-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
                        <div className="w-20 shrink-0">
                          <div className="text-sm font-medium text-zinc-200">{d.role}</div>
                          <div className="text-[10px] text-zinc-600">{d.cells.length} 个部门</div>
                        </div>
                        <div className="text-2xl font-bold tabular-nums text-amber-400">{d.gapMultiple}×</div>
                        <div className="flex-1 text-xs leading-5 text-zinc-500">
                          最高 <span className="text-zinc-300">{nameOf(d.maxCell.project_id)}</span> 人均 {formatWan(d.maxCell.per_capita)}（活跃 {d.maxCell.avg_active_days.toFixed(1)} 天）
                          · 最低 <span className="text-zinc-300">{nameOf(d.minCell.project_id)}</span> 人均 {formatWan(d.minCell.per_capita)}（活跃 {d.minCell.avg_active_days.toFixed(1)} 天）
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(`/attribution?id=${d.minCell.project_id}`)}
                          className="shrink-0 text-xs text-zinc-600 transition-colors hover:text-blue-400"
                        >
                          诊断最低 →
                        </button>
                      </div>
                    )
                  })}
                  <p className="pt-1 text-xs text-zinc-600">
                    差距说明决定 AI 使用深度的是部门方法，不是岗位性质——标杆部门的用法就是现成的内部教材。
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'tiers' && (
            <div>
              <SectionHeader
                title="谁在真正用 AI？"
                caption={`全员 ${tierStats.total} 名使用者的分层结构（Power = 月 AI ≥ ¥7,000 且活跃 ≥ 20 天）`}
                right={<FactTag />}
              />
              <div className="mt-5 space-y-3">
                {([
                  ['power', '重度 Power', '#10b981'],
                  ['regular', '中度 Regular', '#3b82f6'],
                  ['light', '轻度 Light', '#f59e0b'],
                ] as ['power' | 'regular' | 'light', string, string][]).map(([key, label, color]) => {
                  const n = tierStats.tiers[key]
                  const pctW = (n / Math.max(tierStats.total, 1)) * 100
                  return (
                    <div key={key} className="flex items-center gap-4">
                      <span className="w-28 shrink-0 text-sm text-zinc-400">{label}</span>
                      <div className="h-7 flex-1 overflow-hidden rounded-md bg-zinc-800/60">
                        <div className="flex h-full items-center rounded-md pl-3 text-xs font-semibold text-zinc-950" style={{ width: `${Math.max(pctW, 7)}%`, backgroundColor: color }}>
                          {n} 人
                        </div>
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm tabular-nums text-zinc-500">{pctW.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                {tierStats.tiers.power} 名 Power 用户（{((tierStats.tiers.power / Math.max(tierStats.total, 1)) * 100).toFixed(0)}%）撑起 {(tierStats.powerCostShare * 100).toFixed(0)}% 的个人 AI 成本——标准二八结构。
                他们是公司最值钱的"方法样本"，也是最不能流失的人（详见 04 决策推演的保人名单）。
              </p>
            </div>
          )}

          {tab === 'types' && matrix && (
            <div>
              <SectionHeader title="27 个业务单元的五型清单" caption="点击项目名进入根因诊断" right={<FactTag />} />
              <div className="mt-4 grid grid-cols-5 gap-3">
                {typeGroups.map(g => (
                  <div key={g.verdict} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-xs font-medium text-zinc-300">{g.label}</span>
                      <span className="ml-auto text-xs tabular-nums text-zinc-600">{g.items.length}</span>
                    </div>
                    <div className="mt-2.5 space-y-1">
                      {g.items.map(p => (
                        <button
                          key={p.project_id}
                          type="button"
                          onClick={() => router.push(`/attribution?id=${p.project_id}`)}
                          className="block w-full truncate text-left text-xs text-zinc-500 transition-colors hover:text-blue-300"
                        >
                          {p.name} <span className="text-zinc-700">{p.trend === 'up' ? '↑' : p.trend === 'down' ? '↓' : '→'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <ChapterTransition
        text={matrix ? `${matrix.counts.underperforming} 个待优化项目月烧 ${formatWan(underBurn)} 但人效没动——为什么？` : '为什么投了钱人效没动？'}
        href="/attribution"
        cta="03 根因诊断"
      />
    </div>
  )
}

/**
 * 六交叉引擎验收脚本：npx tsx scripts/verify-analytics.ts
 * 用真实 demo 数据跑全部 analytics 函数，打印关键数字供人工核对。
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { enrichProjects } from '../src/lib/calculations'
import {
  getLeverageMatrix,
  getRoleDeptDivergence,
  getModelMismatch,
  getPricingMismatch,
  getDependencyFragility,
  getCriticalTalentList,
  buildAttributionEvidence,
  buildVerdictInputs,
} from '../src/lib/analytics'
import { Project, MonthlyRecord, TalentRecord, RoleDeptCell } from '../src/lib/types'

const dir = join(process.cwd(), 'public', 'data', 'demo')
const load = <T,>(f: string): T => JSON.parse(readFileSync(join(dir, f), 'utf-8'))

const projects = enrichProjects(load<Project[]>('projects.json'))
const trend = load<MonthlyRecord[]>('monthly_trend.json')
const talents = load<TalentRecord[]>('talent_risk.json')
const matrix = load<RoleDeptCell[]>('role_dept_matrix.json')

console.log('=== 数据加载 ===')
console.log(`projects=${projects.length} trend=${trend.length} talents=${talents.length} matrix=${matrix.length}`)

console.log('\n=== 交叉① 杠杆矩阵 ===')
const lm = getLeverageMatrix(projects, trend)
console.log('counts:', lm.counts)
console.log('中位数: intensity=', lm.medianIntensity.toFixed(4), 'productivity=', lm.medianProductivity.toFixed(3))
const confirmed = lm.points.filter(p => p.verdict === 'amplifier_confirmed').slice(0, 3)
console.log('放大器(已验证) 示例:', confirmed.map(p => `${p.name} rate=${(p.monthlyRate * 100).toFixed(1)}%/月`))

console.log('\n=== 交叉② 同岗位跨部门 ===')
const div = getRoleDeptDivergence(matrix)
div.slice(0, 5).forEach(d =>
  console.log(`${d.role}: ${d.gapMultiple}× | 最高 ${d.maxCell.project_id} ¥${d.maxCell.per_capita} vs 最低 ${d.minCell.project_id} ¥${d.minCell.per_capita} (${d.cells.length} 格)`)
)

console.log('\n=== 交叉③ 模型×岗位 ===')
const mm = getModelMismatch(projects)
const suspects = mm.filter(m => m.flag === 'mismatch_suspect')
console.log(`疑似错配 ${suspects.length} 个:`, suspects.slice(0, 4).map(s => `${s.name}(${s.dominantRole}, Opus ${(s.expensiveShare * 100).toFixed(0)}%)`))

console.log('\n=== 交叉④ 定价错配 ===')
const pm = getPricingMismatch(talents)
console.log(`高薪低用 ${pm.highPaidLowUse.length} 人 | 高用低薪 ${pm.highUseLowPaid.length} 人 | cr_source=${pm.crSource}`)

console.log('\n=== 交叉⑤ 依赖-脆弱 ===')
const fs5 = getDependencyFragility(talents, projects)
console.log(`扫描 ${fs5.points.length} 人 | 脆弱 ${fs5.fragileCount} 人 | degraded=${fs5.degraded}`)
const topFragile = fs5.points.filter(p => p.fragile).sort((a, b) => b.deptShare - a.deptShare).slice(0, 3)
topFragile.forEach(p => console.log(`  ${p.id} ${p.project_id} ${p.role} share=${(p.deptShare * 100).toFixed(1)}% cr=${p.cr}`))

console.log('\n=== 交叉⑥ 保人名单 ===')
const crit = getCriticalTalentList(talents, projects)
console.log(`关键人才在险 ${crit.length} 人`)
crit.slice(0, 5).forEach(c => console.log(`  ${c.id} ${c.project_name} ${c.role} CR=${c.cr} | ${c.signals.join(' / ')}`))

console.log('\n=== 归因证据包（取一个待优化项目）===')
const underperf = projects.filter(p => p.quadrant === 'underperforming').sort((a, b) => b.ai_cost - a.ai_cost)[0]
if (underperf) {
  const ev = buildAttributionEvidence(underperf.id, projects, trend, talents, matrix)!
  console.log(`项目: ${ev.project.name} | 标杆: ${ev.benchmark?.name}`)
  ev.steps.forEach(s => console.log(`  [${s.severity.padEnd(6)}] ${s.title}: ${s.finding}`))
}

console.log('\n=== ①章 verdict 输入 ===')
const vi = buildVerdictInputs(projects, trend, talents)
console.log('北极星:', {
  人效: vi.northStar.productivity.toFixed(2),
  AI占人力: (vi.northStar.aiToLaborRatio * 100).toFixed(1) + '%',
  在险人才: vi.northStar.criticalTalentCount,
})
console.log('钱:', vi.moneyDim, '\n效率:', { ...vi.efficiencyDim, powerCostShare: (vi.efficiencyDim.powerCostShare * 100).toFixed(1) + '%' })
console.log('人:', { 在险: vi.peopleDim.criticalTalent.length, Power流失: vi.peopleDim.totalPowerExits, 低留任项目: vi.peopleDim.lowStayProjects })

// NaN 扫描
const json = JSON.stringify({ lm, div, mm, pm, crit, vi })
if (json.includes('null,null') || /NaN|Infinity/.test(json)) {
  console.error('\n❌ 检测到 NaN/Infinity！')
  process.exit(1)
}
console.log('\n✅ 全部交叉计算通过，无 NaN/Infinity')

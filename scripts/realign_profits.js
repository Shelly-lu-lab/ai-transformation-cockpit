const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'public', 'data', 'demo')
const projectsPath = path.join(dataDir, 'projects.json')
const trendPath = path.join(dataDir, 'monthly_trend.json')

const realAnnualProfitWan = {
  '项目 Eta': 78661,
  '项目 Lambda': 49563,
  '项目 Chi': 24122,
  '项目 Alpha': 21511,
  '项目 Sigma': 4509,
  '项目 Nova': 2173,
  '项目 Upsilon': 1844,
  '项目 Zeta': 463,
  '项目 Orion': 231,
  '项目 Epsilon': -48,
  '项目 Theta': -926,
}

const costCenters = new Set([
  '项目 Psi',
  '项目 Omicron',
  '项目 Mu',
  '项目 Pi',
  '项目 Nu',
  '项目 Gamma',
  '项目 Xi',
  '项目 Phi',
  '项目 Iota',
  '项目 Aster',
  '项目 Omega',
  '项目 Beta',
  '项目 Kappa',
  '项目 Delta',
  '项目 Tau',
  '项目 Rho',
])

function jitter(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * 0.10
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function realignProjects() {
  const projects = readJson(projectsPath)
  const seenPnL = new Set()
  const seenCostCenters = new Set()

  const nextProjects = projects.map(project => {
    if (Object.prototype.hasOwnProperty.call(realAnnualProfitWan, project.name)) {
      seenPnL.add(project.name)
      const annualWan = realAnnualProfitWan[project.name]
      const monthlyWan = annualWan * 0.8 / 12 * (1 + jitter(project.id))
      const oldMargin = project.revenue !== 0 ? project.profit / project.revenue : 0
      const profit = Math.round(monthlyWan * 10000)
      const revenue = oldMargin !== 0 ? Math.round(profit / oldMargin) : project.revenue
      return {
        ...project,
        profit,
        revenue,
        profit_is_simulated: true,
        revenue_is_simulated: true,
        is_cost_center: false,
      }
    }

    if (costCenters.has(project.name)) {
      seenCostCenters.add(project.name)
      return {
        ...project,
        profit: 0,
        revenue: 0,
        is_cost_center: true,
      }
    }

    return project
  })

  const missingPnL = Object.keys(realAnnualProfitWan).filter(name => !seenPnL.has(name))
  const missingCostCenters = [...costCenters].filter(name => !seenCostCenters.has(name))
  if (missingPnL.length > 0 || missingCostCenters.length > 0) {
    throw new Error(`missing mappings: P&L=${missingPnL.join(',') || 'none'} costCenters=${missingCostCenters.join(',') || 'none'}`)
  }

  writeJson(projectsPath, nextProjects)
  return { previousProjects: projects, nextProjects }
}

function realignTrend(previousProjects, nextProjects) {
  if (!fs.existsSync(trendPath)) return
  const trend = readJson(trendPath)
  const oldById = new Map(previousProjects.map(project => [project.id, project]))
  const nextById = new Map(nextProjects.map(project => [project.id, project]))
  const rowsByProject = new Map()
  trend.forEach(row => {
    const rows = rowsByProject.get(row.project_id) || []
    rows.push(row)
    rowsByProject.set(row.project_id, rows)
  })

  const nextTrend = trend.map(row => {
    const project = nextById.get(row.project_id)
    if (!project) return row
    if (project.is_cost_center) {
      return { ...row, profit: 0, revenue: 0, productivity: 0 }
    }
    if (!Object.prototype.hasOwnProperty.call(realAnnualProfitWan, project.name)) {
      return row
    }
    const rows = rowsByProject.get(row.project_id) || []
    const oldAvgProfit = rows.reduce((sum, item) => sum + (item.profit || 0), 0) / Math.max(rows.length, 1)
    const oldProject = oldById.get(row.project_id)
    const fallbackOldProfit = oldProject?.profit || 0
    const denominator = oldAvgProfit || fallbackOldProfit
    const ratio = denominator !== 0 ? project.profit / denominator : 1
    const nextRevenue = Math.round((row.revenue || oldProject?.revenue || 0) * ratio)
    return {
      ...row,
      profit: Math.round((row.profit || denominator) * ratio),
      revenue: nextRevenue,
      productivity: row.labor_cost > 0 ? Number((nextRevenue / row.labor_cost).toFixed(3)) : 0,
    }
  })
  writeJson(trendPath, nextTrend)
}

function validate(projects) {
  const pnl = projects.filter(project => !project.is_cost_center)
  const cost = projects.filter(project => project.is_cost_center)
  const totalMonthlyProfitWan = pnl.reduce((sum, project) => sum + project.profit, 0) / 10000
  const expectedTotalWan = Object.values(realAnnualProfitWan).reduce((sum, value) => sum + value, 0) * 0.8 / 12
  const rows = Object.entries(realAnnualProfitWan).map(([name, annualWan]) => {
    const project = projects.find(item => item.name === name)
    const expected = annualWan * 0.8 / 12
    const actual = project.profit / 10000
    const diff = expected === 0 ? 0 : Math.abs(actual - expected) / Math.abs(expected)
    return { name, id: project.id, actual, expected, diff }
  })

  const badRows = rows.filter(row => row.diff > 0.0501)
  const badCostCenters = cost.filter(project => project.profit !== 0 || project.revenue !== 0)
  const invalidTrend = fs.existsSync(trendPath)
    ? readJson(trendPath).filter(row => !Number.isFinite(row.profit ?? 0) || !Number.isFinite(row.revenue ?? 0))
    : []

  if (pnl.length !== Object.keys(realAnnualProfitWan).length) throw new Error(`expected 11 P&L projects, got ${pnl.length}`)
  if (cost.length !== costCenters.size) throw new Error(`expected 16 cost centers, got ${cost.length}`)
  if (badRows.length > 0) throw new Error(`profit jitter outside 5%: ${badRows.map(row => row.name).join(', ')}`)
  if (badCostCenters.length > 0) throw new Error(`cost centers not zero: ${badCostCenters.map(row => row.name).join(', ')}`)
  if (invalidTrend.length > 0) throw new Error(`invalid trend rows: ${invalidTrend.length}`)

  console.log(`P&L projects: ${pnl.length}`)
  console.log(`Cost centers: ${cost.length}`)
  console.log(`Total monthly profit: ${totalMonthlyProfitWan.toFixed(1)} 万`)
  console.log(`Expected monthly profit baseline: ${expectedTotalWan.toFixed(1)} 万`)
  rows.forEach(row => console.log(`${row.id} ${row.name}: ${row.actual.toFixed(1)} 万 (${(row.diff * 100).toFixed(2)}% from baseline)`))
  console.log(`Cost center profits all zero: ${cost.every(project => project.profit === 0 && project.revenue === 0)}`)
}

const { previousProjects, nextProjects } = realignProjects()
realignTrend(previousProjects, nextProjects)
validate(nextProjects)

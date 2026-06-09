import { Project, ProjectWithMetrics, Quadrant, CompanySummary, TalentRecord, TalentRiskSummary } from './types'

export function getProductivity(project: Project): number {
  const totalCost = project.labor_cost + project.ai_cost
  if (totalCost === 0) return 0
  return project.profit / totalCost
}

export function getAiIntensity(project: Project): number {
  if (project.labor_cost === 0) return 0
  return project.ai_cost / project.labor_cost
}

export function getQuadrant(
  productivity: number,
  aiIntensity: number,
  medianProductivity: number,
  medianAiIntensity: number
): Quadrant {
  if (aiIntensity > medianAiIntensity && productivity > medianProductivity) return 'amplifier'
  if (aiIntensity > medianAiIntensity && productivity <= medianProductivity) return 'underperforming'
  if (aiIntensity <= medianAiIntensity && productivity > medianProductivity) return 'high_potential'
  return 'low_base'
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function enrichProjects(projects: Project[]): ProjectWithMetrics[] {
  const productivities = projects.map(getProductivity)
  const intensities = projects.map(getAiIntensity)
  const medProd = median(productivities)
  const medInt = median(intensities)

  return projects.map((p, i) => ({
    ...p,
    productivity: productivities[i],
    ai_intensity: intensities[i],
    quadrant: getQuadrant(productivities[i], intensities[i], medProd, medInt),
  }))
}

export function getCompanySummary(projects: ProjectWithMetrics[]): CompanySummary {
  const total_headcount = projects.reduce((s, p) => s + p.headcount, 0)
  const total_labor_cost = projects.reduce((s, p) => s + p.labor_cost, 0)
  const total_ai_cost = projects.reduce((s, p) => s + p.ai_cost, 0)
  const total_revenue = projects.reduce((s, p) => s + p.revenue, 0)
  const total_profit = projects.reduce((s, p) => s + p.profit, 0)
  const ai_to_labor_ratio = total_labor_cost > 0 ? total_ai_cost / total_labor_cost : 0
  const avg_productivity = (total_labor_cost + total_ai_cost) > 0
    ? total_profit / (total_labor_cost + total_ai_cost) : 0

  const quadrant_distribution: Record<Quadrant, number> = {
    amplifier: 0, underperforming: 0, high_potential: 0, low_base: 0
  }
  projects.forEach(p => { quadrant_distribution[p.quadrant]++ })

  return {
    total_headcount,
    total_labor_cost,
    total_ai_cost,
    total_revenue,
    total_profit,
    ai_to_labor_ratio,
    avg_productivity,
    project_count: projects.length,
    quadrant_distribution,
  }
}

export function getTalentRiskSummary(projectId: string, talents: TalentRecord[]): TalentRiskSummary {
  const projectTalents = talents.filter(t => t.project_id === projectId)
  const powerUsers = projectTalents.filter(t => t.tier === 'power')
  const highRisk = projectTalents.filter(t => t.risk_level === 'high')

  return {
    project_id: projectId,
    total: projectTalents.length,
    power_users: powerUsers.length,
    high_risk_count: highRisk.length,
    high_risk_profiles: highRisk.slice(0, 5),
  }
}

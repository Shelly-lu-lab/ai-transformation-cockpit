'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Project, MonthlyRecord, TalentRecord, ProjectWithMetrics, CompanySummary } from './types'
import { enrichProjects, getCompanySummary } from './calculations'

interface AppData {
  projects: ProjectWithMetrics[]
  monthlyTrend: MonthlyRecord[]
  talentRisk: TalentRecord[]
  companySummary: CompanySummary
  isLoading: boolean
  error: string | null
}

const DataContext = createContext<AppData>({
  projects: [],
  monthlyTrend: [],
  talentRisk: [],
  companySummary: {
    total_headcount: 0, total_labor_cost: 0, total_ai_cost: 0,
    total_revenue: 0, total_profit: 0, ai_to_labor_ratio: 0,
    avg_productivity: 0, project_count: 0,
    quadrant_distribution: { amplifier: 0, underperforming: 0, high_potential: 0, low_base: 0 },
  },
  isLoading: true,
  error: null,
})

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>({
    projects: [],
    monthlyTrend: [],
    talentRisk: [],
    companySummary: {
      total_headcount: 0, total_labor_cost: 0, total_ai_cost: 0,
      total_revenue: 0, total_profit: 0, ai_to_labor_ratio: 0,
      avg_productivity: 0, project_count: 0,
      quadrant_distribution: { amplifier: 0, underperforming: 0, high_potential: 0, low_base: 0 },
    },
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [projRes, trendRes, riskRes] = await Promise.all([
          fetch('/data/demo/projects.json'),
          fetch('/data/demo/monthly_trend.json'),
          fetch('/data/demo/talent_risk.json'),
        ])

        if (!projRes.ok || !trendRes.ok || !riskRes.ok) {
          throw new Error('数据加载失败')
        }

        const rawProjects: Project[] = await projRes.json()
        const monthlyTrend: MonthlyRecord[] = await trendRes.json()
        const talentRisk: TalentRecord[] = await riskRes.json()

        const projects = enrichProjects(rawProjects)
        const companySummary = getCompanySummary(projects)

        setData({ projects, monthlyTrend, talentRisk, companySummary, isLoading: false, error: null })
      } catch (err) {
        setData(prev => ({ ...prev, isLoading: false, error: (err as Error).message }))
      }
    }
    loadData()
  }, [])

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>
}

export function useAppData() {
  return useContext(DataContext)
}

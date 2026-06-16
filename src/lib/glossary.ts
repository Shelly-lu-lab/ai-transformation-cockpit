export type GlossaryKey =
  | 'power'
  | 'critical_talent'
  | 'productivity_trend_up'
  | 'amplifier_confirmed'
  | 'underperforming'
  | 'high_potential'
  | 'observe'
  | 'cr_proxy'
  | 'model_mismatch'
  | 'roi'
  | 'money_dim'
  | 'efficiency_dim'
  | 'people_dim'
  | 'dept_share'
  | 'fragility'
  | 'ai_intensity'

export const GLOSSARY: Record<GlossaryKey, { term: string; short: string; long: string }> = {
  power: {
    term: '重度使用者',
    short: '月 AI 成本 >= 7000 元且活跃 >= 20 天的人',
    long: '同时满足两个条件的员工：月 AI 工具成本至少 7000 元，且月活跃天数不少于 20 天。代表真正在用 AI 干活的人，是判断 AI 转型是否落地的核心样本。',
  },
  critical_talent: {
    term: '高流失风险人才',
    short: '重度使用者 + 薪酬偏低 + 团队流失环境',
    long: '这类人既在高强度使用 AI，又处在薪酬位档偏低或团队流失压力较高的环境中。预算调整时要先保护，否则可能影响已形成的 AI 使用能力。',
  },
  productivity_trend_up: {
    term: '人效在改善',
    short: '近 6 个月人效趋势为正向',
    long: '用近 6 个月的人效走势做回归判断，只有持续向上才算改善，避免把单月波动误判成真实提升。',
  },
  amplifier_confirmed: {
    term: 'AI 已让人效变好',
    short: 'AI 投入高、人效高，并且趋势继续向上',
    long: '这类项目不只是用了 AI，也呈现出人效改善信号，适合作为方法复用和预算加码的参考样本。',
  },
  underperforming: {
    term: '待改善',
    short: 'AI 投入高，但人效没有同步改善',
    long: '说明钱已经花出去，但还没有转化为经营产出。通常要先查模型、使用人群、活跃深度和组织环境。',
  },
  high_potential: {
    term: '待加码',
    short: '人效好，但 AI 渗透还低',
    long: '这类项目业务产出基础好，AI 还没有充分覆盖，适合用小规模预算实验验证加码空间。',
  },
  observe: {
    term: '暂不下结论',
    short: '样本不足或趋势不显著',
    long: '当前数据还不足以支持明确判断，建议继续跟踪趋势，不急着做预算动作。',
  },
  cr_proxy: {
    term: '薪酬位档（代理口径）',
    short: '用公开行业薪酬带替代真实薪酬竞争力',
    long: '本系统未接入公司完整薪酬库，采用公开行业薪酬带作为代理标尺。代理口径不等于真实 Compa-Ratio，仅用于相对比较。',
  },
  model_mismatch: {
    term: '模型用错地方了',
    short: '非技术岗位大量使用高价模型',
    long: '如果非技术岗位大量使用高成本模型，但产出没有同步改善，就可能存在模型选择过重、使用方法不匹配或培训不到位。',
  },
  roi: {
    term: '每投 1 元拿回多少利润',
    short: '利润 / 人力与 AI 总投入',
    long: '把利润除以人力成本和 AI 成本之和，用来判断投入是否真正转化成经营结果。',
  },
  money_dim: {
    term: '钱花得值吗',
    short: '看 AI 投入是否转化为人效和利润',
    long: '这个维度关注预算是否投到了有效项目上，以及高投入项目有没有产生对应回报。',
  },
  efficiency_dim: {
    term: '效率撬动了吗',
    short: '看使用深度、覆盖度和方法复用',
    long: '这个维度关注员工是否真的把 AI 用进工作流，而不是只产生零散工具费用。',
  },
  people_dim: {
    term: '人扛得住吗',
    short: '看关键使用者是否稳定',
    long: '这个维度关注 AI 转型依赖的人才是否有流失或激励风险。',
  },
  dept_share: {
    term: '个人占部门 AI 成本比例',
    short: '某个人的 AI 成本 / 所在部门 AI 总成本',
    long: '比例越高，说明团队越依赖少数人使用 AI；如果这个人薪酬位档又偏低，团队风险会上升。',
  },
  fragility: {
    term: '团队依赖脆弱点',
    short: '少数人承担过多 AI 使用能力',
    long: '当一个团队的 AI 使用高度集中在少数人身上，这些人一旦流失，团队的 AI 转型能力可能明显回退。',
  },
  ai_intensity: {
    term: 'AI 投入强度',
    short: 'AI 成本 / 人力成本',
    long: '表示每 1 元人力成本对应投入了多少 AI 成本，用来比较不同项目的 AI 投入力度。',
  },
}

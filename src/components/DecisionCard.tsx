'use client'

import { ChatResponse } from '@/lib/types'

type DecisionCardData = NonNullable<ChatResponse['decision_card']>

interface DecisionCardProps extends DecisionCardData {
  onAdjust?: () => void
}

export function DecisionCard({
  title,
  expected_saving,
  productivity_delta,
  actions,
  talent_guards,
  evidence,
  onAdjust,
}: DecisionCardProps) {
  return (
    <article className="rounded-lg border border-blue-500/30 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{title}</h3>
          <p className="mt-1 text-sm text-zinc-400">基于当前项目组合、人才护栏和 AI 投入结构生成</p>
        </div>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-200">
          Decision
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-500">预计节省</div>
          <div className="mt-2 text-2xl font-bold text-green-300">{expected_saving}</div>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-500">预计人效变化</div>
          <div className="mt-2 text-2xl font-bold text-blue-300">{productivity_delta}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <section className="col-span-2">
          <h4 className="text-sm font-semibold text-zinc-100">建议动作</h4>
          <div className="mt-3 space-y-3">
            {actions.map((item, index) => (
              <div key={`${item.target}-${index}`} className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-sm font-medium text-zinc-100">
                  {index + 1}. {item.target}
                </div>
                <div className="mt-1 text-sm text-zinc-400">{item.action}</div>
                <div className="mt-2 text-xs text-blue-200">{item.impact}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-semibold text-zinc-100">人才护栏</h4>
          <div className="mt-3 space-y-3">
            {talent_guards.map((item, index) => (
              <div key={`${item.target}-${index}`} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="text-sm font-medium text-amber-100">{item.target}</div>
                <div className="mt-1 text-xs text-amber-100/80">{item.role}</div>
                <div className="mt-2 text-xs leading-5 text-amber-100/70">{item.reason}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5">
        <h4 className="text-sm font-semibold text-zinc-100">依据</h4>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-zinc-400">
          {evidence.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </section>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400"
        >
          导出报告
        </button>
        <button
          type="button"
          onClick={onAdjust}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
        >
          调整条件
        </button>
      </div>
    </article>
  )
}

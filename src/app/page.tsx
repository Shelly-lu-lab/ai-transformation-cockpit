'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const steps = [
  '识别数据结构... 27 个业务单元',
  '多源字段映射与归集',
  '人效指标计算',
  'AI 价值信号分析',
  '人才护栏扫描',
]

export default function Home() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)

  function startDemo() {
    if (isProcessing) return
    setIsProcessing(true)
    steps.forEach((_, index) => {
      window.setTimeout(() => setActiveStep(index), (index + 1) * 600)
    })
    window.setTimeout(() => router.push('/overview'), (steps.length + 1) * 600)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1440px] items-center justify-center px-6 py-10">
      <section className="w-full max-w-[800px] text-center">
        <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-lg border border-blue-500/40 bg-blue-500/10 text-sm font-bold text-blue-300">
          ROI
        </div>
        <h1 className="text-5xl font-semibold tracking-tight text-zinc-50">人效作战室</h1>
        <p className="mt-4 text-lg text-zinc-400">AI 时代的人力资本 ROI 决策引擎</p>

        <div className="mt-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 p-10">
          <div className="text-sm font-medium text-zinc-200">上传三类数据，AI 自动生成作战室</div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-sm text-zinc-400">
            <button
              type="button"
              onClick={() => alert('Demo 模式请使用下方"示例数据"按钮体验完整功能')}
              className="group cursor-pointer rounded-md border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-blue-500/50 hover:bg-zinc-900"
            >
              <div className="mx-auto mb-2 text-xl text-zinc-600 group-hover:text-blue-400">📊</div>
              <div>业务产出</div>
              <div className="mt-1 text-[10px] text-zinc-600">收入/利润数据</div>
            </button>
            <button
              type="button"
              onClick={() => alert('Demo 模式请使用下方"示例数据"按钮体验完整功能')}
              className="group cursor-pointer rounded-md border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-blue-500/50 hover:bg-zinc-900"
            >
              <div className="mx-auto mb-2 text-xl text-zinc-600 group-hover:text-blue-400">💰</div>
              <div>人力成本</div>
              <div className="mt-1 text-[10px] text-zinc-600">薪酬/编制数据</div>
            </button>
            <button
              type="button"
              onClick={() => alert('Demo 模式请使用下方"示例数据"按钮体验完整功能')}
              className="group cursor-pointer rounded-md border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-blue-500/50 hover:bg-zinc-900"
            >
              <div className="mx-auto mb-2 text-xl text-zinc-600 group-hover:text-blue-400">🤖</div>
              <div>AI 使用</div>
              <div className="mt-1 text-[10px] text-zinc-600">AI工具使用日志</div>
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4">
            <p className="text-xs text-zinc-600">Demo 模式仅展示数据归集流程</p>
            <span className="text-zinc-700">|</span>
            <button
              type="button"
              onClick={() => alert('数据模板下载功能将在正式版中提供。\n\n模板包含三份 Excel：\n1. 业务产出（项目×月度收入/利润）\n2. 人力成本（部门×薪酬/编制）\n3. AI使用日志（员工×平台×成本）')}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              📥 下载数据模板
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={startDemo}
          disabled={isProcessing}
          className="mt-8 h-12 rounded-md bg-blue-500 px-7 text-sm font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {isProcessing ? '正在生成作战室' : '使用示例数据体验'}
        </button>

        {isProcessing ? (
          <div className="mx-auto mt-8 max-w-xl rounded-lg border border-zinc-700/50 bg-zinc-900 p-4 text-left">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Processing</div>
            <div className="mt-4 space-y-3">
              {steps.map((step, index) => {
                const done = activeStep >= index
                return (
                  <div
                    key={step}
                    className={[
                      'flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-opacity duration-300',
                      done
                        ? 'border-blue-500/30 bg-blue-500/10 text-zinc-100 opacity-100'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-600 opacity-60',
                    ].join(' ')}
                  >
                    <span className={done ? 'text-blue-300' : 'text-zinc-700'}>{done ? '✓' : '•'}</span>
                    {step}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

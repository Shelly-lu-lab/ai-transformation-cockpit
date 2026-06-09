'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'

const steps = [
  '识别数据结构...',
  '多源字段映射与归集',
  '人效指标计算',
  'AI 价值信号分析',
  '人才护栏扫描',
]

interface FileInfo {
  name: string
  rows: number
  cols: number
  columns: string[]
}

const SLOTS = [
  { key: 'revenue', label: '业务产出', sub: '收入/利润数据', icon: '📊' },
  { key: 'cost', label: '人力成本', sub: '薪酬/编制数据', icon: '💰' },
  { key: 'ai', label: 'AI 使用', sub: 'AI工具使用日志', icon: '🤖' },
] as const

export default function Home() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [files, setFiles] = useState<Record<string, FileInfo | null>>({ revenue: null, cost: null, ai: null })
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({ revenue: null, cost: null, ai: null })

  function handleFileSelect(slotKey: string, file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][]
        const headers = (jsonData[0] || []) as string[]
        setFiles(prev => ({
          ...prev,
          [slotKey]: {
            name: file.name,
            rows: jsonData.length - 1,
            cols: headers.length,
            columns: headers.slice(0, 6),
          },
        }))
      } catch {
        setFiles(prev => ({
          ...prev,
          [slotKey]: { name: file.name, rows: 0, cols: 0, columns: ['解析失败，请检查文件格式'] },
        }))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function startDemo() {
    if (isProcessing) return
    setIsProcessing(true)
    const uploadedCount = Object.values(files).filter(Boolean).length
    const stepTexts = [
      `识别数据结构... ${uploadedCount > 0 ? `已加载 ${uploadedCount} 份文件` : '27 个业务单元'}`,
      '多源字段映射与归集',
      '人效指标计算',
      'AI 价值信号分析',
      '人才护栏扫描',
    ]
    stepTexts.forEach((_, index) => {
      window.setTimeout(() => setActiveStep(index), (index + 1) * 600)
    })
    window.setTimeout(() => router.push('/overview'), (stepTexts.length + 1) * 600)
  }

  const uploadedCount = Object.values(files).filter(Boolean).length

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1440px] items-center justify-center px-6 py-10">
      <section className="w-full max-w-[860px] text-center">
        <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-lg border border-blue-500/40 bg-blue-500/10 text-sm font-bold text-blue-300">
          ROI
        </div>
        <h1 className="text-5xl font-semibold tracking-tight text-zinc-50">AI 人效决策引擎</h1>
        <p className="mt-4 text-lg text-zinc-400">用 AI 算清 AI 转型这笔账：投入在哪里撬动了人效，在哪里需要调整</p>

        <div className="mt-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 p-8">
          <div className="text-sm font-medium text-zinc-200">上传三类数据，AI 自动生成作战室</div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {SLOTS.map(slot => {
              const info = files[slot.key]
              return (
                <div key={slot.key} className="relative">
                  <input
                    ref={el => { fileInputRefs.current[slot.key] = el }}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(slot.key, file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[slot.key]?.click()}
                    className={`group w-full cursor-pointer rounded-lg border p-4 text-left transition-all ${
                      info
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-zinc-800 bg-zinc-950 hover:border-blue-500/50 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info ? '✓' : slot.icon}</span>
                      <span className={`text-sm font-medium ${info ? 'text-green-300' : 'text-zinc-200'}`}>
                        {slot.label}
                      </span>
                    </div>
                    {info ? (
                      <div className="mt-2 space-y-1">
                        <div className="truncate text-xs text-zinc-400">{info.name}</div>
                        <div className="text-xs text-green-400/80">
                          {info.rows} 行 × {info.cols} 列
                        </div>
                        <div className="truncate text-[10px] text-zinc-500">
                          {info.columns.join(', ')}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="text-xs text-zinc-500">{slot.sub}</div>
                        <div className="mt-1 text-[10px] text-blue-400/60 group-hover:text-blue-400">
                          点击上传 .xlsx / .csv
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
            {uploadedCount > 0 && (
              <span className="text-green-400">已上传 {uploadedCount}/3 份文件</span>
            )}
            {uploadedCount === 0 && <span>支持 Excel (.xlsx) 和 CSV 格式</span>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={startDemo}
            disabled={isProcessing}
            className="h-12 rounded-md bg-blue-500 px-7 text-sm font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {isProcessing ? '正在生成作战室...' : uploadedCount > 0 ? `基于上传数据生成 (${uploadedCount}/3)` : '使用示例数据体验'}
          </button>
        </div>

        {isProcessing && (
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
        )}
      </section>
    </div>
  )
}

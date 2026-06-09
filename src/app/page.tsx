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

export default function Home() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [files, setFiles] = useState<FileInfo[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFiles(fileList: FileList) {
    const results: FileInfo[] = []
    let processed = 0
    const total = fileList.length

    Array.from(fileList).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][]
          const headers = (jsonData[0] || []) as string[]
          results.push({
            name: file.name,
            rows: jsonData.length - 1,
            cols: headers.length,
            columns: headers.slice(0, 5),
          })
        } catch {
          results.push({ name: file.name, rows: 0, cols: 0, columns: ['解析失败'] })
        }
        processed++
        if (processed === total) {
          setFiles(results)
        }
      }
      reader.readAsArrayBuffer(file)
    })
  }

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
      <section className="w-full max-w-[860px] text-center">
        <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-lg border border-blue-500/40 bg-blue-500/10 text-sm font-bold text-blue-300">
          AI
        </div>
        <h1 className="text-5xl font-semibold tracking-tight text-zinc-50">AI 人效决策引擎</h1>
        <p className="mt-4 text-lg text-zinc-400">用 AI 算清 AI 转型这笔账：投入在哪里撬动了人效，在哪里需要调整</p>

        <div className="mt-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 p-8">
          <div className="text-sm font-medium text-zinc-200">上传三类数据，AI 自动生成决策分析</div>
          <p className="mt-2 text-xs text-zinc-500">支持一次选择多个文件（业务产出 + 人力成本 + AI 使用日志），格式：.xlsx / .csv</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files)
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 w-full cursor-pointer rounded-lg border-2 border-dashed border-zinc-600 bg-zinc-950/50 px-6 py-8 text-center transition-colors hover:border-blue-500/60 hover:bg-zinc-900"
          >
            <div className="text-2xl text-zinc-500">📂</div>
            <div className="mt-2 text-sm text-zinc-300">点击选择文件（可多选）</div>
            <div className="mt-1 text-xs text-zinc-500">或拖拽文件到此处</div>
          </button>

          {files.length > 0 && (
            <div className="mt-4 space-y-2 text-left">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2">
                  <span className="text-green-400">✓</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-zinc-200">{f.name}</div>
                    <div className="text-xs text-zinc-500">{f.rows} 行 × {f.cols} 列 · {f.columns.join(', ')}</div>
                  </div>
                </div>
              ))}
              <div className="text-center text-xs text-green-400">已识别 {files.length} 份数据文件</div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={startDemo}
            disabled={isProcessing}
            className="h-12 rounded-md bg-blue-500 px-7 text-sm font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {isProcessing ? '正在生成...' : files.length > 0 ? `基于上传数据生成分析` : '使用示例数据体验'}
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

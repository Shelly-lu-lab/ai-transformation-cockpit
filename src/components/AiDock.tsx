'use client'

import { FormEvent, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { MarkdownContent } from './MarkdownContent'
import { useAiDock } from '@/lib/AiDockProvider'

const chapterMeta: Record<string, { label: string; key: string; questions: string[] }> = {
  '/verdict': {
    label: '01 总体判断',
    key: 'verdict',
    questions: ['放大器项目有什么共性？', '为什么评级不是 A？', '经营层先看哪三个信号？'],
  },
  '/divergence': {
    label: '02 分化地图',
    key: 'divergence',
    questions: ['差距最大的岗位是什么？', '哪些项目最适合加码？', '模型错配集中在哪里？'],
  },
  '/attribution': {
    label: '03 根因诊断',
    key: 'attribution',
    questions: ['根因优先级怎么排？', '和标杆差距最大在哪里？', '如果只能先做一件事？'],
  },
  '/decision': {
    label: '04 决策推演',
    key: 'decision',
    questions: ['这套方案最大风险是什么？', '护栏名单怎么处理？', '三个月怎么验证效果？'],
  },
}

function currentMeta(pathname: string) {
  return chapterMeta[pathname] || { label: '驾驶舱', key: pathname.replace('/', '') || 'home', questions: ['当前页面该怎么看？', '最值得关注的异常是什么？', '下一步该做什么？'] }
}

export function AiDock() {
  const pathname = usePathname()
  const params = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [input, setInput] = useState('')
  const { messages, isLoading, sendMessage, clearHistory } = useAiDock()

  const meta = useMemo(() => currentMeta(pathname), [pathname])
  const projectId = params.get('id') || params.get('from') || undefined
  const unread = collapsed && messages[messages.length - 1]?.role === 'ai'

  function submit(message: string) {
    const trimmed = message.trim()
    if (!trimmed) return
    void sendMessage(trimmed, { chapter: meta.key, page: pathname, projectId })
    setInput('')
    setCollapsed(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(input)
  }

  if (collapsed) {
    return (
      <aside className="sticky top-16 h-[calc(100vh-4rem)] w-10 shrink-0 py-6">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="relative flex h-full w-10 items-start justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 pt-4 text-xs font-semibold tracking-[0.18em] text-cyan-200 shadow-lg shadow-cyan-950/30 transition-colors hover:border-cyan-300/50"
        >
          <span className="vertical-rl writing-mode-vertical">AI</span>
          {unread ? <span className="absolute right-1.5 top-2 h-2 w-2 rounded-full bg-red-400" /> : null}
        </button>
      </aside>
    )
  }

  return (
    <aside className="sticky top-16 h-[calc(100vh-4rem)] w-[360px] shrink-0 py-6 pr-6">
      <section className="flex h-full flex-col rounded-2xl border border-cyan-400/20 bg-[#0f172a]/90 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <header className="border-b border-white/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">AI Copilot</div>
              <div className="mt-1 rounded-full border border-zinc-700/80 bg-zinc-950/70 px-2.5 py-1 text-xs text-zinc-400">
                当前章节：{meta.label}
              </div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={clearHistory} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
                清空
              </button>
              <button type="button" onClick={() => setCollapsed(true)} className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
                折叠
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/50 p-4 text-sm leading-6 text-zinc-500">
              对话历史会在本次会话内跨章节保留。系统会自动带入当前章节和项目上下文。
            </div>
          ) : messages.map(message => (
            <div key={message.id} className={message.role === 'user' ? 'ml-8 rounded-xl bg-blue-500/15 px-3 py-2 text-sm text-blue-100' : 'mr-4 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm leading-6 text-zinc-300'}>
              <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                {message.role === 'user' ? 'You' : 'AI'} · {message.chapter}
              </div>
              {message.role === 'ai' ? <MarkdownContent content={message.text} /> : message.text}
            </div>
          ))}
          {isLoading ? (
            <div className="mr-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
              AI 正在结合当前章节上下文分析...
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {meta.questions.map(question => (
              <button
                key={question}
                type="button"
                onClick={() => submit(question)}
                disabled={isLoading}
                className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="向 AI 追问..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-10 rounded-lg bg-cyan-500 px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              发送
            </button>
          </form>
        </div>
      </section>
    </aside>
  )
}

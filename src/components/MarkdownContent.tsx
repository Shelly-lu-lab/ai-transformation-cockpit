'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-100 prose-headings:font-semibold prose-h2:text-base prose-h3:text-sm prose-p:text-zinc-300 prose-p:leading-relaxed prose-li:text-zinc-300 prose-strong:text-zinc-100 prose-table:text-xs prose-th:text-zinc-400 prose-td:text-zinc-300 prose-th:border-zinc-700 prose-td:border-zinc-800 prose-hr:border-zinc-700">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

import type { Metadata } from 'next'
import './globals.css'
import { DataProvider } from '@/lib/DataProvider'
import { Nav } from '@/components/Nav'

export const metadata: Metadata = {
  title: 'AI 人效决策引擎',
  description: '用 AI 算清 AI 转型这笔账：投入在哪里撬动了人效，在哪里需要调整',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full bg-zinc-950 antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-50">
        <DataProvider>
          <div className="hidden min-h-screen items-center justify-center bg-zinc-950 p-8 text-center text-zinc-200 max-[1279px]:flex">
            <div className="max-w-md rounded-lg border border-zinc-700/50 bg-zinc-900 p-6">
              <div className="text-lg font-semibold">请使用桌面端查看</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                人效作战室为 1280px 以上经营分析大屏优化，请切换到更宽的窗口。
              </p>
            </div>
          </div>
          <div className="min-h-screen min-w-[1280px] bg-zinc-950 max-[1279px]:hidden">
            <Nav />
            <main>{children}</main>
          </div>
        </DataProvider>
      </body>
    </html>
  )
}

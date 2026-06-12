import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { DataProvider } from '@/lib/DataProvider'
import { AiDockProvider } from '@/lib/AiDockProvider'
import { Nav } from '@/components/Nav'
import { AiDock } from '@/components/AiDock'

export const metadata: Metadata = {
  title: 'AI 转型驾驶舱',
  description: '面向经营层的 AI 转型投入、效率、人才与决策驾驶舱',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full bg-[#0b1020] antialiased">
      <body className="min-h-full text-zinc-50">
        <DataProvider>
          <AiDockProvider>
          <div className="hidden min-h-screen items-center justify-center bg-[#0b1020] p-8 text-center text-zinc-200 max-xl:flex">
            <div className="max-w-md rounded-lg border border-zinc-700/50 bg-zinc-900 p-6">
              <div className="text-lg font-semibold">请使用桌面端查看</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                AI 转型驾驶舱为 1280px 以上经营分析大屏优化，请切换到更宽的窗口。
              </p>
            </div>
          </div>
          <div className="min-h-screen min-w-[1280px] max-xl:hidden">
            <Nav />
            <div className="mx-auto flex max-w-[1800px] items-start">
              <main className="min-w-0 flex-1">{children}</main>
              <Suspense fallback={null}>
                <AiDock />
              </Suspense>
            </div>
          </div>
          </AiDockProvider>
        </DataProvider>
      </body>
    </html>
  )
}

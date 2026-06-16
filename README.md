# AI 转型驾驶舱 (AI Transformation Cockpit)

> 让经营层把每一分 AI 投入，变成看得见的人效。

面向企业 CHO / 经营管理层的 AI 原生决策引擎——一站式回答「AI 转型预算花得值不值」，从全公司打分、跨项目分化、单项目根因，一直到可执行行动方案与关键人才保护。

---

## 业务问题

公司推动 AI 转型已经一段时间，每季度业务团队的汇报都很漂亮——AI 上线了，人效提升了，流程优化了。但经营层心里清楚，这些数字背后**谁是真用上了 AI、谁只是凑了个数**，没有人能说清楚。想砍掉低效投入，又怕动到核心人才；想保人，又怕钱继续白烧。决策卡住了。

**AI 转型驾驶舱**专门来回答这个问题。

## 四章节决策旅程

| 章节 | 业务问题 | 核心能力 |
|---|---|---|
| **01 总体判断** | AI 转型整体值不值？ | 6 仪表盘 / 三维健康度评级 / 12 月趋势 / AI 主动巡检发现 |
| **02 分化地图** | 钱花在哪儿成了，哪儿没成？ | 5 张交叉图：项目分布矩阵 / 角色×模型 / 岗位×部门热力 / 薪酬位档分布 / 部门依赖散点 |
| **03 根因诊断** | 单个项目到底为什么没起来？ | 五步推理链 (模型 → 人 → 深度 → 流失 → 组织) + 标杆对照 + AI 综合主要矛盾 |
| **04 决策推演** | 接下来怎么投？ | AI 实时生成行动卡 + 关键人才保护检查 + 推演对比 |

## 产品亮点

- **事实层 + AI 研判层 双层互证**：系统先把事实算清楚，AI 再加上判断，每个判断都有可追溯的数据出处
- **关键人才保护检查**：方案触及核心人才（重度使用者 ∩ 薪酬偏低 ∩ 流失环境）时自动亮护栏，AI 主动给方案上保险
- **AI Copilot 跨章节追问**：右侧持久对话坞，跨章节保留历史，自动带入当前章节上下文
- **主流分类优先原则**：内置规则确保 AI 洞察聚焦主流业务分类，"其他/未分类"等聚合类别自动降级
- **大白话约束**：BASE_RULES 强制 AI 输出经营层语言，禁用术语 / 英文 schema key / meta 表达

## 技术栈

- **前端**：Next.js 16 (webpack mode) / TypeScript / Tailwind CSS v4 / ECharts
- **AI**：Claude Sonnet 4.6（通过企业 AI 网关）/ mode-based 架构（verdict / attribution / decision / drilldown）
- **数据**：脱敏后真实业务数据（27 业务单元 / 1520 员工）
- **架构原则**：
  - 确定性计算（六交叉口径）落在前端 analytics 层
  - AI 只做综合研判，不重复确定性逻辑
  - JSON Schema 校验失败统一归一，保证 UI 可渲染

## 数据合规

所有数据已经过严格脱敏：
- 项目名 → 希腊字母代号（项目 Alpha / Eta / Lambda 等）
- 员工 → E-XXX 编码
- 部门 → P-XX 代号
- 利润 / 收入 → 按业务规模缩放 + 随机扰动
- 薪酬位档 → 用公开行业 P50/P75 做代理口径（非真实 Compa-Ratio）

业务产出字段标注 `is_simulated: true`，敬业度 / 留任意愿仅作团队级背景，禁止用于个人结论。

## 如何在本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置 AI API（创建 .env.local）
cp .env.example .env.local
# 编辑 .env.local 填入：
# ANTHROPIC_BASE_URL=<your-api-endpoint>
# ANTHROPIC_AUTH_TOKEN=<your-api-key>
# ANTHROPIC_MODEL=claude-sonnet-4-6

# 3. 启动开发服务器
npm run dev

# 4. 浏览器打开
open http://localhost:3000
```

> **首次访问每个章节时 AI 需要 ~25 秒生成内容**（实时调用大模型，非预先生成）。AI 输出会缓存到 sessionStorage，后续访问秒出。

## 项目结构

```
roi-war-room/
├── src/
│   ├── app/                  # Next.js routes
│   │   ├── verdict/          # 01 总体判断
│   │   ├── divergence/       # 02 分化地图
│   │   ├── attribution/      # 03 根因诊断
│   │   ├── decision/         # 04 决策推演
│   │   └── api/chat/         # AI mode-based 后端
│   ├── components/           # UI 组件 (AiDock / TermTooltip / ui kit)
│   └── lib/
│       ├── analytics.ts      # 六交叉计算引擎（确定性）
│       ├── prompts.ts        # AI prompts (BASE_RULES + 4 mode prompts)
│       ├── aiSchemas.ts      # AI 响应 schema + extractJson 解析容错
│       └── glossary.ts       # 术语字典 + TermTooltip 释义
└── public/data/demo/         # 4 份脱敏 demo 数据
```

## 比赛信息

- **赛事**：HRflag 首届全球 HR 精英 AI 黑客松大赛 2026
- **赛道**：AI 原生系统应用 (AI-Native Application)
- **目标用户**：企业 CHO / 经营管理层 / HR COE

---

## License

本项目仅用于 HRflag 黑客松比赛展示用途。

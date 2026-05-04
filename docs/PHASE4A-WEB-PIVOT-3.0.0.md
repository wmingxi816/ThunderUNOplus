# Phase 4A：HTML 网页端转向与首版客户端骨架

## 阶段结论

根据 `IMPORTANT.md`，项目从本阶段开始废弃微信小游戏 / Cocos Creator 方向，改为 HTML 网页端实现。

规则和牌库配置保持不变：

- `GAME-RULES.md`
- `CARD-CONFIG.md`
- `packages/uno-core/src/config.ts`
- `packages/uno-core/src/cardConfig.ts`

## 仓库审计

逐阶段确认结果：

| 阶段 | 结论 |
| --- | --- |
| Phase 1 | 保留，monorepo 地基可复用 |
| Phase 2A | 保留，规则基础层可复用 |
| Phase 2B | 保留，reducer 可复用 |
| Phase 2C | 保留，协议和玩家视角快照可复用 |
| Phase 2D | 保留，CLI 模拟器可复用 |
| Phase 3A | 保留，内存房间服务可复用 |
| Phase 3B | 保留，WebSocket 网关可复用 |
| Phase 3C | 保留，本地多客户端联调脚本可复用 |
| Phase 4A 到 5B 旧方向 | 废弃，微信小游戏 / Cocos 专项内容不再继续 |

## 已删除内容

删除的旧方向文档：

- `docs/Cococreater-Build.md`
- `docs/COCOS-UI-PLACEMENT-GUIDE.md`
- `docs/PHASE4A-CLIENT-WECHAT-2.7.0.md`
- `docs/PHASE4B-CLIENT-COCOS-WIRING.md`
- `docs/PHASE4C-LOCAL-PLAYTEST.md`
- `docs/PHASE4D-COCOS-SCENE-PREFAB-WIRING.md`
- `docs/PHASE5A-WECHAT-DEVTOOLS-DEBUG.md`
- `docs/PHASE5B-ADD.md`

删除理由：

- 依赖 `apps/client-wechat` 或 `apps/NewProject`
- 面向 Cocos Creator 场景、prefab、微信小游戏构建
- 面向微信开发者工具和真机预览
- 不适用于 HTML 网页端

## 已新增内容

新增 `apps/client-web`：

- `index.html`
- `vite.config.ts`
- `src/main.ts`
- `src/styles.css`
- `src/app/config.ts`
- `src/network/wsClient.ts`
- `src/protocol/clientMessages.ts`
- `src/cards/cardAssets.ts`
- `public/cards/*.png`

新增文档：

- `docs/PHASE4A-WEB-PIVOT-3.0.0.md`

重写文档：

- `README.md`
- `next-step.md`
- `docs/项目开发文档.md`

## 网页端首版能力

`apps/client-web` 当前支持：

1. 连接 `ws://localhost:8787`
2. 手动覆盖为 `ws://局域网IP:8787`
3. 创建房间
4. 加入房间
5. 离开房间
6. 房主开始游戏
7. 展示 lobby 玩家列表
8. 展示对局快照
9. 渲染顶牌、牌堆、对手、手牌
10. 点击手牌发送 `play-card`
11. 发送摸牌、结算加牌、结算罚抽、UNO、抓 UNO、质疑命令

## 只适用于微信 / Cocos 的内容

已识别为不适用于 HTML 网页端：

- `wx.connectSocket`
- `game.json`
- `project.config.json`
- 微信开发者工具调试配置
- Cocos Creator scene / prefab 序列化工程
- Cocos 节点拖拽绑定说明
- 微信小游戏 AppID / 合法域名 / 真机预览流程

## 继续保留的服务端能力

`apps/game-server` 已经支持：

- `HOST=0.0.0.0`
- `PORT=8787`
- 本地 `ws://localhost:8787`
- 局域网 `ws://电脑IP:8787`

这对网页端开发仍然有效。

## 测试覆盖

新增测试：

- `apps/client-web/src/app/config.test.ts`
- `apps/client-web/src/cards/cardAssets.test.ts`

覆盖内容：

- 默认 WebSocket URL
- 局域网地址补全 `ws://`
- 保持 `ws://` 和 `wss://` 不变
- 牌面资产路径映射

## 尚未实现

- 三浏览器窗口完整试玩验收
- 页面内黑牌颜色选择器
- 顺子、连对、同色丢弃的正式 UI
- 对局结束页
- 断线重连 UI
- 移动端细节适配
- 正式部署
- 登录、数据库、排行榜、商城、支付

## 下一阶段建议

进入 Phase 4B：HTML 网页端本地三人真实试玩闭环。

建议优先处理：

1. 三窗口真实联调。
2. 修复 `playerId` 识别边界。
3. 改善错误提示和操作禁用状态。
4. 把黑牌声明颜色改为页面内 UI。
5. 补齐多牌操作。
6. 增加浏览器冒烟测试。

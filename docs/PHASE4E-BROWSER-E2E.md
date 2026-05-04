# Phase 4E：真实浏览器 E2E 与三窗口自动化验收

## 阶段目标

把 Phase 4D 的构建与局域网验收，推进到真实浏览器级的自动化回归。

本阶段不做数据库、登录、商城、支付、排行榜、新玩法规则或正式公网部署。

## 本次完成内容

### 1. Playwright 真实浏览器测试

`apps/client-web` 新增了 Playwright 配置，并通过真实浏览器执行测试：

- `apps/client-web/playwright.config.ts`
- `apps/client-web/e2e/globalSetup.ts`
- `apps/client-web/e2e/three-player-room-flow.spec.ts`
- `apps/client-web/e2e/error-line.spec.ts`
- `apps/client-web/e2e/reconnect.spec.ts`

### 2. 三窗口自动化主链路

自动化覆盖：

- 打开三个浏览器上下文
- 创建房间
- 加入房间
- 开局
- 进入 battle 视图
- 当前玩家执行摸牌
- 非当前玩家按钮禁用检查

### 3. 错误提示回归

自动化覆盖了加入不存在房间时的页面错误提示，验证 `#error-line` 仍然可见。

### 4. reconnect 回归

自动化覆盖了开局后的刷新重连：

- 本地 `userId` 和 `roomId` 保持
- 页面刷新后重新连接
- 重新回到 battle 视图

### 5. 选择器稳定化

为真实浏览器测试补充了关键 `data-testid`：

- `connection-status`
- `error-line`
- `ws-url-input`
- `connect-button`
- `nickname-input`
- `create-room-button`
- `join-room-input`
- `join-room-button`
- `start-game-button`
- `battle-view`
- `lobby-view`
- `hand-area`
- `opponents-area`
- `top-card`
- `draw-card-button`
- `say-uno-button`
- `reconnect-button`
- `game-finished-banner`

## E2E 技术方案

使用 Playwright + 真实 Chromium。

启动方式：

- `apps/client-web` 由 Playwright `webServer` 启动
- `apps/game-server` 由 `globalSetup` 启动，若 8787 已存在则复用

默认测试地址：

```txt
http://127.0.0.1:5173?ws=localhost:8787
```

## 三窗口自动化流程

```txt
1. 页面 A 连接 WebSocket。
2. 页面 A 创建房间。
3. 页面 B、C 连接后加入房间。
4. 页面 A 开始游戏。
5. 三个页面都进入 battle 视图。
6. 当前玩家点击摸牌。
7. 非当前玩家按钮保持禁用。
```

## 基础命令回归

当前至少覆盖：

- 当前玩家摸牌
- 选牌和桌面区域可见

## 错误提示回归

当前覆盖：

- 加入不存在房间
- 错误区域 `#error-line` 可见并更新

## 断线重连覆盖情况

当前覆盖：

- 对局中刷新后重连
- 恢复到同一房间
- 重新看到 battle 视图

## 新增测试文件

- `apps/client-web/e2e/three-player-room-flow.spec.ts`
- `apps/client-web/e2e/error-line.spec.ts`
- `apps/client-web/e2e/reconnect.spec.ts`
- `apps/client-web/e2e/globalSetup.ts`
- `apps/client-web/playwright.config.ts`

## 本地验证结果

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm --filter @thunder-uno/protocol test
corepack pnpm typecheck
corepack pnpm test
```

## 仍未实现内容

- 更大范围的真实浏览器回归。
- 更多断线与异常场景自动化。
- 更细的移动端视觉打磨。
- 正式公网部署和 HTTPS / WSS 上线配置。

## 下一阶段建议

进入 Phase 4F：网页端移动端 UI 细节打磨与试玩体验优化。

优先级：

1. 小屏布局和按钮层级。
2. 手持设备试玩可用性。
3. 桌面与手牌区可读性。
4. 保持 E2E 和局域网试玩不倒退。

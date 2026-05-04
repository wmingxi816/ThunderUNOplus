# Phase 4D：网页端发布前构建与局域网验收

## 阶段目标

把 Phase 4C 的网页端试玩链路推进到可以打包、可以 preview、可以在局域网手机和其他电脑上验收的状态。

本阶段不做数据库、登录、商城、支付、排行榜、新玩法规则或正式公网部署。

## 本次完成内容

### 1. 生产构建验证

`apps/client-web` 已可以稳定执行生产构建：

```bash
corepack pnpm --filter @thunder-uno/client-web build
```

构建产物会输出到 `apps/client-web/dist`，包含页面入口、样式和静态资源。

### 2. Preview 验证说明

`apps/client-web` 保留了 preview 命令，并在 README 中说明了访问方式：

```bash
corepack pnpm --filter @thunder-uno/client-web preview
```

默认端口为 `4173`，与开发模式的 `5173` 区分开。

### 3. 牌面资源完整性检查

新增 `cardAssetsIntegrity.test.ts`，会遍历网页端使用到的所有卡牌资源路径，并确认 `public/cards` 中实际存在对应 PNG。

同时也确认了牌背 `69_back.png` 存在。

### 4. WebSocket 地址解析收口

`normalizeWsUrl()` 已支持：

- `localhost:8787` -> `ws://localhost:8787`
- `192.168.x.x:8787` -> `ws://192.168.x.x:8787`
- `ws://...` 保持不变
- `wss://...` 保持不变

页面上的 WebSocket 地址输入框会展示当前地址。

### 5. 局域网试玩说明

README 已补充局域网试玩步骤：

- 服务端监听 `0.0.0.0`
- 网页端使用 `--host 0.0.0.0`
- 手机或其他电脑使用 `http://电脑局域网IP:5173?ws=电脑局域网IP:8787`
- preview 场景则改用 `4173`
- 补充了防火墙、端口占用和 `ws` / `wss` 区别

## 生产构建验证

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web build
```

## Preview 验证

`apps/client-web` 支持：

```bash
corepack pnpm --filter @thunder-uno/client-web preview
```

README 已写明默认端口是 `4173`。

## 局域网验收步骤

```txt
1. 启动 game-server，并监听 0.0.0.0。
2. 启动 client-web dev 或 preview。
3. 在手机或另一台电脑上打开电脑局域网 IP。
4. 使用 ?ws=电脑局域网IP:8787 指向本机服务端。
5. 确认能连接、建房、进房和开始游戏。
```

## 牌面资源完整性检查

新增测试：

- `apps/client-web/src/cards/cardAssetsIntegrity.test.ts`

检查范围：

- 70 张卡牌资源
- 牌背资源
- `getCardAssetPath()` 的输出是否真的落在 `public/cards`

## WebSocket 地址配置说明

已验证支持：

- `http://localhost:5173`
- `http://localhost:5173?ws=localhost:8787`
- `http://电脑局域网IP:5173?ws=电脑局域网IP:8787`

## 新增测试

- `apps/client-web/src/cards/cardAssetsIntegrity.test.ts`
- `apps/client-web/src/app/config.test.ts`

## 本地验证结果

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm --filter @thunder-uno/protocol test
corepack pnpm typecheck
corepack pnpm test
```

## 仍未实现内容

- Playwright 级真实浏览器 E2E。
- 三窗口自动化联调回归。
- 更完整的移动端视觉重构。
- 正式公网部署和 HTTPS / WSS 上线配置。

## 下一阶段建议

进入 Phase 4E：真实浏览器 E2E 与三窗口自动化验收。

优先级：

1. 多窗口真实浏览器自动化。
2. 更稳的回归脚本。
3. 继续保留局域网试玩说明。
4. 准备更接近发布形态的联调清单。

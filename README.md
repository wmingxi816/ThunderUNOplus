# 雷霆UNOplus

《雷霆UNOplus》是一款面向线下聚会场景的微信小游戏实时多人卡牌项目。当前仓库已经完成从规则引擎、协议层、本地模拟器，到内存房间服务和真实 WebSocket 网关的基础建设。

当前规则和牌库来源：

- [GAME-RULES.md](./GAME-RULES.md)
- [CARD-CONFIG.md](./CARD-CONFIG.md)

## 当前阶段

已完成阶段：

- Phase 1：monorepo 地基
- Phase 2A：`packages/uno-core` 规则基础层
- Phase 2B：完整对局 reducer
- Phase 2C：共享类型、协议收口、玩家视角快照
- Phase 2D：本地 CLI 连续对局模拟器
- Phase 3A：`apps/game-server` 内存房间容器与命令分发
- Phase 3B：真实 WebSocket 接入、本地联调客户端、集成测试
- Phase 3C：本地多客户端 WebSocket 联调脚本
- Phase 4A：`apps/client-wechat` 基础 UI 骨架、网络层与本地状态管理
- Phase 4B：Cocos-ready 场景控制器、节点绑定适配与点击联调骨架

阶段文档：

- [docs/PHASE1-SCAFFOLD-1.0.1.md](./docs/PHASE1-SCAFFOLD-1.0.1.md)
- [docs/PHASE2A-UNO-CORE-2.0.0.md](./docs/PHASE2A-UNO-CORE-2.0.0.md)
- [docs/PHASE2B-UNO-CORE-2.1.0.md](./docs/PHASE2B-UNO-CORE-2.1.0.md)
- [docs/PHASE2C-PROTOCOL-AND-VIEW-2.2.0.md](./docs/PHASE2C-PROTOCOL-AND-VIEW-2.2.0.md)
- [docs/PHASE2D-CLI-SIMULATOR-2.3.0.md](./docs/PHASE2D-CLI-SIMULATOR-2.3.0.md)
- [docs/PHASE3A-GAME-SERVER-2.4.0.md](./docs/PHASE3A-GAME-SERVER-2.4.0.md)
- [docs/PHASE3B-WS-GATEWAY-2.5.0.md](./docs/PHASE3B-WS-GATEWAY-2.5.0.md)
- [docs/PHASE3C-MULTI-CLIENT-SCENARIO-2.6.0.md](./docs/PHASE3C-MULTI-CLIENT-SCENARIO-2.6.0.md)
- [docs/PHASE4A-CLIENT-WECHAT-2.7.0.md](./docs/PHASE4A-CLIENT-WECHAT-2.7.0.md)
- [docs/PHASE4B-CLIENT-COCOS-WIRING.md](./docs/PHASE4B-CLIENT-COCOS-WIRING.md)
- [docs/STATE_MACHINE.md](./docs/STATE_MACHINE.md)
- [docs/PROTOCOL.md](./docs/PROTOCOL.md)

## 仓库结构

```txt
.
├─ apps
│  ├─ client-wechat
│  │  └─ src
│  └─ game-server
│     └─ src
├─ docs
├─ packages
│  ├─ protocol
│  │  └─ src
│  ├─ shared-types
│  │  └─ src
│  └─ uno-core
│     └─ src
├─ tools
│  └─ simulator
│     ├─ src
│     └─ tests
├─ CARD-CONFIG.md
├─ GAME-RULES.md
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## 目录职责

### `packages/shared-types`

跨端共享领域模型：

- `Card`
- `Player`
- `GameState`
- `RoomState`
- `GameMode`
- `GameCommand`
- `GameEvent`

### `packages/protocol`

协议层定义：

- `ClientMessage`
- `ServerMessage`
- `PlayerRoomSnapshot`
- `PlayerGameSnapshot`
- `ProtocolErrorCode`
- `PROTOCOL_VERSION`

### `packages/uno-core`

唯一规则归属地：

- 牌库生成和洗牌
- 开局初始化
- 出牌和结算 reducer
- 视角快照裁剪
- 规则单元测试

### `apps/game-server`

当前已经实现：

- `RoomManager`
- `ConnectionRegistry`
- `dispatchCommand`
- WebSocket 网关
- reconnect 流程
- lobby `room-state` 广播
- playing `snapshot` 广播
- 本地 `dev` server / `dev:client`
- `DevWsClient` 多客户端假客户端
- `dev:scenario` 联调脚本

仍未实现：

- 数据库
- 持久化事件流
- 微信登录
- 正式线上部署

### `apps/client-wechat`

当前已经实现微信小游戏客户端的纯 TypeScript 骨架：

- `WsClient` WebSocket 封装
- `MessageRouter`
- `SessionStore / RoomStore / BattleStore`
- `Login / Lobby / Room / Battle` 场景骨架
- `CardView / HandArea / PlayerSeat` 等基础组件
- 出牌、摸牌、UNO、质疑、结算的消息组装
- `LoginSceneController / LobbySceneController / RoomSceneController / BattleSceneController`
- `CardViewBinding / HandAreaBinding / PlayerSeatBinding`
- `createBattleViewModel`
- `assets/scenes/*.scene` 节点清单资源

仍未实现：

- 真实 Cocos prefab / 节点树
- 微信登录
- 最终美术与动画

### `tools/simulator`

本地命令行模拟器：

- `simulate`
- `batch`
- invariant 校验
- 压测规则引擎长局行为

### `docs`

架构说明、阶段记录、协议和状态机文档。

## 常用命令

根目录：

- `corepack pnpm install`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`

协议层：

- `corepack pnpm --filter @thunder-uno/protocol test`
- `corepack pnpm --filter @thunder-uno/protocol typecheck`

规则层：

- `corepack pnpm --filter @thunder-uno/uno-core test`
- `corepack pnpm --filter @thunder-uno/uno-core typecheck`

模拟器：

- `corepack pnpm --filter @thunder-uno/simulator simulate --players 4 --mode no-challenge --seed 1001`
- `corepack pnpm --filter @thunder-uno/simulator batch --games 20 --players 4 --mode no-challenge`

WebSocket 服务端：

- `corepack pnpm --filter @thunder-uno/game-server dev`
- `corepack pnpm --filter @thunder-uno/game-server dev:client`
- `corepack pnpm --filter @thunder-uno/game-server dev:scenario --players 3 --mode no-challenge`
- `corepack pnpm --filter @thunder-uno/game-server test`
- `corepack pnpm --filter @thunder-uno/game-server typecheck`

客户端骨架：

- `corepack pnpm --filter @thunder-uno/client-wechat typecheck`
- `corepack pnpm --filter @thunder-uno/client-wechat test`

## 开发原则

- 服务端必须是权威状态。
- 客户端只能发送命令，不能自己裁定规则是否合法。
- 所有规则判断必须落在 `packages/uno-core`。
- 所有协议定义必须收口到 `packages/protocol`。
- 所有快照都必须按玩家视角裁剪，不能泄露别人的手牌和隐藏挑战信息。

## 下一阶段建议

1. 进入 Phase 4C，做本地多端真实试玩修复。
2. 重点实测 3 客户端建房、进房、开局、出牌、摸牌、UNO、质疑和断线重连。
3. 继续保持所有对局交互只走 `packages/protocol` 和 `apps/game-server`，不要把规则搬回客户端。

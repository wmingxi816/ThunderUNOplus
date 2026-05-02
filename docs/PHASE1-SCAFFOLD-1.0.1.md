# 雷霆UNOplus 第一阶段交付清单 1.0.1

## 本次生成内容

### Monorepo 根配置

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`

### 共享包

- `packages/shared-types`
  - 定义 `Card`、`Player`、`GameState`、`RoomState`、`GameMode`、`GameCommand`、`GameEvent`
- `packages/protocol`
  - 定义命令信封、事件信封、协议版本、错误码、房间快照、对局快照
- `packages/uno-core`
  - 定义规则来源、牌库常量、房间限制、规则引擎接口契约

### 应用入口

- `apps/client-wechat`
  - 预留微信小游戏客户端入口与运行时契约
- `apps/game-server`
  - 预留权威服务端入口与运行时契约

### 文档

- `README.md`
- `docs/STATE_MACHINE.md`
- `docs/PROTOCOL.md`

## 本次没有实现的内容

- Cocos UI
- WebSocket 服务
- 数据库
- 微信登录
- 完整规则引擎
- 房间管理器
- 断线重连具体实现

## 当前规则来源

- `GAME-RULES.md`
- `CARD-CONFIG.md`

## 下一阶段建议

1. 在 `packages/uno-core` 实现初始发牌和对局开始逻辑。
2. 在 `packages/uno-core` 实现基础命令校验与状态推进。
3. 在 `apps/game-server` 搭建内存房间容器。
4. 在 `packages/protocol` 实现面向不同玩家的快照裁剪策略。
5. 在 `apps/client-wechat` 开始接入座位布局和房间页。

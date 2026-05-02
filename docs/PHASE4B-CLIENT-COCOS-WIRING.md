# Phase 4B：Cocos 场景挂载与点击联调

## 本阶段完成内容

本阶段在 `apps/client-wechat` 上继续向前推进了一层：把 Phase 4A 的纯 TypeScript 场景逻辑，挂成了可直接绑定 Cocos 节点的控制器与 binding 适配层。

当前已经新增：

- `src/cocos/controllers/`
  - `LoginSceneController`
  - `LobbySceneController`
  - `RoomSceneController`
  - `BattleSceneController`
- `src/cocos/bindings/`
  - `CardViewBinding`
  - `HandAreaBinding`
  - `PlayerSeatBinding`
  - `uiTypes`
- `src/cocos/viewModels/createBattleViewModel.ts`
- `src/cocos/SceneNavigator.ts`
- `assets/scenes/*.scene`

## 场景资源说明

当前仓库还不是完整的 Cocos Creator 序列化工程目录，所以 `assets/scenes/*.scene` 先作为“节点清单资源”存在，用来固定每个场景需要挂哪些节点和控制器。

建议在 Creator 中按这些名字建立节点，并把对应控制器接上：

- `assets/scenes/LoginScene.scene`
- `assets/scenes/LobbyScene.scene`
- `assets/scenes/RoomScene.scene`
- `assets/scenes/BattleScene.scene`

## 本地联调步骤

1. 启动本地服务端：

```bash
corepack pnpm --filter @thunder-uno/game-server dev
```

2. 打开 `apps/client-wechat` 对应的 Cocos / 微信小游戏工程。
3. 让客户端连接 `ws://localhost:8787`。
4. 至少开 3 个客户端实例，或 1 个客户端配合 `dev:scenario` / `dev:client` 辅助联调。
5. A 客户端在 `LoginScene` 输入昵称并连接服务端。
6. A 进入 `LobbyScene`，点击创建房间。
7. B / C 输入房间号加入房间。
8. A 在 `RoomScene` 点击开始游戏。
9. 所有客户端收到第一份 `snapshot` 后进入 `BattleScene`。
10. 玩家点击手牌出牌，或点击摸牌 / UNO / 质疑 / 结算按钮。
11. 查看服务端日志和客户端 Toast 是否一致。

## 已验证命令

已通过纯 TypeScript 层验证：

- `corepack pnpm --filter @thunder-uno/client-wechat typecheck`
- `corepack pnpm --filter @thunder-uno/client-wechat test`
- `corepack pnpm typecheck`
- `corepack pnpm test`

## 当前仍未实现

- 真实 Creator 序列化 `.scene` / `.prefab` 资源
- 真机微信小游戏调试
- 正式卡牌美术
- 复杂动画与音效
- 更细的断线重连 UI

## 下一阶段

进入 Phase 4C：

- 本地多端真实试玩
- 修联调过程中暴露的按钮显隐、文案和状态同步问题
- 压实断线重连与事件提示体验

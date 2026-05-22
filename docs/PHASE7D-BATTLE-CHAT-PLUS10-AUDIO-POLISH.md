# Phase 7D：对战聊天、`+10` 清链规则与音频/聊天收口

## 阶段目标

Phase 7D 记录的是一轮“把战斗体验真正打磨到玩家能直接感受到”的收口工作。重点不在于继续堆系统，而在于把已经上线的战斗 UI、聊天能力、黑牌规则和音频反馈修成统一口径，减少误解、误操作和视觉噪音。

这一轮最终落下了 4 组变化：

1. `变色 +10` 的第二张不再继续叠加，而是清空整条当前加牌链  
2. 对战页正式接入瞬时聊天气泡  
3. 出局音效改为正常速度播放，并在播放时压低背景音乐  
4. 大厅/对战聊天交互去掉冷却，同时修正己方大厅消息布局和设置面板滚动跳回问题

## 与旧阶段文档的关系

本阶段不是独立推翻旧规则，而是对以下内容做正式覆盖或补充：

- 它细化了 `PHASE2B` 中“`+10` 抵消已有加牌链”的旧表述：  
  现在的最终口径是：**仅当当前链顶已经是 `wild-draw-ten` 时，第二张 `+10` 清空整条链；第三张 `+10` 再重新开一条新的 `10` 加牌链。**
- 它补完了 `PHASE7A` 里 battle UI 只做到音效和牌桌表现、但还没有战斗聊天的空白。
- 它扩展了 `PHASE7C` 的音频和日志收口，把“出局音效压低 BGM、取消倍速、聊天不再冷却、设置滚动位置保持”等后来继续迭代出的真实行为正式写进阶段记录。

## 核心变化

### 1. `+10` 清链规则

- `wild-draw-ten` 仍然可以接在较低等级的加牌链后面，比如 `+2 / +4 / 反转+4 / +6`
- 但当当前链顶已经是 `wild-draw-ten` 时，再打一张 `wild-draw-ten`：
  - 不再把压力继续从 `22` 抬到 `32`
  - 而是**直接清空整条当前加牌链**
  - 第二张 `+10` 只保留变色功能
- 这条规则的延伸行为也已经锁定：
  - `+10 -> +10`：旧链被清空
  - `+10 -> +10 -> +10`：前两个 `+10` 清掉旧链；第三张 `+10` 因为已经不在接旧链，所以重新开启新的 `10` 加牌链
- 前端 tooltip、战斗 toast、bot 推演都同步到了同一口径，不再出现“文案说能抵消，但机器人和 reducer 仍按继续叠加算”的分裂状态

### 2. 对战聊天气泡

- 正式启用现有 `battle-chat` 协议，不新增新消息类型
- 对战 HUD 增加 `聊天` 按钮，与 `设置 / 规则 / 退出房间` 同一视觉带
- 点击后打开一个小输入面板：
  - 输入框上限 `30` 字
  - 回车或点击发送都可发出 `battle-chat`
  - 发送后默认收起输入面板
- 收到 `battle-chat` 后：
  - 在对应玩家卡片旁边的空位显示聊天气泡
  - 气泡持续 `8` 秒
  - 同一玩家新消息覆盖旧消息并重新计时
  - 新 snapshot 到达时，未过期气泡不会闪断
- 气泡颜色按玩家头像稳定配色派生为红/黄/蓝/绿四类主题，并按 battle 背景重新收了透明度、阴影和文字颜色

### 3. 音频与设置体验

- 出局音效资源继续使用 `apps/client-web/public/sounds/出局音效.mp3`
- 这一轮把出局音效改成：
  - **正常速度播放**
  - 不再设置 `playbackRate = 2`
  - 播放期间自动把 battle / lobby 背景音乐压低到当前音量的 `40%`
  - 停止后自动恢复原背景音乐音量
- 设置面板内部滚动位置现在会在实时刷新前后保持：
  - 战斗中即使别人出牌触发新 snapshot
  - 已打开的设置面板也不会再跳回顶部

### 4. 聊天体验小修

- 大厅聊天和对战聊天都移除了发送冷却
- 服务端不再返回：
  - `Lobby chat is cooling down.`
  - `Battle chat is cooling down.`
- 大厅里己方消息的 DOM 顺序和布局也做了修正：
  - 己方气泡在左、头像在右
  - 整体靠右对齐
  - 中文换行从激进的 `anywhere` 收成正常的 `break-word`
  - 不再出现“消息跑到头像右边、每个字单独断行”的情况

## 影响文件

### 规则与核心状态

- `packages/uno-core/src/reducer/applyPlayCard.ts`
- `packages/uno-core/src/reducer/applyCommand.turn.test.ts`
- `packages/uno-core/src/rules/canStackDrawCard.test.ts`

### 前端

- `apps/client-web/src/main.ts`
- `apps/client-web/src/styles.css`
- `apps/client-web/src/protocol/clientMessages.test.ts`
- `apps/client-web/src/smoke/appBoot.test.ts`
- `apps/client-web/public/update-log.md`

### 服务端

- `apps/game-server/src/gateway/messageHandler.ts`
- `apps/game-server/src/tests/messageHandler.test.ts`
- `apps/game-server/src/bot/botScoring.ts`
- `apps/game-server/src/bot/strategies/chaosStrategy.ts`
- `apps/game-server/src/bot/strategies/mischiefStrategy.ts`

## 验证记录

本阶段完成后，执行过以下针对性验证：

```bash
corepack pnpm --filter @thunder-uno/uno-core exec vitest run src/reducer/applyCommand.turn.test.ts src/rules/canStackDrawCard.test.ts
corepack pnpm --filter @thunder-uno/game-server exec vitest run src/tests/chaosStrategy.test.ts src/tests/mischiefStrategy.test.ts
corepack pnpm --filter @thunder-uno/game-server exec vitest run src/tests/messageHandler.test.ts -t "lobby-chat 可以连续发送两条而不会触发冷却拦截|battle-chat 可以连续发送两条而不会触发冷却拦截"
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web exec vitest run src/smoke/appBoot.test.ts -t "preserves the settings modal scroll position across live battle rerenders"
corepack pnpm --filter @thunder-uno/client-web exec vitest run src/smoke/appBoot.test.ts -t "opens a battle chat composer|renders battle chat bubbles"
```

额外说明：

- 出局音效压低背景音乐与取消倍速的定向 smoke 已通过
- `client-web` 全量 smoke 中仍有一条旧的套件级音频串行问题，属于历史测试干扰，不是本轮功能本身失效

## 验收标准

本阶段完成后应满足：

1. `+10` 接 `+10` 时会清空整条当前加牌链，而不是继续叠加  
2. `+10 -> +10 -> +10` 时，第三张 `+10` 会重新开启新的 `10` 加牌链  
3. 对战页顶部存在聊天按钮，发送后对应玩家卡片旁能显示 `8` 秒聊天气泡  
4. 同一玩家重复发言只保留一个气泡，新消息覆盖旧消息  
5. 对战聊天按钮和面板采用银色系，气泡透明度为 `70%`  
6. 出局音效播放时背景音乐会临时压低，并在停止后恢复  
7. 出局音效不再倍速播放  
8. 设置面板在战斗实时刷新时保留内部滚动位置  
9. 大厅与对战聊天都可连续发送，不再出现 `cooling down` 提示  
10. 大厅里己方聊天消息布局正常，头像在右、消息靠右且不会一字一行

## 后续建议

如果后面继续沿这条线打磨，建议拆成下面几个方向：

1. 如果继续增强 battle chat，可单独做 `PHASE7E`，记录快捷短语、表情、聊天记录面板或更复杂的气泡动画  
2. 如果继续深化 `胡闹bot / 混沌bot` 在 `+10` 清链规则下的更细致取舍，再开一篇 bot 策略阶段  
3. 如果后面把音频全量 smoke 的串行问题清掉，建议单独记一次测试基础设施修复，不和功能阶段混在一起

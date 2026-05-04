# 雷霆UNOplus 第二阶段 B 交付清单 2.1.0

## 阶段目标

本阶段继续只实现 `packages/uno-core`，把上一阶段的“基础规则判定”推进成“可运行的完整对局 reducer”。

本阶段仍然**不实现**：

- Cocos UI
- WebSocket
- 数据库
- 微信登录
- `apps/game-server`
- 真实联网房间

---

## 本次完成内容

### 1. 统一命令入口

已新增：

- `packages/uno-core/src/reducer/applyCommand.ts`
- `packages/uno-core/src/reducer/types.ts`

已实现：

- `applyCommand(state, command): { state, events }`
- 非法命令返回 `command-rejected` 事件
- reducer 保持纯函数更新

当前支持命令：

- `play-card`
- `play-sequence`
- `play-multiple-number`
- `play-discard-same-color`
- `draw-card`
- `resolve-draw-stack`
- `resolve-draw-until-color`
- `say-uno`
- `report-uno`
- `challenge-draw`

---

### 2. 完整运行时状态

已更新：

- `packages/uno-core/src/gameState.ts`
- `packages/uno-core/src/setup/createInitialGame.ts`

已补齐：

- `status`
- `now`
- `drawStack`
- `drawUntilColor`
- `challengeWindow`
- `winnerPlayerIds`
- 玩家 `UNO` 待喊状态
- 玩家淘汰状态

`GameMode` 现已统一为：

```ts
"with-challenge" | "no-challenge"
```

---

### 3. 回合推进与技能效果

已新增：

- `packages/uno-core/src/reducer/applyPlayCard.ts`
- `packages/uno-core/src/reducer/turn.ts`
- `packages/uno-core/src/reducer/effects.ts`

当前已实现：

- 普通单张出牌
- 顺子出牌
- 连对出牌
- 同色丢弃出牌
- 禁
- 反转
- 交换手牌
- 变色
- 普通 `+2`
- 普通 `+4`
- `反转变色+4`
- `变色+6`
- `变色+10`
- `+10` 抵消已有加牌链
- `罚抽`
- `罚抽` 叠加覆盖颜色

---

### 4. 摸牌、加牌链、罚抽与质疑

已新增：

- `packages/uno-core/src/reducer/applyDrawCard.ts`
- `packages/uno-core/src/reducer/applyDrawStack.ts`
- `packages/uno-core/src/reducer/applyDrawUntilColor.ts`
- `packages/uno-core/src/reducer/applyChallenge.ts`

当前已实现：

- 普通摸 1 张
- 摸到可出牌时自动打出
- 摸到黑牌时不自动打出
- `with-challenge` 模式下创建质疑窗口
- `no-challenge` 模式下不创建质疑窗口
- 质疑成功时被质疑者罚摸 2 张，质疑失败时质疑者罚摸 6 张
- 下一家完成行动后关闭旧质疑窗口
- 加牌链结算
- 罚抽直到摸到指定颜色为止

---

### 5. UNO、淘汰与胜利

已新增：

- `packages/uno-core/src/reducer/applyUno.ts`

当前已实现：

- 手牌变成 1 张进入 UNO 待喊状态
- `say-uno`
- `report-uno`
- 5 秒保护期，基于 `timestampMs` / `state.now` 判断
- 手牌超过 25 张淘汰
- 只剩 1 名未淘汰玩家时结束
- 玩家打出最后一张牌时立即获胜
- 最后一张是技能牌时也立即获胜，效果不再改变胜负

---

### 6. 测试覆盖

已新增：

- `packages/uno-core/src/reducer/testUtils.ts`
- `packages/uno-core/src/reducer/applyCommand.turn.test.ts`
- `packages/uno-core/src/reducer/applyCommand.draw.test.ts`
- `packages/uno-core/src/reducer/applyCommand.uno.test.ts`

本轮已验证通过：

```bash
pnpm --filter @thunder-uno/uno-core test
pnpm --filter @thunder-uno/uno-core typecheck
```

当前测试结果：

- `11` 个测试文件
- `57` 个测试
- 全部通过

---

## 当前仍未完成的内容

对照 `next-step.md`，这一轮还留有这些缺口：

- 还没有把 `uno-core` 的命令 / 事件类型同步回 `packages/shared-types`
- 还没有把这些 reducer 命令同步到 `packages/protocol`
- 还没有补 `docs/STATE_MACHINE.md` 的完整 Phase 2B 状态流转图
- 还没有补“弃牌堆回洗成摸牌堆”的牌堆耗尽处理
- 还没有实现更细的事件摘要（例如动作摘要、牌面摘要、回放摘要）
- 还没有开始 `apps/game-server` 的房间容器和命令分发

---

## 下一阶段建议

1. 把 `uno-core` 的 `GameCommand` / `GameEvent` 同步到 `packages/shared-types`
2. 让 `packages/protocol` 对齐新的命令与事件 envelope
3. 在 `apps/game-server` 中落内存房间容器、命令分发器和快照裁剪
4. 给 `uno-core` 增加“摸牌堆耗尽时回洗弃牌堆”的规则
5. 补一轮面向服务端集成的 reducer 回归测试

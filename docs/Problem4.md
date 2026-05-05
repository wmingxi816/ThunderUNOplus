# problem4.md

```md
# Problem 4：UNO、淘汰与胜负弹窗

## 问题背景

当前 UNO 声明、抓 UNO、淘汰和胜利反馈还不够符合规则和 UI 预期。

本问题对应原问题：

- 17. 玩家仅剩一张牌的 UNO 声明环节
- 19. 手牌数大于等于 26 张时判负并弹窗
- 19. 获胜时也需要弹窗

## 本阶段目标

实现更清晰的 UNO、淘汰和胜负反馈：

1. 玩家打出倒数第二张牌后，UNO 按钮变为可点击。
2. 3 秒保护期从下一个玩家回合开始时计算。
3. 保护期内抓 UNO 不应导致罚摸。
4. 保护期后未喊 UNO，其他玩家抓 UNO 才成功。
5. 玩家手牌数 >= 26 时判负并通知所有人。
6. 玩家获胜时弹出获胜提示。
7. 出局和获胜都不能只写日志，必须有明显弹窗。

## 不要做什么

本阶段不要做：

- 不改其他牌型规则。
- 不做弃牌堆动画。
- 不做出牌飞行动画。
- 不做房内重新开局。
- 不做数据库、登录、排行榜、商城、支付。

## 需要检查的文件

请优先审计：

1. `packages/uno-core/src/reducer/applyUno.ts`
2. `packages/uno-core/src/reducer/applyPlayCard.ts`
3. `packages/uno-core/src/reducer/turn.ts`
4. `packages/uno-core/src/gameState.ts`
5. `packages/shared-types/src/event.ts`
6. `packages/shared-types/src/game.ts`
7. `apps/client-web/src/main.ts`
8. `apps/client-web/src/styles.css`

## 任务 1：UNO 按钮状态

当玩家打出倒数第二张牌后，手牌剩 1 张。

要求：

```txt
1. 该玩家的 UNO 按钮变为可点击。
2. 其他玩家看到该玩家处于 UNO 待声明状态。
3. UI 显示“UNO 待喊”或类似状态。

注意：

只有该玩家自己可以点击“喊 UNO”。
其他玩家只能在保护期结束后抓 UNO。
任务 2：UNO 3 秒保护期

正确规则：

当玩家手牌变成 1 张后，
从下一个玩家回合开始时，
开始 3 秒保护期。

保护期内：

其他玩家点击“抓 UNO”不会导致该玩家罚摸。

保护期后：

如果该玩家仍未喊 UNO，
其他玩家抓 UNO 成功，
该玩家被罚摸。

需要实现：

1. unoPending 状态。
2. unoProtectionStartTime。
3. unoProtectionEndsAt。
4. 当前时间判断。
5. 抓 UNO 时根据保护期判断成功或失败。

UI 建议：

UNO 保护中：3...2...1
可以抓 UNO
任务 3：保护期内抓 UNO 的提示

如果其他玩家在保护期内抓 UNO：

提示：当前仍在 UNO 保护期，抓 UNO 无效。

不要罚摸。

如果保护期结束后抓 UNO 成功：

提示：抓 UNO 成功，玩家 xxx 罚摸。

如果玩家已经喊 UNO：

提示：玩家 xxx 已经喊 UNO，不能抓。
任务 4：手牌 >= 26 判负

要求：

当某玩家手牌数 >= 26，
该玩家立即出局或判负。

需要所有玩家收到弹窗：

玩家 xxx 手牌为 xx 张，已出局。

要求：

出局玩家不能继续出牌。
出局玩家不能被选为当前玩家。
当前玩家如果出局，要推进到下一名未出局玩家。
如果只剩一名未出局玩家，该玩家获胜。
UI 要显示该玩家出局状态。
任务 5：胜利弹窗

当玩家打出最后一张牌或其他规则导致胜利时：

弹窗显示：玩家 xxx 获胜！

要求：

不只显示日志。
禁用出牌、摸牌、UNO、质疑等操作。
显示“返回大厅”或“重新创建房间”的入口。
如果暂不支持房内重开，明确提示“当前版本暂不支持房内重开”。
任务 6：事件与快照

建议增加或确认事件：

uno-pending
uno-said
uno-report-failed-protected
uno-report-success
player-eliminated
game-finished

客户端根据事件或 snapshot 显示弹窗。

验收标准

完成后至少满足：

1. 玩家剩一张牌后 UNO 按钮可点击。
2. 3 秒保护期从下一个玩家回合开始。
3. 保护期内抓 UNO 不罚摸。
4. 保护期后未喊 UNO，抓 UNO 成功。
5. 玩家手牌数 >= 26 时出局。
6. 出局有全员弹窗。
7. 获胜有全员弹窗。
8. 游戏结束后所有操作按钮禁用。
9. 相关 uno-core 测试通过。
10. client-web E2E 不回退。
测试命令

至少运行：

corepack pnpm --filter @thunder-uno/uno-core test
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm --filter @thunder-uno/game-server test
corepack pnpm typecheck
corepack pnpm test
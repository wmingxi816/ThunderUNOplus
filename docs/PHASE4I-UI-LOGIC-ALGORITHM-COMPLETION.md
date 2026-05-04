# Phase 4I：UI 逻辑与算法补完

## 阶段目标

把 `UI-DESIGN.md` 里还没完全落地的逻辑和算法部分补齐，重点不是再做一轮视觉，而是把选牌判断、同色丢弃、错误提示优先级和洗牌策略收紧到更稳定的状态。

## 本次完成内容

### 1. 同色丢弃改成顺序无关

`same-color discard` 现在不再依赖“先点主牌再点附加牌”的顺序。

前端会先从已选牌里定位主牌，再把其余牌当作附加牌处理，所以：

- 先选附加牌，再选主牌，也能正常出牌
- 预览和实际发包都按同一套规则走
- 这类牌不再因为点击顺序不同而误判不可用

### 2. 出牌提示改成优先级筛选

把前端的非法出牌提示收拢成了更稳定的优先级判断，优先显示最能帮助玩家纠正下一步操作的原因。

现在会更倾向于先提示：

- 当前是否轮到你
- 是否被加牌链或罚抽状态锁住
- 选牌结构是否不成立
- 牌面是否真的不匹配

这样不会再让低层的“牌色不对”之类信息，盖掉真正更关键的状态错误。

### 3. 洗牌改成软随机策略

`packages/uno-core/src/shuffle.ts` 从单纯的均匀洗牌，改成了带记忆的软随机洗牌：

- 同一 `seed` 仍然可复现
- 不会修改原始数组
- 卡牌路径会按卡面、颜色、类别和近期出现情况做轻微修正
- 目标是减少极端连发和长时间缺色，但不把结果洗成机械平均

这轮调整让牌序更像“有波动的真实洗牌”，而不是纯均匀随机。

### 4. 测试补齐

补了对应的客户端和核心层测试，覆盖：

- 同色丢弃选牌顺序无关
- 卡牌软随机洗牌路径的确定性
- 原数组不变性

## 修改文件

### 客户端

- `apps/client-web/src/main.ts`
- `apps/client-web/src/battle/selection.ts`
- `apps/client-web/src/battle/selection.test.ts`

### 核心层

- `packages/uno-core/src/shuffle.ts`
- `packages/uno-core/src/shuffle.test.ts`

## 还未做的内容

- 首版公开试玩部署准备
- HTTPS / WSS 收口
- 生产环境访问说明
- 更复杂的牌堆动画和音效

## 验证结果

已通过：

```bash
corepack pnpm --filter @thunder-uno/client-web typecheck
corepack pnpm --filter @thunder-uno/client-web test
corepack pnpm --filter @thunder-uno/client-web build
corepack pnpm --filter @thunder-uno/client-web test:e2e
corepack pnpm typecheck
corepack pnpm test
```

## 下一阶段建议

进入 `Phase 4J`：首版公开试玩部署准备。

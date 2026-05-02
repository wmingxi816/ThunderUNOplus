# Phase 5A：微信开发者工具与真机调试准备

## 阶段目标

本阶段目标不是继续扩玩法，也不是重写客户端架构，而是在已经完成的客户端逻辑、Cocos Controller / Binding、场景与 prefab 蓝图基础上，为微信开发者工具、Cocos Preview 和真机预览补齐最小运行适配与调试说明。

本阶段重点解决：

- `apps/client-wechat` 是否具备微信小游戏开发态基础配置
- `game.json / project.config.json` 是否可用于开发者工具打开
- 客户端网络层是否直接绑死浏览器 `WebSocket`
- 是否具备微信小游戏环境的 `wx.connectSocket` 适配层
- 是否能同时兼容浏览器、Cocos Preview、微信小游戏三种运行环境
- 是否有本地调试和真机调试文档

本阶段仍然不实现：

- 微信真实登录
- 正式线上服务器
- 数据库
- 商城、排行榜、支付
- 正式美术
- 复杂动画
- 事件持久化

---

## 本阶段完成内容

### 1. 审计并修正微信小游戏工程基础配置

已检查：

- `apps/client-wechat/game.json`
- `apps/client-wechat/project.config.json`

审计结果：

- `game.json` 已具备小游戏开发态最小配置，包含横屏方向与 `connectSocket` 超时设置
- `project.config.json` 原文件存在 JSON 格式错误，无法被正常解析

本阶段已修正 `project.config.json`，并补入：

- `appid: "touristappid"`
- `projectname: "thunder-uno-plus"`

这样可以更稳定地用于开发者工具本地打开与游客调试。

### 2. 新增运行环境识别

已新增：

- `apps/client-wechat/src/app/runtimeEnv.ts`

当前支持识别：

- `browser`
- `wechat-minigame`
- `unknown`

识别规则：

- 若存在 `wx.connectSocket`，判定为 `wechat-minigame`
- 若存在浏览器 `WebSocket` 构造器，判定为 `browser`
- 否则为 `unknown`

### 3. 新增 SocketAdapter 抽象层

已新增：

- `apps/client-wechat/src/network/socketAdapter.ts`
- `apps/client-wechat/src/network/browserSocketAdapter.ts`
- `apps/client-wechat/src/network/wechatSocketAdapter.ts`
- `apps/client-wechat/src/network/createSocketAdapter.ts`
- `apps/client-wechat/src/network/wechatSocketTypes.ts`

目标是让业务层不再直接依赖浏览器原生 `WebSocket`。

当前设计：

- 浏览器 / Cocos Preview 使用 `BrowserSocketAdapter`
- 微信小游戏环境使用 `WechatSocketAdapter`
- 默认工厂 `createSocketAdapter()` 会根据运行环境自动选择

### 4. `WsClient` 接入适配层

`apps/client-wechat/src/network/wsClient.ts` 已改为通过 `SocketAdapter` 工作。

当前仍然保留了向后兼容能力：

- 可以继续注入原先的 `socketFactory`
- 也可以直接注入 `socketAdapter`
- 还可以注入 `socketAdapterFactory`

这保证了现有测试和上层 `App.ts` 不需要被大规模重写。

### 5. 保持本地地址策略不变

客户端默认开发地址仍然是：

```txt
ws://localhost:8787
```

真机局域网调试时改成：

```txt
ws://你的电脑局域网IP:8787
```

例如：

```txt
ws://192.168.1.23:8787
```

同时保留后续切换正式地址的能力：

```txt
wss://正式域名
```

### 6. `WS_URL` 规范化逻辑补测

当前已确认：

- 默认地址是 `ws://localhost:8787`
- 输入 `192.168.1.23:8787` 会自动补全为 `ws://192.168.1.23:8787`
- `ws://127.0.0.1:8787` 保持不变
- `wss://example.com` 保持不变

### 7. 新增开发者工具与真机调试文档

本阶段新增本文档，用于说明：

- Cocos Creator 构建到微信小游戏的步骤
- `build/wechatgame` 的使用方式
- 本机调试与真机调试的地址区别
- 开发者工具里的调试设置
- 后续正式上线需要补的 `wss` 与合法域名要求

---

## 关键文件

### 新增文件

- `apps/client-wechat/src/app/runtimeEnv.ts`
- `apps/client-wechat/src/network/socketAdapter.ts`
- `apps/client-wechat/src/network/browserSocketAdapter.ts`
- `apps/client-wechat/src/network/wechatSocketAdapter.ts`
- `apps/client-wechat/src/network/createSocketAdapter.ts`
- `apps/client-wechat/src/network/wechatSocketTypes.ts`
- `docs/PHASE5A-WECHAT-DEVTOOLS-DEBUG.md`

### 修改文件

- `apps/client-wechat/src/network/wsClient.ts`
- `apps/client-wechat/src/app/config.test.ts`
- `apps/client-wechat/src/network/wsClient.test.ts`
- `apps/client-wechat/project.config.json`

### 新增测试

- `apps/client-wechat/src/app/runtimeEnv.test.ts`
- `apps/client-wechat/src/network/socketAdapters.test.ts`

---

## SocketAdapter 设计说明

统一接口如下：

```ts
export interface SocketAdapter {
  connect(url: string): Promise<void>;
  send(data: string): void;
  close(code?: number, reason?: string): void;

  onOpen(handler: () => void): void;
  onMessage(handler: (data: string) => void): void;
  onClose(handler: (info: { code?: number; reason?: string }) => void): void;
  onError(handler: (error: unknown) => void): void;
}
```

这样做的好处是：

- `WsClient` 不再感知底层是浏览器 `WebSocket` 还是 `wx.connectSocket`
- 单元测试可以直接注入 mock adapter
- 后续如果还要适配别的运行时，不需要继续改业务层

---

## WeChat 适配核心逻辑

微信小游戏环境下，底层不再直接 `new WebSocket(url)`，而是：

```ts
wx.connectSocket({ url })
```

本阶段的 `WechatSocketAdapter` 负责：

- 发起 `connectSocket`
- 监听 `onOpen / onMessage / onClose / onError`
- 把小游戏环境消息转成 `WsClient` 可消费的统一形式

同时通过最小类型定义避免直接引入庞大的微信类型依赖。

---

## Cocos Creator 构建步骤

1. 打开 Cocos Creator。
2. 打开 `apps/client-wechat` 对应工程。
3. 确认场景和 prefab 已按 Phase 4D 文档手动搭建完成。
4. 执行构建发布。
5. 发布平台选择“微信小游戏”。
6. 填写 AppID。
7. 如果当前没有正式 AppID，可先用开发调试或游客方式验证构建链路。
8. 构建输出目录使用 `build/wechatgame`。
9. 使用微信开发者工具打开 `build/wechatgame`。

---

## 本机调试

本机调试地址：

```txt
ws://localhost:8787
```

适用于：

- 浏览器调试
- Cocos Preview
- 开发者工具模拟器中的一部分本地验证

启动服务端：

```bash
HOST=0.0.0.0 PORT=8787 corepack pnpm --filter @thunder-uno/game-server dev
```

---

## 真机调试

真机调试地址：

```txt
ws://你的电脑局域网IP:8787
```

例如：

```txt
ws://192.168.1.23:8787
```

真机调试前提：

- 手机和电脑在同一 Wi-Fi
- 电脑防火墙允许 `8787`
- 服务端监听 `0.0.0.0`
- 手机上不能使用 `localhost`

---

## 开发者工具设置提醒

开发阶段如果遇到合法域名或证书校验问题，可在微信开发者工具中检查相关开发设置，例如：

- 不校验合法域名
- 不校验 TLS
- 不校验 HTTPS 证书

这只是开发调试手段，不是正式上线方案。

正式上线前仍然需要：

- 公网服务器
- `wss://` 域名
- SSL 证书
- 微信公众平台配置 `socket` 合法域名

---

## 常见问题排查

### 1. 微信开发者工具打不开项目

检查：

- `project.config.json` 是否是合法 JSON
- `compileType` 是否为 `game`
- `miniprogramRoot` 是否指向正确目录

### 2. Cocos 构建后找不到 `game.json`

检查：

- 是否真的选择了“微信小游戏”作为构建目标
- 是否打开了正确的 `build/wechatgame`

### 3. WebSocket 连接失败

检查：

- 本地服务端是否已经启动
- 地址是否写成了错误端口
- 当前环境是否使用了正确的 socket adapter

### 4. 真机能打开游戏但连不上服务端

检查：

- 是否错误使用了 `localhost`
- 是否已改成电脑局域网 IP
- 防火墙是否放行 `8787`
- 服务端是否监听 `0.0.0.0`

### 5. Cocos Preview 能连，微信工具不能连

检查：

- 是否进入了微信小游戏环境分支
- `wx.connectSocket` 适配是否生效
- 开发者工具网络校验设置是否影响当前调试

---

## 本地验证结果

需要通过的验证命令：

- `corepack pnpm --filter @thunder-uno/client-wechat typecheck`
- `corepack pnpm --filter @thunder-uno/client-wechat test`
- `corepack pnpm --filter @thunder-uno/game-server typecheck`
- `corepack pnpm --filter @thunder-uno/game-server test`
- `corepack pnpm typecheck`
- `corepack pnpm test`

---

## 当前仍未实现

- 微信真实登录
- 正式公网 `wss://` 服务
- 微信公众平台正式合法域名配置
- 真机设备上的人工点击验证
- 正式美术、动画、音效

---

## 下一阶段建议

Phase 5A 完成后，下一步建议进入 Phase 5B：

- 接入微信小游戏真实运行链路验证
- 处理真机环境下的具体 UI / 网络问题
- 如果需要，再准备微信登录接入前的用户标识方案

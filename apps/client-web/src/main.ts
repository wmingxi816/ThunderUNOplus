import type { ServerMessage } from "@thunder-uno/protocol";
import type {
  Card,
  CardColor,
  ErrorCode,
  GameEvent,
  GameMode,
  PlayerGameSnapshot,
  PlayerId,
  PlayerRoomSnapshot,
  RoomId
} from "@thunder-uno/shared-types";
import { readInitialConfig } from "./app/config";
import {
  buildDiscardSameColorPayload,
  canPlayMultipleNumberSelection,
  canPlaySequenceSelection,
  getSelectedCards
} from "./battle/selection";
import { getCardAssetPath, getCardBackAssetPath } from "./cards/cardAssets";
import { WsClient, type ConnectionStatus } from "./network/wsClient";
import {
  buildCommandMessage,
  buildCreateRoomMessage,
  buildJoinRoomMessage,
  buildLeaveRoomMessage,
  buildPingMessage,
  buildReconnectMessage,
  buildStartGameMessage,
  type ClientCommandInput,
  createUserId
} from "./protocol/clientMessages";
import "./styles.css";

interface AppState {
  wsUrl: string;
  userId: string;
  nickname: string;
  connectionStatus: ConnectionStatus;
  roomId: RoomId | null;
  playerId: PlayerId | null;
  room: PlayerRoomSnapshot | null;
  snapshot: PlayerGameSnapshot | null;
  lastError: string | null;
  log: string[];
  selectedCardIds: string[];
  colorPickerCardId: string | null;
  latestCardsPlayedEvent: CardsPlayedAnimationEvent | null;
  flyingCard: FlyingCardAnimation | null;
  challengePrompt: ChallengePromptState | null;
  uiToast: UiToastState | null;
  snapshotRecoveryRoomId: RoomId | null;
}

interface CardsPlayedAnimationEvent {
  playerId: PlayerId;
  topCardId: string;
  receivedAt: number;
}

interface FlyingCardAnimation {
  key: string;
  card: Card;
  playerId: PlayerId;
  seatClass: string;
}

interface ChallengePromptState {
  targetPlayerId: PlayerId;
  openedAt: number;
  dismissed: boolean;
}

interface UiToastState {
  key: string;
  message: string;
  tone: "info" | "success" | "warning";
}

interface CardHint {
  className: "playable" | "unplayable" | "neutral";
  label: string;
}

const LAST_ROOM_STORAGE_KEY = "thunder-uno.lastRoomId";
const USER_ID_STORAGE_KEY = "thunder-uno.userId";
const USER_NICKNAME_STORAGE_KEY = "thunder-uno.nickname";
const CHALLENGE_PROMPT_MS = 5_000;
const FALLBACK_AVATAR_COUNT = 8;

const root = document.querySelector<HTMLDivElement>("#app");

if (root === null) {
  throw new Error("App root was not found.");
}

const appRoot = root;

const config = readInitialConfig(window.location.search);
const shouldReuseStoredSession = shouldReuseStoredSessionIdentity();

if (!shouldReuseStoredSession) {
  resetClonedSessionIdentity();
}

const state: AppState = {
  wsUrl: config.wsUrl,
  userId: getOrCreateUserId(),
  nickname: getOrCreateNickname(),
  connectionStatus: "idle",
  roomId: readStoredRoomId(),
  playerId: null,
  room: null,
  snapshot: null,
  lastError: null,
  log: [],
  selectedCardIds: [],
  colorPickerCardId: null,
  latestCardsPlayedEvent: null,
  flyingCard: null,
  challengePrompt: null,
  uiToast: null,
  snapshotRecoveryRoomId: null
};

const wsClient = new WsClient({
  onStatusChange(status) {
    state.connectionStatus = status;
    if (status === "open") {
      state.lastError = null;
      pushLog("连接已建立");
      render();
      maybeReconnect();
      return;
    }

    if (status === "closed") {
      state.lastError =
        state.roomId === null ? "连接已断开" : "连接已断开，可点击重连回到当前房间";
      pushLog("连接已关闭");
      render();
      return;
    }

    pushLog(`连接状态：${status}`);
    render();
  },
  onMessage(message) {
    handleServerMessage(message);
    render();
  },
  onError(error) {
    state.lastError = error instanceof Error ? error.message : "WebSocket error";
    pushLog(state.lastError);
    render();
  }
});

render();

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case "room-state":
      state.roomId = message.roomId;
      state.playerId = message.playerId;
      state.room = message.room;
      state.lastError = null;
      clearSelectedCards();
      setSessionStoredValue(LAST_ROOM_STORAGE_KEY, message.roomId);

      pushLog(`收到房间快照：${message.room.players.length} 人`);
      recoverMissingPlayingSnapshot(message.room);
      return;
    case "snapshot":
      syncFlyingCardAnimation(message.snapshot as PlayerGameSnapshot);
      state.roomId = message.roomId;
      state.playerId = message.playerId;
      state.snapshot = message.snapshot as PlayerGameSnapshot;
      state.snapshotRecoveryRoomId = null;
      state.lastError = null;
      clearSelectedCards();
      setSessionStoredValue(LAST_ROOM_STORAGE_KEY, message.roomId);
      syncChallengePrompt(state.snapshot);
      pushLog(`收到对局快照：版本 ${message.snapshotVersion}`);
      return;
    case "events":
      handleGameEvents(message.events);
      pushLog(`收到事件：${String(message.events.length)} 条`);
      return;
    case "error":
      state.lastError = message.message;
      pushLog(`错误：${message.message}`);
      if (
        message.code === "room-not-found" ||
        message.code === "player-not-in-room" ||
        message.code === "room-not-playing"
      ) {
        resetRoomContext();
      }
      return;
    case "pong":
      pushLog("pong");
      return;
    case "room-closed":
      resetRoomContext();
      pushLog("房间已关闭");
      return;
    default: {
      const exhaustiveCheck: never = message;
      pushLog(`未知消息：${String(exhaustiveCheck)}`);
    }
  }
}

function render(): void {
  appRoot.innerHTML = `
    <main class="shell">
      <section class="topbar">
        <div>
          <p class="eyebrow">HTML Web Client</p>
          <h1>雷霆UNOplus</h1>
        </div>
        <span
          class="status status-${state.connectionStatus}"
          data-testid="connection-status"
        >${state.connectionStatus}</span>
      </section>

      ${renderConnectionPanel()}
      ${renderToastPanel()}
      ${state.snapshot === null ? renderLobbyPanel() : renderBattlePanel(state.snapshot)}
      ${renderLogPanel()}
    </main>
  `;

  bindConnectionPanel();
  bindLobbyPanel();
  bindBattlePanel();
}

function renderConnectionPanel(): string {
  const connectLabel =
    state.roomId !== null && state.connectionStatus !== "open"
      ? "重连"
      : state.connectionStatus === "open"
        ? "重新连接"
        : "连接";

  return `
    <section class="panel connection-panel">
      <label>
        <span>服务端</span>
        <input
          id="ws-url"
          data-testid="ws-url-input"
          value="${escapeHtml(state.wsUrl)}"
          autocomplete="off"
        />
      </label>
      <label>
        <span>昵称</span>
        <input
          id="nickname"
          data-testid="nickname-input"
          value="${escapeHtml(state.nickname)}"
          autocomplete="off"
        />
      </label>
      <div class="button-row">
        <button id="connect-button" data-testid="connect-button">${connectLabel}</button>
        <button id="disconnect-button" class="secondary">断开</button>
        <button id="ping-button" class="secondary">Ping</button>
      </div>
      <p id="error-line" data-testid="error-line" class="error-line" aria-live="polite">${state.lastError === null ? "" : escapeHtml(state.lastError)}</p>
    </section>
  `;
}

function renderToastPanel(): string {
  const toast = state.uiToast;

  if (toast === null) {
    return "";
  }

  return `
    <div class="ui-toast toast-${toast.tone}" role="status" aria-live="polite">
      ${escapeHtml(toast.message)}
    </div>
  `;
}

function renderLobbyPanel(): string {
  const room = state.room;
  const isConnected = state.connectionStatus === "open";
  const canCreateRoom = isConnected && state.roomId === null;
  const canJoinRoom = isConnected && state.roomId === null;

  return `
    <section class="layout" data-testid="lobby-view">
      <div class="panel" data-testid="lobby-control-panel">
        <h2>房间</h2>
        <div class="form-grid">
          <label>
            <span>模式</span>
            <select id="mode">
              <option value="no-challenge">无质疑</option>
              <option value="with-challenge">有质疑</option>
            </select>
          </label>
          <label>
            <span>房间号</span>
            <input
              id="room-id-input"
              data-testid="join-room-input"
              value="${escapeHtml(state.roomId ?? "")}"
              autocomplete="off"
            />
          </label>
        </div>
        <div class="button-row">
          <button id="create-room-button" data-testid="create-room-button" ${canCreateRoom ? "" : "disabled"}>创建房间</button>
          <button id="join-room-button" data-testid="join-room-button" class="secondary" ${canJoinRoom ? "" : "disabled"}>加入房间</button>
          <button id="leave-room-button" data-testid="leave-room-button" class="secondary" ${isConnected && state.roomId !== null ? "" : "disabled"}>离开</button>
        </div>
      </div>
      <div class="panel" data-testid="lobby-status-panel">
        <h2>等待</h2>
        ${
          room === null
            ? `<p class="muted">连接服务端后创建或加入房间。</p>`
            : renderRoomState(room)
        }
      </div>
    </section>
  `;
}

function renderRoomState(room: PlayerRoomSnapshot): string {
  const canStart = state.connectionStatus === "open" && room.hostPlayerId === state.playerId;
  const hostPlayer = room.players.find((player) => player.isHost);

  return `
    <div class="room-meta">
      <strong data-testid="room-id">${escapeHtml(room.roomCode)}</strong>
      <span>${escapeHtml(room.mode)} · ${escapeHtml(room.status)} · 房主：${escapeHtml(hostPlayer?.displayName ?? hostPlayer?.playerId ?? "未知")}</span>
    </div>
    <div class="players">
      ${room.players
        .map((player) => {
          return `
            <div
              class="player-pill ${player.playerId === state.playerId ? "self" : ""}"
              data-testid="room-player"
              data-room-host="${player.isHost ? "true" : "false"}"
            >
              <img
                class="avatar"
                src="${escapeHtml(resolvePlayerAvatar(player.playerId, player.avatarUrl))}"
                alt="${escapeHtml(player.displayName ?? player.playerId)}"
              />
              <span>${escapeHtml(player.displayName ?? player.playerId)}</span>
              <small>${player.isHost ? "房主" : `座位 ${String(player.seatIndex + 1)}`}</small>
            </div>
          `;
        })
        .join("")}
    </div>
    <label class="seed-line">
      <span>可选种子</span>
      <input id="seed-input" autocomplete="off" />
    </label>
    <button id="start-game-button" data-testid="start-game-button" ${canStart ? "" : "disabled"}>开始游戏</button>
  `;
}

function renderBattlePanel(snapshot: PlayerGameSnapshot): string {
  const isMyTurn = snapshot.currentPlayerId === state.playerId;
  const isGameFinished = snapshot.status === "finished";
  const isConnected = state.connectionStatus === "open";
  const canTakeTurnAction = isConnected && isMyTurn && !isGameFinished;
  const canUseOpponentAction = isConnected && !isGameFinished;
  const challengePrompt = getVisibleChallengePrompt(snapshot, isConnected, isGameFinished);

  return `
    <section class="battle ${isMyTurn ? "my-turn" : "other-turn"}" data-testid="battle-view">
      ${
        isGameFinished
          ? `
            <div class="panel finish-banner" data-testid="game-finished-banner">
              <h2>对局结束</h2>
              <p class="muted">获胜者：${snapshot.winnerPlayerIds
                .map((playerId) => escapeHtml(lookupPlayerName(snapshot, playerId)))
                .join(" · ") || "未知"}</p>
              <p class="muted">当前版本暂不支持房内重开，请重新创建房间。</p>
              <button id="finish-reset-button" data-testid="reconnect-button" class="secondary">返回大厅</button>
            </div>
          `
          : ""
      }
      ${renderBattleHud(snapshot, isMyTurn)}
      ${renderNormalDrawOfferPrompt(snapshot, canTakeTurnAction)}
      <div class="table-zone battle-stage">
        <div class="battle-table">
          <div class="opponents" data-testid="opponents-area">
            ${snapshot.opponents
              .map((player, index) => renderOpponent(player, canUseOpponentAction, getOpponentSeatClass(index, snapshot.opponents.length)))
              .join("")}
          </div>
          ${renderFlyingCard(snapshot)}
          <div class="center-table">
            <div class="draw-pile">
              <img src="${getCardBackAssetPath()}" alt="牌堆" />
              ${renderDrawButton(snapshot, canTakeTurnAction)}
            </div>
            ${renderDiscardPile(snapshot)}
            <div class="table-facts">
              ${renderCurrentColorBadge(snapshot.currentColor)}
              <span>方向：${escapeHtml(snapshot.direction)}</span>
              <span>${isMyTurn ? "轮到你" : `等待 ${escapeHtml(lookupPlayerName(snapshot, snapshot.currentPlayerId))}`}</span>
            </div>
          </div>
          ${challengePrompt === null ? "" : renderChallengePrompt(snapshot, challengePrompt)}
          ${renderSelfSeat(snapshot)}
        </div>
        <div class="actions">
          <button id="say-uno-button" data-testid="say-uno-button" class="secondary" ${canTakeTurnAction ? "" : "disabled"}>UNO</button>
        </div>
      </div>
      <div class="hand">
        <div class="hand-header">
          <h2>${escapeHtml(snapshot.self.displayName ?? "我")} 的手牌</h2>
          <span>${String(snapshot.self.hand.length)} 张</span>
        </div>
        ${renderActionGuide(snapshot, canTakeTurnAction, isGameFinished, isConnected)}
        <div class="cards" data-testid="hand-area">
          ${snapshot.self.hand.map((card) => renderCardButton(card, snapshot, canTakeTurnAction)).join("")}
        </div>
        ${renderSelectionPanel(snapshot, canTakeTurnAction, isGameFinished, isMyTurn, isConnected)}
      </div>
    </section>
    ${renderColorPickerPanel(snapshot.self.hand, canTakeTurnAction)}
  `;
}

function renderNormalDrawOfferPrompt(
  snapshot: PlayerGameSnapshot,
  enabled: boolean
): string {
  if (
    !enabled ||
    !snapshot.normalDrawOffer.active ||
    snapshot.normalDrawOffer.playerId !== state.playerId ||
    snapshot.normalDrawOffer.cardId === null
  ) {
    return "";
  }

  const drawnCard = snapshot.self.hand.find(
    (card) => card.id === snapshot.normalDrawOffer.cardId
  );

  return `
    <div class="panel normal-draw-offer" data-testid="normal-draw-offer">
      <strong>刚摸到的牌</strong>
      <p>${escapeHtml(drawnCard?.displayName ?? "未知")}</p>
      <div class="challenge-actions">
        <button id="play-drawn-card-button" ${drawnCard === undefined ? "disabled" : ""}>立即打出</button>
        <button id="keep-drawn-card-button" class="secondary">保留</button>
      </div>
    </div>
  `;
}

function renderOpponent(
  player: PlayerGameSnapshot["opponents"][number],
  enabled: boolean,
  seatClass: string
): string {
  const seatLabel = player.isCurrentPlayer ? "当前回合" : player.hasCalledUno ? "UNO" : "等待";

  return `
    <div class="opponent seat ${seatClass} ${player.isCurrentPlayer ? "current" : ""}">
      <span class="seat-badge">${escapeHtml(seatLabel)}</span>
      <img
        class="avatar"
        src="${escapeHtml(resolvePlayerAvatar(player.playerId, player.avatarUrl))}"
        alt="${escapeHtml(player.displayName ?? player.playerId)}"
      />
      <strong>${escapeHtml(player.displayName ?? player.playerId)}</strong>
      <span class="hand-count-badge">${String(player.handCount)}</span>
      <small>${player.isCurrentPlayer ? "当前行动" : player.hasCalledUno ? "已叫 UNO" : "等待"}</small>
      <div class="opponent-actions">
        <button data-report-uno="${escapeHtml(player.playerId)}" ${enabled ? "" : "disabled"}>报 UNO</button>
      </div>
    </div>
  `;
}

function renderSelfSeat(snapshot: PlayerGameSnapshot): string {
  const seatLabel = snapshot.self.isCurrentPlayer ? "轮到你" : "等待";

  return `
    <div class="self-seat seat ${snapshot.self.isCurrentPlayer ? "current" : ""}">
      <span class="seat-badge">${escapeHtml(seatLabel)}</span>
      <img
        class="avatar"
        src="${escapeHtml(resolvePlayerAvatar(snapshot.self.playerId, snapshot.self.avatarUrl))}"
        alt="${escapeHtml(snapshot.self.displayName ?? "我")}"
      />
      <strong>${escapeHtml(snapshot.self.displayName ?? "我")}</strong>
      <span class="hand-count-badge">${String(snapshot.self.hand.length)}</span>
      <small>${snapshot.self.isCurrentPlayer ? "轮到你" : "等待"}</small>
    </div>
  `;
}

function renderDiscardPile(snapshot: PlayerGameSnapshot): string {
  const discardPile = Array.isArray((snapshot as { discardPile?: Card[] }).discardPile)
    ? (snapshot as { discardPile: Card[] }).discardPile
    : [];
  const pileCards = (discardPile.length === 0 ? [snapshot.topCard] : discardPile).slice(-8);

  return `
    <div class="discard-pile top-card" data-testid="top-card">
      <div class="discard-stack" aria-label="弃牌堆">
        ${pileCards
          .map((card, index) => {
            const offset = getPileOffset(index, pileCards.length);
            const isTopCard = index === pileCards.length - 1;

            return `
              <img
                class="discard-card ${isTopCard ? "top-discard-card" : ""}"
                src="${getCardAssetPath(card)}"
                alt="${escapeHtml(card.displayName)}"
                style="--pile-x: ${String(offset.x)}px; --pile-y: ${String(offset.y)}px; --pile-rotate: ${String(offset.rotate)}deg; --pile-index: ${String(index)};"
              />
            `;
          })
          .join("")}
      </div>
      <strong>${escapeHtml(snapshot.topCard.displayName)}</strong>
    </div>
  `;
}

function renderFlyingCard(snapshot: PlayerGameSnapshot): string {
  const animation = state.flyingCard;

  if (animation === null || animation.card.id !== snapshot.topCard.id) {
    return "";
  }

  return `
    <img
      class="flying-card ${animation.seatClass}"
      key="${escapeHtml(animation.key)}"
      src="${getCardAssetPath(animation.card)}"
      alt="${escapeHtml(animation.card.displayName)}"
    />
  `;
}

function renderChallengePrompt(
  snapshot: PlayerGameSnapshot,
  prompt: ChallengePromptState
): string {
  const targetName = lookupPlayerName(snapshot, prompt.targetPlayerId);

  return `
    <div class="challenge-prompt" data-testid="challenge-prompt">
      <strong>是否质疑</strong>
      <span>${escapeHtml(targetName)} 刚摸牌</span>
      <small>成功：对方摸 2 张 · 失败：自己摸 6 张</small>
      <div class="challenge-countdown"><span></span></div>
      <div class="challenge-actions">
        <button id="challenge-yes-button" data-challenge="${escapeHtml(prompt.targetPlayerId)}">是</button>
        <button id="challenge-no-button" class="secondary">否</button>
      </div>
    </div>
  `;
}

function renderBattleHud(snapshot: PlayerGameSnapshot, isMyTurn: boolean): string {
  return `
    <div class="battle-hud">
      <span class="hud-primary">当前：${escapeHtml(isMyTurn ? "轮到你" : lookupPlayerName(snapshot, snapshot.currentPlayerId))}</span>
      <span>颜色：${escapeHtml(snapshot.currentColor)}</span>
      <span>方向：${escapeHtml(snapshot.direction)}</span>
      <span>牌堆</span>
      ${renderBattleStatusChips(snapshot)}
    </div>
  `;
}

interface DrawActionState {
  actionType: "draw-card" | "resolve-draw-stack" | "resolve-draw-until-color";
  label: string;
  enabled: boolean;
}

function renderDrawButton(snapshot: PlayerGameSnapshot, enabled: boolean): string {
  const state = getDrawActionState(snapshot, enabled);

  return `
    <button
      id="draw-card-button"
      data-testid="draw-card-button"
      data-draw-action="${state.actionType}"
      ${state.enabled ? "" : "disabled"}
    >${escapeHtml(state.label)}</button>
  `;
}

function getDrawActionState(snapshot: PlayerGameSnapshot, enabled: boolean): DrawActionState {
  if (!enabled) {
    return { actionType: "draw-card", label: "摸牌", enabled: false };
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId
  ) {
    return {
      actionType: "draw-card",
      label: "先处理刚摸到的牌",
      enabled: false
    };
  }

  if (snapshot.drawStack.active && snapshot.drawStack.targetPlayerId === state.playerId) {
    return {
      actionType: "resolve-draw-stack",
      label: `摸 ${String(snapshot.drawStack.amount)} 张`,
      enabled: true
    };
  }

  if (snapshot.drawUntilColor.active && snapshot.drawUntilColor.targetPlayerId === state.playerId) {
    return {
      actionType: "resolve-draw-until-color",
      label: "结算罚抽",
      enabled: true
    };
  }

  return {
    actionType: "draw-card",
    label: "摸牌",
    enabled: true
  };
}

function renderCurrentColorBadge(color: string): string {
  return `
    <span class="table-color">
      <span class="color-swatch color-${escapeHtml(color)}" aria-hidden="true"></span>
      <span>${escapeHtml(getColorDisplayName(color))}</span>
    </span>
  `;
}

function getColorDisplayName(color: string): string {
  switch (color) {
    case "red":
      return "红色";
    case "yellow":
      return "黄色";
    case "blue":
      return "蓝色";
    case "green":
      return "绿色";
    default:
      return color;
  }
}

function renderBattleStatusChips(snapshot: PlayerGameSnapshot): string {
  const chips: string[] = [];

  if (snapshot.drawStack.active) {
    chips.push(`<span class="hud-chip danger">加牌 +${String(snapshot.drawStack.amount)}</span>`);
  }

  if (snapshot.drawUntilColor.active) {
    chips.push(`<span class="hud-chip warning">罚抽 ${escapeHtml(snapshot.drawUntilColor.color ?? "")}</span>`);
  }

  if (snapshot.challengeWindow.active) {
    chips.push(`<span class="hud-chip warning">可质疑</span>`);
  }

  return chips.join("");
}

function renderActionGuide(
  snapshot: PlayerGameSnapshot,
  canTakeTurnAction: boolean,
  isGameFinished: boolean,
  isConnected: boolean
): string {
  let message = "等待对局状态更新。";
  let tone = "muted";

  if (isGameFinished) {
    message = "本局已结束，可以返回大厅重新开房。";
  } else if (!isConnected) {
    message = "连接已断开，请重连后继续。";
    tone = "warning";
  } else if (canTakeTurnAction && snapshot.drawStack.active) {
    message = `加牌链正在压到你：可以叠加加牌，或结算摸 ${String(snapshot.drawStack.amount)} 张。`;
    tone = "danger";
  } else if (canTakeTurnAction && snapshot.drawUntilColor.active) {
    message = "罚抽压力正在压到你：可以打罚抽牌回应，或结算罚抽。";
    tone = "danger";
  } else if (canTakeTurnAction) {
    message = "轮到你：选择一张高亮手牌出牌，或从牌堆摸牌。";
    tone = "active";
  } else {
    message = `等待 ${lookupPlayerName(snapshot, snapshot.currentPlayerId)} 操作。`;
  }

  return `<div class="action-guide guide-${tone}">${escapeHtml(message)}</div>`;
}

function renderCardButton(card: Card, snapshot: PlayerGameSnapshot, enabled: boolean): string {
  const isSelected = state.selectedCardIds.includes(card.id);
  const canSelect = isCardSelectable(card, snapshot, enabled);
  const hint = getCardHint(card, snapshot, enabled);
  const disabled = canSelect ? "" : "disabled";

  return `
    <button
      class="card-button ${hint.className} ${isSelected ? "selected" : ""}"
      data-card-id="${escapeHtml(card.id)}"
      aria-pressed="${isSelected ? "true" : "false"}"
      aria-label="${escapeHtml(`${card.displayName} \u00b7 ${hint.label}`)}"
      title="${escapeHtml(hint.label)}"
      ${disabled}
    >
      <img src="${getCardAssetPath(card)}" alt="${escapeHtml(card.displayName)}" />
    </button>
  `;
}

function isCardSelectable(card: Card, snapshot: PlayerGameSnapshot, canTakeTurnAction: boolean): boolean {
  if (!canTakeTurnAction) {
    return false;
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId
  ) {
    return card.id === snapshot.normalDrawOffer.cardId;
  }

  if (snapshot.drawUntilColor.active) {
    return card.kind === "penalty-draw";
  }

  if (snapshot.drawStack.active) {
    return canContinueDrawStack(card, snapshot);
  }

  return true;
}

function getCardHint(card: Card, snapshot: PlayerGameSnapshot, enabled: boolean): CardHint {
  if (!enabled) {
    return { className: "neutral", label: "当前不可操作" };
  }

  if (
    snapshot.normalDrawOffer.active &&
    snapshot.normalDrawOffer.playerId === state.playerId &&
    card.id !== snapshot.normalDrawOffer.cardId
  ) {
    return { className: "unplayable", label: "请先处理刚摸到的牌" };
  }

  if (snapshot.drawUntilColor.active) {
    if (card.kind === "penalty-draw") {
      return { className: "playable", label: "可回应罚抽" };
    }

    return { className: "unplayable", label: "罚抽状态下只能打罚抽牌或结算罚抽" };
  }

  if (snapshot.drawStack.active) {
    if (canContinueDrawStack(card, snapshot)) {
      return { className: "playable", label: "可尝试叠加加牌" };
    }

    return { className: "unplayable", label: "加牌链状态下只能叠加加牌牌或结算摸牌" };
  }

  if (card.isBlack) {
    return { className: "playable", label: "黑牌可选择颜色" };
  }

  if (canPlaySingleCardLike(card, snapshot)) {
    return { className: "playable", label: "当前可出牌" };
  }

  return { className: "unplayable", label: "当前颜色或牌型不匹配" };
}

function canContinueDrawStack(card: Card, snapshot: PlayerGameSnapshot): boolean {
  const previousDrawValue = (snapshot.drawStack as { previousDrawValue?: number | null }).previousDrawValue ?? null;

  if (previousDrawValue === null) {
    return false;
  }

  if (card.kind !== "draw-two" && card.kind !== "draw-four" && card.kind !== "wild-reverse-draw-four" && card.kind !== "wild-draw-six" && card.kind !== "wild-draw-ten") {
    return false;
  }

  if (card.kind === "draw-two" || card.kind === "draw-four") {
    return card.drawValue === previousDrawValue || card.color === snapshot.currentColor;
  }

  return true;
}

function canPlaySingleCardLike(card: Card, snapshot: PlayerGameSnapshot): boolean {
  if (card.isBlack) {
    return true;
  }

  if (card.kind === "number" && snapshot.topCard.kind === "number") {
    return card.color === snapshot.currentColor || card.number === snapshot.topCard.number;
  }

  if (card.kind !== "number" && snapshot.topCard.kind !== "number") {
    return card.kind === snapshot.topCard.kind || card.color === snapshot.currentColor;
  }

  return card.color === snapshot.currentColor;
}

interface PlaySelectionPreview {
  canPlay: boolean;
  label: string;
  message: string;
}

interface DiscardSameColorPlayPreview {
  canPlay: boolean;
  message: string;
  payload: {
    mainCardId: string;
    attachedCardIds: string[];
  } | null;
}

type PlayReasonCategory =
  | "state"
  | "forced-action"
  | "operation"
  | "selection-shape"
  | "card-match"
  | "missing-parameter"
  | "suggestion";

interface PlayReason {
  priority: number;
  category: PlayReasonCategory;
  message: string;
}

const PLAY_REASON_CATEGORY_WEIGHT: Record<PlayReasonCategory, number> = {
  state: 7,
  "forced-action": 6,
  operation: 5,
  "selection-shape": 4,
  "card-match": 3,
  "missing-parameter": 2,
  suggestion: 1
};

function getPlaySelectionPreview(
  snapshot: PlayerGameSnapshot,
  selectedCards: readonly Card[],
  canTakeTurnAction: boolean
): PlaySelectionPreview {
  if (!canTakeTurnAction) {
    return {
      canPlay: false,
      label: "出牌",
      message: "当前不可操作。"
    };
  }

  if (selectedCards.length === 0) {
    return {
      canPlay: false,
      label: "出牌",
      message: "先点选手牌，再点击出牌。"
    };
  }

  if (snapshot.drawUntilColor.active) {
    if (selectedCards.length === 1 && selectedCards[0]?.kind === "penalty-draw") {
      return {
        canPlay: true,
        label: "出牌",
        message: "当前处于罚抽状态，已选中可回应的罚抽牌。"
      };
    }

    return {
      canPlay: false,
      label: "出牌",
      message: "当前处于罚抽状态，只能打罚抽牌或结算罚抽。"
    };
  }

  if (snapshot.drawStack.active) {
    if (selectedCards.length === 1 && canContinueDrawStack(selectedCards[0]!, snapshot)) {
      return {
        canPlay: true,
        label: "出牌",
        message: "当前有加牌链，已选中可继续叠加的加牌。"
      };
    }

    return {
      canPlay: false,
      label: "出牌",
      message: "当前有加牌链，只能叠加加牌牌或结算摸牌。"
    };
  }

  const discardSameColorPreview = getDiscardSameColorPlayPreview(snapshot, selectedCards);

  if (discardSameColorPreview !== null) {
    return {
      canPlay: discardSameColorPreview.canPlay,
      label: "出牌",
      message: discardSameColorPreview.message
    };
  }

  if (selectedCards.length === 1) {
    const [card] = selectedCards;

    if (card === undefined) {
      return {
        canPlay: false,
        label: "出牌",
        message: "请先选择手牌。"
      };
    }

    if (card.isBlack) {
      return {
        canPlay: true,
        label: "出牌并选色",
        message: "黑牌会先弹出颜色选择。"
      };
    }

    if (canPlaySingleCardLike(card, snapshot)) {
      return {
        canPlay: true,
        label: "出牌",
        message: "已选中可直接出的单牌。"
      };
    }

    return {
      canPlay: false,
      label: "出牌",
      message: describeSingleCardMismatch(card, snapshot)
    };
  }

  if (canPlaySequenceSelection(selectedCards)) {
    return {
      canPlay: true,
      label: "出牌",
      message: "已选中可出的顺子。"
    };
  }

  if (canPlayMultipleNumberSelection(selectedCards)) {
    return {
      canPlay: true,
      label: "出牌",
      message: "已选中可出的连对。"
    };
  }

  const reasons = collectPlayReasons(snapshot, selectedCards);
  const bestReason = pickBestPlayReason(reasons);

  return {
    canPlay: false,
    label: "出牌",
    message: bestReason?.message ?? "当前选牌不合法。"
  };
}

function getDiscardSameColorPlayPreview(
  snapshot: PlayerGameSnapshot,
  selectedCards: readonly Card[]
): DiscardSameColorPlayPreview | null {
  const payload = buildDiscardSameColorPayload(selectedCards);

  if (payload === null) {
    return null;
  }

  const mainCard = selectedCards.find((card) => card.id === payload.mainCardId);

  if (mainCard === undefined) {
    return {
      canPlay: false,
      message: "同色丢弃需要先选主牌，再选附加牌。",
      payload: null
    };
  }

  if (snapshot.drawUntilColor.active) {
    return {
      canPlay: false,
      message: "当前处于罚抽状态，不能进行同色丢弃。",
      payload: null
    };
  }

  if (snapshot.drawStack.active) {
    return {
      canPlay: false,
      message: "当前有加牌链，不能进行同色丢弃。",
      payload: null
    };
  }

  if (!canPlaySingleCardLike(mainCard, snapshot)) {
    return {
      canPlay: false,
      message: describeSingleCardMismatch(mainCard, snapshot),
      payload: null
    };
  }

  for (const attachedCard of selectedCards) {
    if (attachedCard.id === mainCard.id) {
      continue;
    }

    if (attachedCard.isBlack) {
      return {
        canPlay: false,
        message: "同色丢弃的附加牌不能包含黑牌。",
        payload: null
      };
    }

    if (attachedCard.color !== mainCard.color) {
      return {
        canPlay: false,
        message: "同色丢弃的附加牌颜色必须和主牌相同。",
        payload: null
      };
    }
  }

  return {
    canPlay: true,
    message: "已选中同色丢弃主牌和附加牌。",
    payload
  };
}

function collectPlayReasons(snapshot: PlayerGameSnapshot, selectedCards: readonly Card[]): PlayReason[] {
  const reasons: PlayReason[] = [];

  if (selectedCards.length === 0) {
    reasons.push({
      priority: 79,
      category: "operation",
      message: "请先选择手牌。"
    });
  }

  if (selectedCards.length >= 2 && selectedCards.some((card) => card.isBlack)) {
    reasons.push({
      priority: 39,
      category: "missing-parameter",
      message: "黑牌需要单独出牌并先选择颜色。"
    });
  }

  if (selectedCards.every((card) => card.kind === "number") && selectedCards.length > 0) {
    if (selectedCards.length < 5) {
      reasons.push({
        priority: 69,
        category: "selection-shape",
        message: "顺子至少需要 5 张数字牌。"
      });
    } else if (!areNumbersConsecutive(selectedCards)) {
      reasons.push({
        priority: 65,
        category: "selection-shape",
        message: "顺子数字必须连续。"
      });
    }
  }

  if (
    selectedCards.length >= 2 &&
    selectedCards.every((card) => card.kind === "number") &&
    !canPlayMultipleNumberSelection(selectedCards)
  ) {
    reasons.push({
      priority: 61,
      category: "selection-shape",
      message: "连对需要至少 2 张同色同数的数字牌。"
    });
  }

  const firstCard = selectedCards[0];

  if (firstCard !== undefined && !firstCard.isBlack && !canPlaySingleCardLike(firstCard, snapshot)) {
    reasons.push({
      priority: 54,
      category: "card-match",
      message: describeSingleCardMismatch(firstCard, snapshot)
    });
  }

  return reasons;
}

function pickBestPlayReason(reasons: readonly PlayReason[]): PlayReason | null {
  if (reasons.length === 0) {
    return null;
  }

  return [...reasons].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return PLAY_REASON_CATEGORY_WEIGHT[right.category] - PLAY_REASON_CATEGORY_WEIGHT[left.category];
  })[0] ?? null;
}

function areNumbersConsecutive(cards: readonly Card[]): boolean {
  const sorted = [...cards]
    .filter((card): card is Card & { number: number } => card.kind === "number" && card.number !== undefined)
    .sort((left, right) => left.number - right.number);

  for (let index = 1; index < sorted.length; index += 1) {
    const previousCard = sorted[index - 1];
    const currentCard = sorted[index];

    if (previousCard === undefined || currentCard === undefined) {
      return false;
    }

    if (currentCard.number !== previousCard.number + 1) {
      return false;
    }
  }

  return sorted.length >= 5;
}

function describeSingleCardMismatch(card: Card, snapshot: PlayerGameSnapshot): string {
  if (snapshot.drawStack.active) {
    return "当前有加牌链，只能叠加加牌牌或结算摸牌。";
  }

  if (snapshot.drawUntilColor.active) {
    return "当前处于罚抽状态，只能打罚抽牌或结算罚抽。";
  }

  if (card.kind === "number" && snapshot.topCard.kind === "number") {
    const colorMismatch = card.color !== snapshot.currentColor;
    const numberMismatch = card.number !== snapshot.topCard.number;

    if (colorMismatch && numberMismatch) {
      return "这张牌既不同色，也不同数。";
    }

    if (colorMismatch) {
      return `这张牌颜色不匹配，当前颜色是${getColorDisplayName(snapshot.currentColor)}。`;
    }

    return "这张牌数字不匹配。";
  }

  if (!card.isBlack && card.color !== snapshot.currentColor && card.kind !== snapshot.topCard.kind) {
    return "这张牌既不同色，也不同牌型。";
  }

  return "这张牌不能接当前牌。";
}

function renderSelectionPanel(
  snapshot: PlayerGameSnapshot,
  canTakeTurnAction: boolean,
  isGameFinished: boolean,
  isMyTurn: boolean,
  isConnected: boolean
): string {
  const hand = snapshot.self.hand;
  const selectedCards = getSelectedCards(hand, state.selectedCardIds);

  if (isGameFinished) {
    return `
      <div class="selection-panel">
        <p class="muted">本局已结束。</p>
      </div>
    `;
  }

  if (!isConnected) {
    return `
      <div class="selection-panel">
        <p class="muted">连接已断开，请重连后继续。</p>
      </div>
    `;
  }

  if (!isMyTurn) {
    return `
      <div class="selection-panel">
        <p class="muted">当前不是你的回合。</p>
      </div>
    `;
  }

  const preview = getPlaySelectionPreview(snapshot, selectedCards, canTakeTurnAction);

  return `
    <div class="selection-panel">
      <div class="selection-summary">
        <strong>已选 ${String(selectedCards.length)} 张</strong>
        <span>${
          selectedCards.length === 0
            ? "请选择一张或多张手牌"
            : selectedCards.map((card) => escapeHtml(card.displayName)).join(" · ")
        }</span>
      </div>
      <div class="selection-actions">
        <button id="play-button" ${preview.canPlay ? "" : "disabled"}>${escapeHtml(preview.label)}</button>
        <button id="clear-selection-button" class="secondary">清空</button>
      </div>
      <p class="muted">${escapeHtml(preview.message)}</p>
    </div>
  `;
}

function renderColorPickerPanel(hand: readonly Card[], canTakeTurnAction: boolean): string {
  if (state.colorPickerCardId === null || !canTakeTurnAction) {
    return "";
  }

  const selectedCard = hand.find((card) => card.id === state.colorPickerCardId);

  if (selectedCard === undefined) {
    return "";
  }

  return `
    <div class="color-picker-backdrop">
      <section class="panel color-picker-panel">
        <h2>选择颜色</h2>
        <p class="muted">${escapeHtml(selectedCard.displayName)}</p>
        <div class="color-choices">
          ${(["red", "yellow", "blue", "green"] as const)
            .map((color) => {
              return `
                <button data-color-choice="${color}" class="color-${color}">
                  <span class="color-swatch color-${color}" aria-hidden="true"></span>
                  <strong>${escapeHtml(getColorDisplayName(color))}</strong>
                </button>
              `;
            })
            .join("")}
        </div>
        <button id="cancel-color-picker-button" class="secondary">取消</button>
      </section>
    </div>
  `;
}

function lookupPlayerName(snapshot: PlayerGameSnapshot, playerId: PlayerId): string {
  if (snapshot.self.playerId === playerId) {
    return snapshot.self.displayName ?? playerId;
  }

  const opponent = snapshot.opponents.find((candidate) => candidate.playerId === playerId);
  return opponent?.displayName ?? playerId;
}

function resolvePlayerAvatar(playerId: PlayerId, avatarUrl: string | null | undefined): string {
  if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl.trim() !== "") {
    return avatarUrl;
  }

  return `/avatars/avatar-${String((hashString(playerId) % FALLBACK_AVATAR_COUNT) + 1)}.png`;
}

function hashString(value: string): number {
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function getOpponentSeatClass(index: number, total: number): string {
  const layouts: Record<number, string[]> = {
    1: ["seat-top"],
    2: ["seat-left", "seat-right"],
    3: ["seat-left", "seat-top", "seat-right"],
    4: ["seat-left", "seat-top-left", "seat-top-right", "seat-right"],
    5: ["seat-left", "seat-top-left", "seat-top", "seat-top-right", "seat-right"],
    6: ["seat-left", "seat-top-left", "seat-top", "seat-top-right", "seat-right", "seat-mid-right"],
    7: [
      "seat-mid-left",
      "seat-left",
      "seat-top-left",
      "seat-top",
      "seat-top-right",
      "seat-right",
      "seat-mid-right"
    ]
  };

  return layouts[total]?.[index] ?? `seat-${String(index)}`;
}

function getPlayerSeatClass(snapshot: PlayerGameSnapshot, playerId: PlayerId): string {
  if (playerId === snapshot.self.playerId) {
    return "from-self";
  }

  const opponentIndex = snapshot.opponents.findIndex((player) => player.playerId === playerId);

  if (opponentIndex === -1) {
    return "from-top";
  }

  return `from-${getOpponentSeatClass(opponentIndex, snapshot.opponents.length).replace("seat-", "")}`;
}

function getPileOffset(index: number, total: number): { x: number; y: number; rotate: number } {
  const offsetSeed = index + total * 3;
  const x = ((offsetSeed * 7) % 17) - 8;
  const y = ((offsetSeed * 11) % 15) - 7;
  const rotate = ((offsetSeed * 13) % 21) - 10;

  return { x, y, rotate };
}

function syncFlyingCardAnimation(snapshot: PlayerGameSnapshot): void {
  const event = state.latestCardsPlayedEvent;

  if (event === null || event.topCardId !== snapshot.topCard.id) {
    return;
  }

  const key = `${event.playerId}-${event.topCardId}-${String(event.receivedAt)}`;

  state.flyingCard = {
    key,
    card: snapshot.topCard,
    playerId: event.playerId,
    seatClass: getPlayerSeatClass(snapshot, event.playerId)
  };
  state.latestCardsPlayedEvent = null;

  window.setTimeout(() => {
    if (state.flyingCard?.key === key) {
      state.flyingCard = null;
      render();
    }
  }, 700);
}

function syncChallengePrompt(snapshot: PlayerGameSnapshot): void {
  const targetPlayerId = snapshot.challengeWindow.targetPlayerId;
  const shouldShowPrompt =
    snapshot.mode === "with-challenge" &&
    snapshot.challengeWindow.active &&
    targetPlayerId !== null &&
    targetPlayerId !== snapshot.self.playerId;

  if (!shouldShowPrompt) {
    state.challengePrompt = null;
    return;
  }

  if (state.challengePrompt?.targetPlayerId !== targetPlayerId) {
    state.challengePrompt = {
      targetPlayerId,
      openedAt: Date.now(),
      dismissed: false
    };
  }
}

function getVisibleChallengePrompt(
  snapshot: PlayerGameSnapshot,
  isConnected: boolean,
  isGameFinished: boolean
): ChallengePromptState | null {
  const prompt = state.challengePrompt;

  if (
    prompt === null ||
    prompt.dismissed ||
    !isConnected ||
    isGameFinished ||
    !snapshot.challengeWindow.active ||
    snapshot.challengeWindow.targetPlayerId !== prompt.targetPlayerId
  ) {
    return null;
  }

  const remainingMs = CHALLENGE_PROMPT_MS - (Date.now() - prompt.openedAt);

  if (remainingMs <= 0) {
    prompt.dismissed = true;
    return null;
  }

  window.setTimeout(() => {
    if (state.challengePrompt === prompt) {
      prompt.dismissed = true;
      render();
    }
  }, remainingMs + 50);

  return prompt;
}

function renderLogPanel(): string {
  return `
    <details class="panel log-panel">
      <summary>消息记录</summary>
      <ol>
        ${state.log.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ol>
    </details>
  `;
}

function handleGameEvents(events: readonly GameEvent[]): void {
  const rejected = events.find((event) => event.type === "command-rejected");

  if (rejected !== undefined) {
    const translatedMessage = translateRejectedMessage(rejected.code, rejected.message);
    state.lastError = translatedMessage;
    pushLog(`\u547d\u4ee4\u88ab\u62d2\u7edd\uff1a${translatedMessage}`);
    showToast(`\u64cd\u4f5c\u5931\u8d25\uff1a${translatedMessage}`, "warning");
  }

  for (const event of events) {
    if (event.type === "cards-played") {
      state.latestCardsPlayedEvent = {
        playerId: event.playerId,
        topCardId: event.topCardId,
        receivedAt: Date.now()
      };
      showToast(`${lookupNameFromKnownState(event.playerId)} \u51fa\u724c\u6210\u529f`, "success");
    }

    if (event.type === "cards-drawn") {
      showToast(`${lookupNameFromKnownState(event.playerId)} \u62bd ${String(event.count)} \u5f20`, "info");
    }

    if (event.type === "challenge-resolved") {
      const message = event.success
        ? `\u8d28\u7591\u6210\u529f\uff1a${lookupNameFromKnownState(event.targetPlayerId)} \u62bd ${String(event.drawCount)} \u5f20`
        : `\u8d28\u7591\u5931\u8d25\uff1a${lookupNameFromKnownState(event.challengerPlayerId)} \u62bd ${String(event.drawCount)} \u5f20`;

      pushLog(message);
      showToast(message, event.success ? "success" : "warning");
    }

    if (event.type === "player-eliminated") {
      const message = `${lookupNameFromKnownState(event.playerId)} \u88ab\u6dd8\u6c70`;
      pushLog(message);
      showToast(message, "warning");
    }

    if (event.type === "game-finished") {
      const message = `\u83b7\u80dc\u8005\uff1a${event.winnerPlayerIds
        .map((playerId) => lookupNameFromKnownState(playerId))
        .join(" \u00b7 ")}`;
      pushLog(message);
      showToast(message, "success");
    }

    if (event.type === "normal-draw-offer-opened" && event.playerId === state.playerId) {
      showToast("\u4f60\u6478\u5230\u4e86\u4e00\u5f20\u53ef\u51fa\u724c\uff0c\u8bf7\u9009\u62e9\u7acb\u5373\u6253\u51fa\u6216\u4fdd\u7559\u3002", "info");
    }
  }
}

function lookupNameFromKnownState(playerId: PlayerId): string {
  if (state.snapshot !== null) {
    return lookupPlayerName(state.snapshot, playerId);
  }

  if (state.room !== null) {
    const player = state.room.players.find((candidate) => candidate.playerId === playerId);
    return player?.displayName ?? playerId;
  }

  return playerId;
}

function translateRejectedMessage(code: ErrorCode, fallbackMessage: string): string {
  switch (code) {
    case "GAME_FINISHED":
      return "本局已经结束。";
    case "PLAYER_NOT_FOUND":
      return "找不到当前玩家。";
    case "PLAYER_ELIMINATED":
      return "你已经被淘汰，不能继续操作。";
    case "NOT_CURRENT_PLAYER":
      return "还没轮到你。";
    case "CARD_NOT_FOUND":
      return "你没有这张牌。";
    case "INVALID_COMBINATION":
      return "这组牌不合法。";
    case "CARD_NOT_PLAYABLE":
      return "这张牌不能接当前牌。";
    case "DECLARED_COLOR_REQUIRED":
      return "请先选择要声明的颜色。";
    case "DRAW_STACK_ACTIVE":
      return "当前有加牌链，只能叠加加牌牌或结算摸牌。";
    case "DRAW_STACK_NOT_ACTIVE":
      return "当前没有加牌链。";
    case "DRAW_UNTIL_COLOR_ACTIVE":
      return "当前处于罚抽状态，只能打罚抽牌或结算罚抽。";
    case "DRAW_UNTIL_COLOR_NOT_ACTIVE":
      return "当前没有罚抽状态。";
    case "UNO_NOT_AVAILABLE":
      return "当前不能说 UNO。";
    case "UNO_REPORT_FAILED":
      return "说 UNO 失败。";
    case "CHALLENGE_NOT_AVAILABLE":
      return "当前不能质疑。";
    default:
      return fallbackMessage;
  }
}

function bindConnectionPanel(): void {
  document.querySelector("#connect-button")?.addEventListener("click", () => {
    const wsUrlInput = document.querySelector<HTMLInputElement>("#ws-url");
    const nicknameInput = document.querySelector<HTMLInputElement>("#nickname");

    if (wsUrlInput !== null) {
      state.wsUrl = wsUrlInput.value;
      setStoredValue("thunder-uno.wsUrl", state.wsUrl);
    }

    if (nicknameInput !== null) {
      state.nickname = ensureNicknameValue(nicknameInput.value);
      nicknameInput.value = state.nickname;
      setSessionStoredValue(USER_NICKNAME_STORAGE_KEY, state.nickname);
    }

    wsClient.connect(state.wsUrl);
  });

  document.querySelector("#disconnect-button")?.addEventListener("click", () => {
    wsClient.close();
  });

  document.querySelector("#ping-button")?.addEventListener("click", () => {
    sendSafely(buildPingMessage());
  });
}

function bindLobbyPanel(): void {
  document.querySelector("#create-room-button")?.addEventListener("click", () => {
    const mode = readSelectValue("#mode", "no-challenge") as GameMode;
    const message = buildCreateRoomMessage({
      userId: state.userId,
      nickname: state.nickname,
      mode
    });
    sendSafely(message);
  });

  document.querySelector("#join-room-button")?.addEventListener("click", () => {
    const roomId = readInputValue("#room-id-input").trim();

    if (roomId.length === 0) {
      state.lastError = "请输入房间号。";
      render();
      return;
    }

    const message = buildJoinRoomMessage({
      roomId,
      userId: state.userId,
      nickname: state.nickname
    });
    sendSafely(message);
  });

  document.querySelector("#start-game-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    sendSafely(
      buildStartGameMessage({
        roomId: state.roomId,
        playerId: state.playerId,
        seed: readInputValue("#seed-input")
      })
    );
  });

  document.querySelector("#leave-room-button")?.addEventListener("click", () => {
    if (state.roomId === null || state.playerId === null) {
      return;
    }

    sendSafely(buildLeaveRoomMessage({ roomId: state.roomId, playerId: state.playerId }));
    resetRoomContext();
    pushLog("已离开房间");
    render();
  });
}

function bindBattlePanel(): void {
  document.querySelector("#finish-reset-button")?.addEventListener("click", () => {
    resetRoomContext();
    pushLog("已返回大厅，请重新创建或加入房间");
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.dataset.cardId;

      if (cardId === undefined) {
        return;
      }

      toggleSelectedCard(cardId);
      render();
    });
  });

  document.querySelector("#draw-card-button")?.addEventListener("click", () => {
    const drawButton = document.querySelector<HTMLButtonElement>("#draw-card-button");
    const drawAction = drawButton?.dataset.drawAction ?? "draw-card";

    if (drawAction === "resolve-draw-stack") {
      sendCommand({ type: "resolve-draw-stack" });
      return;
    }

    if (drawAction === "resolve-draw-until-color") {
      sendCommand({ type: "resolve-draw-until-color" });
      return;
    }

    sendCommand({ type: "draw-card" });
  });

  document.querySelector("#play-drawn-card-button")?.addEventListener("click", () => {
    if (state.snapshot === null) {
      return;
    }

    const offer = state.snapshot.normalDrawOffer;
    if (!offer.active || offer.playerId !== state.playerId || offer.cardId === null) {
      return;
    }

    const drawnCard = state.snapshot.self.hand.find((card) => card.id === offer.cardId);
    if (drawnCard === undefined) {
      return;
    }

    if (drawnCard.isBlack) {
      state.colorPickerCardId = drawnCard.id;
      render();
      return;
    }

    sendCommand({
      type: "play-card",
      cardId: drawnCard.id
    });
  });

  document.querySelector("#keep-drawn-card-button")?.addEventListener("click", () => {
    sendCommand({ type: "keep-drawn-card" });
  });

  document.querySelector("#say-uno-button")?.addEventListener("click", () => {
    sendCommand({ type: "say-uno" });
  });

  document.querySelector("#challenge-no-button")?.addEventListener("click", () => {
    if (state.challengePrompt !== null) {
      state.challengePrompt.dismissed = true;
      render();
    }
  });

  document.querySelector("#clear-selection-button")?.addEventListener("click", () => {
    clearSelectedCards();
    render();
  });

  document.querySelector("#play-button")?.addEventListener("click", () => {
    playSelectedCards();
  });

  document.querySelector("#cancel-color-picker-button")?.addEventListener("click", () => {
    state.colorPickerCardId = null;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-color-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.colorChoice;

      if (
        color !== "red" &&
        color !== "yellow" &&
        color !== "blue" &&
        color !== "green"
      ) {
        return;
      }

      playSelectedBlackCard(color);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-report-uno]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPlayerId = button.dataset.reportUno;

      if (targetPlayerId !== undefined) {
        sendCommand({ type: "report-uno", targetPlayerId });
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-challenge]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPlayerId = button.dataset.challenge;

      if (targetPlayerId !== undefined) {
        sendCommand({ type: "challenge-draw", targetPlayerId });
        if (state.challengePrompt !== null) {
          state.challengePrompt.dismissed = true;
        }
      }
    });
  });
}

function sendCommand(command: ClientCommandInput): void {
  if (state.roomId === null || state.playerId === null) {
    return;
  }

  sendSafely(
    buildCommandMessage({
      roomId: state.roomId,
      playerId: state.playerId,
      command
    })
  );
}

function maybeReconnect(): void {
  if (state.roomId === null) {
    return;
  }

  sendSafely(
    buildReconnectMessage({
      roomId: state.roomId,
      userId: state.userId
    })
  );
}

function playSelectedSingleCard(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);

  if (selectedCards.length !== 1) {
    state.lastError = "请先只选择一张牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  const card = selectedCards[0];

  if (card === undefined) {
    return;
  }

  if (card.isBlack) {
    state.colorPickerCardId = card.id;
    render();
    return;
  }

  sendCommand({
    type: "play-card",
    cardId: card.id
  });
}

function playSelectedBlackCard(declaredColor: CardColor): void {
  if (state.colorPickerCardId === null) {
    return;
  }

  sendCommand({
    type: "play-card",
    cardId: state.colorPickerCardId,
    declaredColor
  });

  state.colorPickerCardId = null;
  render();
}

function playSelectedSequence(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);

  if (!canPlaySequenceSelection(selectedCards)) {
    state.lastError = "顺子至少需要 5 张数字牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  sendCommand({
    type: "play-sequence",
    cardIds: selectedCards.map((card) => card.id)
  });
}

function playSelectedMultipleNumber(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);

  if (!canPlayMultipleNumberSelection(selectedCards)) {
    state.lastError = "连对需要至少 2 张同色同数的数字牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  sendCommand({
    type: "play-multiple-number",
    cardIds: selectedCards.map((card) => card.id)
  });
}

function playSelectedDiscardSameColor(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);
  const payload = buildDiscardSameColorPayload(selectedCards);

  if (payload === null) {
    state.lastError = "同色丢弃需要先选中一张同色丢弃主牌。";
    pushLog(state.lastError);
    render();
    return;
  }

  sendCommand({
    type: "play-discard-same-color",
    ...payload
  });
}

function playSelectedCards(): void {
  if (state.snapshot === null) {
    return;
  }

  const selectedCards = getSelectedCards(state.snapshot.self.hand, state.selectedCardIds);
  const preview = getPlaySelectionPreview(state.snapshot, selectedCards, true);
  const discardSameColorPreview = getDiscardSameColorPlayPreview(state.snapshot, selectedCards);

  if (!preview.canPlay) {
    state.lastError = preview.message;
    pushLog(state.lastError);
    render();
    return;
  }

  if (discardSameColorPreview?.canPlay && discardSameColorPreview.payload !== null) {
    sendCommand({
      type: "play-discard-same-color",
      ...discardSameColorPreview.payload
    });
    return;
  }

  if (selectedCards.length === 1) {
    const [card] = selectedCards;

    if (card === undefined) {
      return;
    }

    if (card.isBlack) {
      state.colorPickerCardId = card.id;
      render();
      return;
    }

    sendCommand({
      type: "play-card",
      cardId: card.id
    });
    return;
  }

  if (canPlaySequenceSelection(selectedCards)) {
    sendCommand({
      type: "play-sequence",
      cardIds: selectedCards.map((card) => card.id)
    });
    return;
  }

  if (canPlayMultipleNumberSelection(selectedCards)) {
    sendCommand({
      type: "play-multiple-number",
      cardIds: selectedCards.map((card) => card.id)
    });
    return;
  }

  state.lastError = preview.message;
  pushLog(state.lastError);
  render();
}

function sendSafely(message: Parameters<WsClient["send"]>[0]): void {
  try {
    wsClient.send(message);
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "发送失败";
    pushLog(state.lastError);
    render();
  }
}

function pushLog(line: string): void {
  state.log = [`${new Date().toLocaleTimeString()} ${line}`, ...state.log].slice(0, 12);
}

function showToast(message: string, tone: UiToastState["tone"] = "info"): void {
  const key = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  state.uiToast = { key, message, tone };

  window.setTimeout(() => {
    if (state.uiToast?.key === key) {
      state.uiToast = null;
      render();
    }
  }, 2600);
}

function toggleSelectedCard(cardId: string): void {
  const index = state.selectedCardIds.indexOf(cardId);

  if (index === -1) {
    state.selectedCardIds = [...state.selectedCardIds, cardId];
  } else {
    state.selectedCardIds = [
      ...state.selectedCardIds.slice(0, index),
      ...state.selectedCardIds.slice(index + 1)
    ];
  }
}

function clearSelectedCards(): void {
  state.selectedCardIds = [];
  state.colorPickerCardId = null;
}

function resetRoomContext(): void {
  state.room = null;
  state.snapshot = null;
  state.roomId = null;
  state.playerId = null;
  state.uiToast = null;
  state.snapshotRecoveryRoomId = null;
  clearSelectedCards();
  removeSessionStoredValue(LAST_ROOM_STORAGE_KEY);
}

function recoverMissingPlayingSnapshot(room: PlayerRoomSnapshot): void {
  if (
    room.status !== "playing" ||
    state.snapshot !== null ||
    state.connectionStatus !== "open" ||
    state.snapshotRecoveryRoomId === room.roomId
  ) {
    return;
  }

  state.snapshotRecoveryRoomId = room.roomId;
  sendSafely(
    buildReconnectMessage({
      roomId: room.roomId,
      userId: state.userId
    })
  );
  pushLog("房间已开始，正在同步对局快照");
}

function readInputValue(selector: string): string {
  return document.querySelector<HTMLInputElement>(selector)?.value ?? "";
}

function readSelectValue(selector: string, fallback: string): string {
  return document.querySelector<HTMLSelectElement>(selector)?.value ?? fallback;
}

function getOrCreateUserId(): string {
  const stored = getSessionStoredValue(USER_ID_STORAGE_KEY);

  if (stored !== null && shouldReuseStoredSession) {
    return stored;
  }

  const userId = createUserId();
  setSessionStoredValue(USER_ID_STORAGE_KEY, userId);
  return userId;
}

function getOrCreateNickname(): string {
  const stored = getSessionStoredValue(USER_NICKNAME_STORAGE_KEY);

  if (stored !== null && stored.trim() !== "" && shouldReuseStoredSession) {
    return stored.trim();
  }

  const nickname = createRandomNickname();
  setSessionStoredValue(USER_NICKNAME_STORAGE_KEY, nickname);
  return nickname;
}

function getStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function removeStoredValue(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function readStoredRoomId(): RoomId | null {
  if (!shouldReuseStoredSession) {
    return null;
  }

  const value = getSessionStoredValue(LAST_ROOM_STORAGE_KEY);
  return value === null || value.trim() === "" ? null : value;
}

function resetClonedSessionIdentity(): void {
  removeSessionStoredValue(LAST_ROOM_STORAGE_KEY);
  removeSessionStoredValue(USER_ID_STORAGE_KEY);
  removeSessionStoredValue(USER_NICKNAME_STORAGE_KEY);
}

function shouldReuseStoredSessionIdentity(): boolean {
  const navigationType = getNavigationType();

  return (
    navigationType === null ||
    navigationType === "reload" ||
    navigationType === "back_forward"
  );
}

function getNavigationType(): PerformanceNavigationTiming["type"] | null {
  try {
    const [navigationEntry] = performance.getEntriesByType("navigation");

    if (
      navigationEntry !== undefined &&
      "type" in navigationEntry &&
      typeof navigationEntry.type === "string"
    ) {
      return navigationEntry.type as PerformanceNavigationTiming["type"];
    }
  } catch {
    return null;
  }

  return null;
}

function getSessionStoredValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionStoredValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function removeSessionStoredValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

function ensureNicknameValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? createRandomNickname() : trimmed;
}

function createRandomNickname(): string {
  return `玩家${createRandomFourDigitNumber()}`;
}

function createRandomFourDigitNumber(): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi !== undefined && typeof cryptoApi.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    cryptoApi.getRandomValues(buffer);
    return String(buffer[0]! % 10_000).padStart(4, "0");
  }

  return String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}






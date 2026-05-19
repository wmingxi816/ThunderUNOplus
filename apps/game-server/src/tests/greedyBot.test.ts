import { describe, expect, it } from "vitest";
import {
  createBlackCard,
  createColoredActionCard,
  createInitialGame,
  createNumberCard
} from "@thunder-uno/uno-core";
import type { Card, GameState } from "@thunder-uno/shared-types";
import { decideGreedyBotAction } from "../bot/greedyBot";
import { scoreBotCandidates } from "../bot/botScoring";
import type { BotCandidateAction } from "../bot/botCandidates";

describe("Greedy bot decision", () => {
  it("falls back to drawing when the bot has no playable card", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;

    state.topCard = createNumberCard("top-red-5", "red", 5);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [createNumberCard("bot-blue-1", "blue", 1)];
    botPlayer.handCount = botPlayer.hand.length;
    state.drawPile = [createNumberCard("draw-green-3", "green", 3)];

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "draw-card",
      playerId: "bot-1"
    });
  });

  it("prefers an isolated number card farthest from the hand average", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const redOneA = createNumberCard("bot-red-1-a", "red", 1);
    const redOneB = createNumberCard("bot-red-1-b", "red", 1);
    const redTwo = createNumberCard("bot-red-2", "red", 2);
    const redThree = createNumberCard("bot-red-3", "red", 3);
    const redFour = createNumberCard("bot-red-4", "red", 4);
    const redFive = createNumberCard("bot-red-5", "red", 5);
    const redNine = createNumberCard("bot-red-9", "red", 9);

    state.topCard = createNumberCard("top-red-7", "red", 7);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [
      redOneA,
      redOneB,
      redTwo,
      redThree,
      redFour,
      redFive,
      redNine
    ];
    botPlayer.handCount = botPlayer.hand.length;

    const candidates: BotCandidateAction[] = [redOneA, redThree, redNine].map(
      (card) => {
        return {
          command: {
            type: "play-card",
            playerId: "bot-1",
            cardId: card.id
          },
          cardIds: [card.id],
          reasons: ["single-card"]
        };
      }
    );

    const [bestAction] = scoreBotCandidates(
      state,
      "bot-1",
      candidates,
      () => 0
    );

    expect(bestAction?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: redNine.id
    });
  });

  it("strongly prefers swap-hands when the bot has a weak hand with more than 15 cards", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const swapHands = createColoredActionCard("bot-red-swap", "red", "swap-hands");

    state.topCard = createNumberCard("top-red-5", "red", 5);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [
      swapHands,
      ...Array.from({ length: 15 }, (_, index) => {
        return createNumberCard(
          `bot-red-filler-${index}`,
          "red",
          (index % 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
        );
      })
    ];
    botPlayer.handCount = botPlayer.hand.length;

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: swapHands.id
    });
    expect(decision?.score).toBeGreaterThan(2_500);
    expect(decision?.score).toBeLessThan(3_000);
  });

  it("strongly prefers swap-hands when most cards are low-value ordinary cards", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const swapHands = createColoredActionCard("bot-red-swap", "red", "swap-hands");

    state.topCard = createNumberCard("top-red-5", "red", 5);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [
      swapHands,
      createNumberCard("bot-red-0", "red", 0),
      createNumberCard("bot-red-1", "red", 1),
      createNumberCard("bot-red-2", "red", 2),
      createNumberCard("bot-red-3", "red", 3),
      createColoredActionCard("bot-red-skip", "red", "skip"),
      createColoredActionCard("bot-blue-reverse", "blue", "reverse"),
      createColoredActionCard("bot-green-discard", "green", "discard-same-color")
    ];
    botPlayer.handCount = botPlayer.hand.length;

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: swapHands.id
    });
    expect(decision?.score).toBeGreaterThan(2_500);
    expect(decision?.score).toBeLessThan(3_000);
  });

  it("scores a large weak hand higher than a large strong hand for swap-hands", () => {
    const weakState = createBotTestState();
    const weakBotPlayer = weakState.players.find((player) => player.id === "bot-1")!;
    const weakSwapHands = createColoredActionCard(
      "bot-red-weak-swap",
      "red",
      "swap-hands"
    );
    const strongState = createBotTestState();
    const strongBotPlayer = strongState.players.find((player) => player.id === "bot-1")!;
    const strongSwapHands = createColoredActionCard(
      "bot-red-strong-swap",
      "red",
      "swap-hands"
    );

    setupPlayableRedTop(weakState);
    setupPlayableRedTop(strongState);
    weakBotPlayer.hand = [
      weakSwapHands,
      ...Array.from({ length: 15 }, (_, index) => {
        return createNumberCard(
          `bot-red-weak-${index}`,
          "red",
          (index % 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
        );
      })
    ];
    weakBotPlayer.handCount = weakBotPlayer.hand.length;
    strongBotPlayer.hand = [
      strongSwapHands,
      ...Array.from({ length: 15 }, (_, index) => {
        return createBlackCard(`bot-strong-wild-ten-${index}`, "wild-draw-ten");
      })
    ];
    strongBotPlayer.handCount = strongBotPlayer.hand.length;

    const [weakSwapAction] = scoreBotCandidates(
      weakState,
      "bot-1",
      [createSinglePlayCandidate("bot-1", weakSwapHands.id)],
      () => 0
    );
    const [strongSwapAction] = scoreBotCandidates(
      strongState,
      "bot-1",
      [createSinglePlayCandidate("bot-1", strongSwapHands.id)],
      () => 0
    );

    expect(weakSwapAction?.score).toBeGreaterThan(strongSwapAction?.score ?? 0);
    expect(strongSwapAction?.score).toBeLessThan(2_000);
  });

  it("does not boost swap-hands when the bot has a strong hand", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const swapHands = createColoredActionCard("bot-red-swap", "red", "swap-hands");

    state.topCard = createNumberCard("top-red-5", "red", 5);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [
      swapHands,
      createBlackCard("bot-wild", "wild"),
      createBlackCard("bot-penalty", "penalty-draw"),
      createBlackCard("bot-wild-reverse-four", "wild-reverse-draw-four"),
      createBlackCard("bot-wild-six", "wild-draw-six"),
      createBlackCard("bot-wild-ten", "wild-draw-ten"),
      createColoredActionCard("bot-red-draw-two", "red", "draw-two")
    ];
    botPlayer.handCount = botPlayer.hand.length;

    const [swapAction] = scoreBotCandidates(
      state,
      "bot-1",
      [
        {
          command: {
            type: "play-card",
            playerId: "bot-1",
            cardId: swapHands.id
          },
          cardIds: [swapHands.id],
          reasons: ["single-card"]
        }
      ],
      () => 0
    );

    expect(swapAction?.score).toBeLessThan(3_000);
  });

  it("does not throw away a small low-value hand by forcing swap-hands", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const swapHands = createColoredActionCard("bot-red-swap", "red", "swap-hands");
    const redNine = createNumberCard("bot-red-9", "red", 9);

    state.topCard = createNumberCard("top-red-5", "red", 5);
    state.currentColor = "red";
    state.discardPile = [state.topCard];
    state.currentPlayerId = "bot-1";
    botPlayer.hand = [
      swapHands,
      redNine,
      createNumberCard("bot-red-8", "red", 8)
    ];
    botPlayer.handCount = botPlayer.hand.length;

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: redNine.id
    });
  });

  it("draws instead of swapping a tiny hand into a much larger source hand", () => {
    const state = createBotTestState();
    const botPlayer = state.players.find((player) => player.id === "bot-1")!;
    const swapHands = createColoredActionCard("tiny-red-swap", "red", "swap-hands");

    setupPlayableRedTop(state);
    state.drawPile = [createNumberCard("strategic-draw-blue-3", "blue", 3)];
    setPlayerHand(state, "bot-1", [
      swapHands,
      createNumberCard("tiny-blue-8", "blue", 8),
      createNumberCard("tiny-green-9", "green", 9)
    ]);
    setPlayerHand(state, "player-3", createNumberCards("source-large", 8, "yellow"));

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(botPlayer.handCount).toBe(3);
    expect(decision?.command).toEqual({
      type: "draw-card",
      playerId: "bot-1"
    });
  });

  it("allows a small bot hand to swap when the source hand is even smaller", () => {
    const state = createBotTestState();
    const swapHands = createColoredActionCard("small-red-swap", "red", "swap-hands");

    setupPlayableRedTop(state);
    setPlayerHand(state, "bot-1", [
      swapHands,
      createNumberCard("small-red-8", "red", 8),
      createNumberCard("small-red-9", "red", 9),
      createNumberCard("small-blue-1", "blue", 1)
    ]);
    setPlayerHand(state, "player-3", createNumberCards("source-small", 2, "yellow"));

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: swapHands.id
    });
  });

  it("prefers swap-hands when the bot has many cards and the source has one card", () => {
    const state = createBotTestState();
    const swapHands = createColoredActionCard("large-red-swap", "red", "swap-hands");

    setupPlayableRedTop(state);
    setPlayerHand(state, "bot-1", [
      swapHands,
      ...createNumberCards("large-bot", 8, "red")
    ]);
    setPlayerHand(state, "player-3", [createNumberCard("source-one-yellow-1", "yellow", 1)]);

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: swapHands.id
    });
  });

  it("keeps swap-hands attractive for a large weak hand against a medium source hand", () => {
    const state = createBotTestState();
    const swapHands = createColoredActionCard("weak-red-swap", "red", "swap-hands");

    setupPlayableRedTop(state);
    setPlayerHand(state, "bot-1", [
      swapHands,
      ...createNumberCards("weak-bot", 12, "red")
    ]);
    setPlayerHand(state, "player-3", createNumberCards("medium-source", 6, "yellow"));

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: swapHands.id
    });
  });

  it("suppresses swap-hands when the bot has many strong power cards to preserve", () => {
    const state = createBotTestState();
    const swapHands = createColoredActionCard("strong-red-swap", "red", "swap-hands");

    setupPlayableRedTop(state);
    setPlayerHand(state, "bot-1", [
      swapHands,
      createBlackCard("strong-wild-ten-a", "wild-draw-ten"),
      createBlackCard("strong-wild-ten-b", "wild-draw-ten"),
      createBlackCard("strong-wild-six", "wild-draw-six"),
      createBlackCard("strong-penalty", "penalty-draw"),
      createBlackCard("strong-reverse-four", "wild-reverse-draw-four"),
      createColoredActionCard("strong-red-draw-two", "red", "draw-two"),
      ...createNumberCards("strong-filler", 5, "red")
    ]);
    setPlayerHand(state, "player-3", createNumberCards("strong-source", 6, "yellow"));

    const decision = decideGreedyBotAction({
      state,
      playerId: "bot-1",
      forgetUnoRate: 0.2,
      random: () => 0
    });

    expect(decision?.command).not.toEqual({
      type: "play-card",
      playerId: "bot-1",
      cardId: swapHands.id
    });
  });

  it("scores a huge weak hand higher when the source hand is clearly smaller than when it is also large", () => {
    const favorableState = createBotTestState();
    const neutralState = createBotTestState();
    const favorableSwap = createColoredActionCard("favorable-red-swap", "red", "swap-hands");
    const neutralSwap = createColoredActionCard("neutral-red-swap", "red", "swap-hands");

    setupPlayableRedTop(favorableState);
    setupPlayableRedTop(neutralState);
    setPlayerHand(favorableState, "bot-1", [
      favorableSwap,
      ...createNumberCards("favorable-bot", 16, "red")
    ]);
    setPlayerHand(neutralState, "bot-1", [
      neutralSwap,
      ...createNumberCards("neutral-bot", 16, "red")
    ]);
    setPlayerHand(favorableState, "player-3", createNumberCards("favorable-source", 2, "yellow"));
    setPlayerHand(neutralState, "player-3", createNumberCards("neutral-source", 14, "yellow"));

    const [favorableAction] = scoreBotCandidates(
      favorableState,
      "bot-1",
      [createSinglePlayCandidate("bot-1", favorableSwap.id)],
      () => 0
    );
    const [neutralAction] = scoreBotCandidates(
      neutralState,
      "bot-1",
      [createSinglePlayCandidate("bot-1", neutralSwap.id)],
      () => 0
    );

    expect(favorableAction?.score).toBeGreaterThan(neutralAction?.score ?? 0);
    expect(neutralAction?.score).toBeLessThan(2_700);
  });
});

function createBotTestState(): GameState {
  const state = createInitialGame({
    players: [
      { id: "bot-1", isBot: true },
      { id: "player-2" },
      { id: "player-3" }
    ],
    mode: "no-challenge",
    seed: "greedy-bot-test"
  });
  state.initialDirectionChoice = {
    active: false,
    chooserPlayerId: null
  };
  return state;
}

function setupPlayableRedTop(state: GameState): void {
  state.topCard = createNumberCard("top-red-5", "red", 5);
  state.currentColor = "red";
  state.discardPile = [state.topCard];
  state.currentPlayerId = "bot-1";
}

function createSinglePlayCandidate(
  playerId: "bot-1",
  cardId: string
): BotCandidateAction {
  return {
    command: {
      type: "play-card",
      playerId,
      cardId
    },
    cardIds: [cardId],
    reasons: ["single-card"]
  };
}

function setPlayerHand(state: GameState, playerId: string, hand: Card[]): void {
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (player === undefined) {
    throw new Error(`Player ${playerId} was not found.`);
  }

  player.hand = hand;
  player.handCount = hand.length;
}

function createNumberCards(prefix: string, count: number, color: "red" | "yellow"): Card[] {
  return Array.from({ length: count }, (_, index) => {
    return createNumberCard(
      `${prefix}-${String(index)}`,
      color,
      (index % 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
    );
  });
}

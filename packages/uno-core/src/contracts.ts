/**
 * 描述规则引擎未来应该提供什么能力的公共契约。
 *
 * 虽然 Phase 2A 还没有完整实现一个 engine 对象，
 * 但这些接口先把后续阶段要遵守的边界固定下来。
 */
import type { Card } from "./card";
import type { CreateInitialGameParams, GameState } from "./gameState";
import type { CardColor } from "./card";
import { RULE_SOURCE_OF_TRUTH } from "./config";
import type { ApplyCommandResult, GameCommand } from "./reducer/types";

/** 普通“这张牌能不能打”的输入结构。 */
export interface CanPlayCardContractInput {
  card: Card;
  topCard: Card | null;
  currentColor?: CardColor;
}

/** 加牌链继续接牌时的输入结构。 */
export interface CanStackDrawCardContractInput {
  nextCard: Card;
  currentColor?: CardColor;
  previousDrawValue: number;
}

/** 多张牌校验函数共用的轻量返回结构。 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 规划中的高层规则引擎接口。
 * 后续阶段可以在这个接口背后补上真正的实现对象。
 */
export interface UnoRulesEngine {
  getRuleReferences(): typeof RULE_SOURCE_OF_TRUTH;
  createInitialGame(params: CreateInitialGameParams): GameState;
  applyCommand(state: GameState, command: GameCommand): ApplyCommandResult;
  canPlayCard(input: CanPlayCardContractInput): boolean;
  canStackDrawCard(input: CanStackDrawCardContractInput): boolean;
  validateSequencePlay(cards: readonly Card[]): ValidationResult;
  validateMultipleNumberPlay(cards: readonly Card[]): ValidationResult;
  validateDiscardSameColorPlay(
    mainCard: Card,
    attachedCards: readonly Card[]
  ): ValidationResult;
}

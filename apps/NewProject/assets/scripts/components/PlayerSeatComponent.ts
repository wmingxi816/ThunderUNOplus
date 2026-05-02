import { _decorator, Component, Label, Node } from "cc";

const { ccclass, property } = _decorator;

@ccclass("PlayerSeatComponent")
export class PlayerSeatComponent extends Component {
  @property(Node)
  public avatarPlaceholder: Node | null = null;

  @property(Label)
  public displayNameLabel: Label | null = null;

  @property(Label)
  public handCountLabel: Label | null = null;

  @property(Label)
  public unoStateLabel: Label | null = null;

  @property(Label)
  public turnStateLabel: Label | null = null;

  @property(Label)
  public eliminatedStateLabel: Label | null = null;

  public setDisplayName(name: string): void {
    if (this.displayNameLabel) {
      this.displayNameLabel.string = name;
    }
  }

  public setHandCount(count: number): void {
    if (this.handCountLabel) {
      this.handCountLabel.string = `手牌：${String(count)}`;
    }
  }

  public setUnoState(text: string): void {
    if (this.unoStateLabel) {
      this.unoStateLabel.string = text;
    }
  }

  public setTurnState(text: string): void {
    if (this.turnStateLabel) {
      this.turnStateLabel.string = text;
    }
  }

  public setEliminatedState(text: string): void {
    if (this.eliminatedStateLabel) {
      this.eliminatedStateLabel.string = text;
    }
  }
}

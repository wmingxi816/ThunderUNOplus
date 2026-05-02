import { _decorator, Component, Label, Node } from "cc";

const { ccclass, property } = _decorator;

@ccclass("CardViewComponent")
export class CardViewComponent extends Component {
  @property(Label)
  public cardLabel: Label | null = null;

  @property(Node)
  public playableHint: Node | null = null;

  public setCardText(text: string): void {
    if (this.cardLabel) {
      this.cardLabel.string = text;
    }
  }

  public setPlayable(isPlayable: boolean): void {
    if (this.playableHint) {
      this.playableHint.active = isPlayable;
    }
  }
}

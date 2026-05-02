import { _decorator, Component, Label, Node } from "cc";

const { ccclass, property } = _decorator;

@ccclass("ToastComponent")
export class ToastComponent extends Component {
  @property(Node)
  public rootNode: Node | null = null;

  @property(Label)
  public toastLabel: Label | null = null;

  protected onLoad(): void {
    this.hide();
  }

  public show(text: string): void {
    if (this.toastLabel) {
      this.toastLabel.string = text;
    }

    if (this.rootNode) {
      this.rootNode.active = true;
      return;
    }

    this.node.active = true;
  }

  public hide(): void {
    if (this.rootNode) {
      this.rootNode.active = false;
      return;
    }

    this.node.active = false;
  }
}

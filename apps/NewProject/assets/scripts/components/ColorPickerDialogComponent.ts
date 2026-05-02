import { _decorator, Button, Component, Label, Node } from "cc";

const { ccclass, property } = _decorator;

export type PickerColor = "red" | "yellow" | "blue" | "green";

@ccclass("ColorPickerDialogComponent")
export class ColorPickerDialogComponent extends Component {
  @property(Node)
  public rootNode: Node | null = null;

  @property(Label)
  public dialogTitleLabel: Label | null = null;

  @property(Button)
  public colorRedButton: Button | null = null;

  @property(Button)
  public colorYellowButton: Button | null = null;

  @property(Button)
  public colorBlueButton: Button | null = null;

  @property(Button)
  public colorGreenButton: Button | null = null;

  private onColorSelected: ((color: PickerColor) => void) | null = null;

  protected onLoad(): void {
    this.close();
  }

  public open(title = "请选择颜色"): void {
    if (this.dialogTitleLabel) {
      this.dialogTitleLabel.string = title;
    }

    if (this.rootNode) {
      this.rootNode.active = true;
      return;
    }

    this.node.active = true;
  }

  public close(): void {
    if (this.rootNode) {
      this.rootNode.active = false;
      return;
    }

    this.node.active = false;
  }

  public setOnColorSelected(handler: ((color: PickerColor) => void) | null): void {
    this.onColorSelected = handler;
  }

  public chooseRed(): void {
    this.emitColor("red");
  }

  public chooseYellow(): void {
    this.emitColor("yellow");
  }

  public chooseBlue(): void {
    this.emitColor("blue");
  }

  public chooseGreen(): void {
    this.emitColor("green");
  }

  private emitColor(color: PickerColor): void {
    this.onColorSelected?.(color);
    this.close();
  }
}

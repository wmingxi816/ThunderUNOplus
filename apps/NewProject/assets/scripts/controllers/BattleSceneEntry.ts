import {
  _decorator,
  Button,
  Component,
  Label,
  Node,
  ScrollView
} from "cc";
import { CardViewComponent } from "../components/CardViewComponent";
import {
  ColorPickerDialogComponent,
  type PickerColor
} from "../components/ColorPickerDialogComponent";
import { PlayerSeatComponent } from "../components/PlayerSeatComponent";
import { ToastComponent } from "../components/ToastComponent";

const { ccclass, property } = _decorator;

@ccclass("BattleSceneEntry")
export class BattleSceneEntry extends Component {
  @property(Label)
  public roomIdLabel: Label | null = null;

  @property(Label)
  public currentColorLabel: Label | null = null;

  @property(Label)
  public currentPlayerLabel: Label | null = null;

  @property(Label)
  public directionLabel: Label | null = null;

  @property(Node)
  public topCardRoot: Node | null = null;

  @property(CardViewComponent)
  public topCardView: CardViewComponent | null = null;

  @property(Button)
  public drawPileButton: Button | null = null;

  @property(Label)
  public drawPileCountLabel: Label | null = null;

  @property(Label)
  public drawStackLabel: Label | null = null;

  @property(Label)
  public drawUntilColorLabel: Label | null = null;

  @property(Node)
  public opponentSeatsRoot: Node | null = null;

  @property(PlayerSeatComponent)
  public selfSeat: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat1: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat2: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat3: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat4: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat5: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat6: PlayerSeatComponent | null = null;

  @property(PlayerSeatComponent)
  public opponentSeat7: PlayerSeatComponent | null = null;

  @property(ScrollView)
  public handScrollView: ScrollView | null = null;

  @property(Node)
  public handContent: Node | null = null;

  @property(Label)
  public eventLogLabel: Label | null = null;

  @property(Button)
  public unoButton: Button | null = null;

  @property(Button)
  public challengeButton: Button | null = null;

  @property(Button)
  public resolveDrawStackButton: Button | null = null;

  @property(Button)
  public resolveDrawUntilColorButton: Button | null = null;

  @property(Button)
  public reconnectButton: Button | null = null;

  @property(ColorPickerDialogComponent)
  public colorPickerDialog: ColorPickerDialogComponent | null = null;

  @property(Node)
  public toastRoot: Node | null = null;

  @property(ToastComponent)
  public toastComponent: ToastComponent | null = null;

  public setRoomId(text: string): void {
    if (this.roomIdLabel) {
      this.roomIdLabel.string = text;
    }
  }

  public setCurrentColor(text: string): void {
    if (this.currentColorLabel) {
      this.currentColorLabel.string = text;
    }
  }

  public setCurrentPlayer(text: string): void {
    if (this.currentPlayerLabel) {
      this.currentPlayerLabel.string = text;
    }
  }

  public setDirection(text: string): void {
    if (this.directionLabel) {
      this.directionLabel.string = text;
    }
  }

  public setEventLog(text: string): void {
    if (this.eventLogLabel) {
      this.eventLogLabel.string = text;
    }
  }

  public getOpponentSeats(): PlayerSeatComponent[] {
    return [
      this.opponentSeat1,
      this.opponentSeat2,
      this.opponentSeat3,
      this.opponentSeat4,
      this.opponentSeat5,
      this.opponentSeat6,
      this.opponentSeat7
    ].filter((seat): seat is PlayerSeatComponent => seat !== null);
  }

  public openColorPicker(): void {
    this.colorPickerDialog?.open("请选择黑牌颜色");
    this.colorPickerDialog?.setOnColorSelected((color) => {
      this.onColorSelected(color);
    });
  }

  public onDrawButtonClicked(): void {
    this.toastComponent?.show("这里先绑定摸牌逻辑");
  }

  public onUnoButtonClicked(): void {
    this.toastComponent?.show("这里先绑定 UNO 逻辑");
  }

  public onChallengeButtonClicked(): void {
    this.toastComponent?.show("这里先绑定质疑逻辑");
  }

  public onResolveDrawStackButtonClicked(): void {
    this.toastComponent?.show("这里先绑定结算加牌逻辑");
  }

  public onResolveDrawUntilColorButtonClicked(): void {
    this.toastComponent?.show("这里先绑定结算罚抽逻辑");
  }

  public onReconnectButtonClicked(): void {
    this.toastComponent?.show("这里先绑定战斗页重连逻辑");
  }

  private onColorSelected(color: PickerColor): void {
    this.toastComponent?.show(`已选择颜色：${color}`);
  }
}

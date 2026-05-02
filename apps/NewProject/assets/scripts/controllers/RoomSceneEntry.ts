import { _decorator, Button, Component, Label, Node, ScrollView } from "cc";
import { ToastComponent } from "../components/ToastComponent";

const { ccclass, property } = _decorator;

@ccclass("RoomSceneEntry")
export class RoomSceneEntry extends Component {
  @property(Label)
  public roomCodeLabel: Label | null = null;

  @property(Label)
  public modeLabel: Label | null = null;

  @property(Label)
  public statusLabel: Label | null = null;

  @property(Label)
  public connectionStateLabel: Label | null = null;

  @property(ScrollView)
  public playerListScrollView: ScrollView | null = null;

  @property(Node)
  public playerListContent: Node | null = null;

  @property(Node)
  public playerItemTemplate: Node | null = null;

  @property(Button)
  public startGameButton: Button | null = null;

  @property(Button)
  public leaveRoomButton: Button | null = null;

  @property(Button)
  public reconnectButton: Button | null = null;

  @property(Node)
  public toastRoot: Node | null = null;

  @property(ToastComponent)
  public toastComponent: ToastComponent | null = null;

  public setRoomCode(text: string): void {
    if (this.roomCodeLabel) {
      this.roomCodeLabel.string = text;
    }
  }

  public setMode(text: string): void {
    if (this.modeLabel) {
      this.modeLabel.string = text;
    }
  }

  public setStatus(text: string): void {
    if (this.statusLabel) {
      this.statusLabel.string = text;
    }
  }

  public setConnectionState(text: string): void {
    if (this.connectionStateLabel) {
      this.connectionStateLabel.string = text;
    }
  }

  public onStartGameButtonClicked(): void {
    this.toastComponent?.show("这里先绑定开始游戏逻辑");
  }

  public onLeaveRoomButtonClicked(): void {
    this.toastComponent?.show("这里先绑定离开房间逻辑");
  }

  public onReconnectButtonClicked(): void {
    this.toastComponent?.show("这里先绑定房间页重连逻辑");
  }
}

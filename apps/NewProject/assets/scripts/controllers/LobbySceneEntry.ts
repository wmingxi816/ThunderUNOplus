import {
  _decorator,
  Button,
  Component,
  EditBox,
  Label,
  Node,
  Toggle
} from "cc";
import { ToastComponent } from "../components/ToastComponent";

const { ccclass, property } = _decorator;

@ccclass("LobbySceneEntry")
export class LobbySceneEntry extends Component {
  @property(Label)
  public userLabel: Label | null = null;

  @property(Label)
  public connectionStateLabel: Label | null = null;

  @property(Toggle)
  public noChallengeToggle: Toggle | null = null;

  @property(Toggle)
  public withChallengeToggle: Toggle | null = null;

  @property(Button)
  public createRoomButton: Button | null = null;

  @property(EditBox)
  public roomIdInput: EditBox | null = null;

  @property(Button)
  public joinRoomButton: Button | null = null;

  @property(Node)
  public toastRoot: Node | null = null;

  @property(ToastComponent)
  public toastComponent: ToastComponent | null = null;

  public getSelectedMode(): "no-challenge" | "with-challenge" {
    return this.withChallengeToggle?.isChecked ? "with-challenge" : "no-challenge";
  }

  public getRoomId(): string {
    return this.roomIdInput?.string.trim() ?? "";
  }

  public setUserInfo(text: string): void {
    if (this.userLabel) {
      this.userLabel.string = text;
    }
  }

  public setConnectionState(text: string): void {
    if (this.connectionStateLabel) {
      this.connectionStateLabel.string = text;
    }
  }

  public onCreateRoomButtonClicked(): void {
    this.toastComponent?.show("这里先绑定创建房间逻辑");
  }

  public onJoinRoomButtonClicked(): void {
    this.toastComponent?.show("这里先绑定加入房间逻辑");
  }
}

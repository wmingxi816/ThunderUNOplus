import { _decorator, Button, Component, EditBox, Label, Node } from "cc";
import { ToastComponent } from "../components/ToastComponent";

const { ccclass, property } = _decorator;

@ccclass("LoginSceneEntry")
export class LoginSceneEntry extends Component {
  @property(Label)
  public titleLabel: Label | null = null;

  @property(EditBox)
  public nicknameInput: EditBox | null = null;

  @property(EditBox)
  public wsUrlInput: EditBox | null = null;

  @property(Label)
  public connectionStateLabel: Label | null = null;

  @property(Button)
  public connectButton: Button | null = null;

  @property(Button)
  public enterLobbyButton: Button | null = null;

  @property(Button)
  public reconnectButton: Button | null = null;

  @property(Node)
  public toastRoot: Node | null = null;

  @property(ToastComponent)
  public toastComponent: ToastComponent | null = null;

  public getNickname(): string {
    return this.nicknameInput?.string.trim() ?? "";
  }

  public getWsUrl(): string {
    return this.wsUrlInput?.string.trim() ?? "";
  }

  public setConnectionState(text: string): void {
    if (this.connectionStateLabel) {
      this.connectionStateLabel.string = text;
    }
  }

  public onConnectButtonClicked(): void {
    this.toastComponent?.show("这里先绑定连接逻辑");
  }

  public onEnterLobbyButtonClicked(): void {
    this.toastComponent?.show("这里先绑定进入大厅逻辑");
  }

  public onReconnectButtonClicked(): void {
    this.toastComponent?.show("这里先绑定重连逻辑");
  }
}

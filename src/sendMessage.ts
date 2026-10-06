import OBR from "@owlbear-rodeo/sdk";
import { RULER_MESSAGE_CHANNEL } from "./idStrings";
import { Message } from "./types/Message";

export function sendMessage(message: Message) {
  OBR.broadcast.sendMessage(RULER_MESSAGE_CHANNEL, message, {
    destination: "LOCAL",
  });
}

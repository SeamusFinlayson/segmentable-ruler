import OBR from "@owlbear-rodeo/sdk";
import { CREATED_BY_METADATA_ID } from "./idStrings";

export async function clearRulerItems(
  targets:
    | {
        scope: "PLAYER";
        playerId?: string;
      }
    | {
        scope: "ALL";
      },
) {
  let items = await OBR.scene.items.getItems();

  if (targets.scope === "PLAYER") {
    items = items.filter(
      (item) =>
        item.metadata[CREATED_BY_METADATA_ID] ===
        (targets.playerId ?? OBR.player.id),
    );
  } else {
    items = items.filter((item) => item.metadata[CREATED_BY_METADATA_ID]);
  }

  const ids = items.map((item) => item.id);
  OBR.scene.items.deleteItems(ids);
}

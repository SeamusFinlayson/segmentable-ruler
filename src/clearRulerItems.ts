import OBR from "@owlbear-rodeo/sdk";
import { CREATED_BY_METADATA_ID } from "./idStrings";

export async function clearRulerItems(selection: "PLAYER" | "ALL") {
  const playerId = await OBR.player.getId();
  let items = await OBR.scene.items.getItems();

  if (selection === "PLAYER") {
    items = items.filter(
      (item) => item.metadata[CREATED_BY_METADATA_ID] === playerId,
    );
  } else {
    items = items.filter((item) => item.metadata[CREATED_BY_METADATA_ID]);
  }

  const ids = items.map((item) => item.id);
  OBR.scene.items.deleteItems(ids);
}

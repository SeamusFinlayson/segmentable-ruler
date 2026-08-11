import OBR from "@owlbear-rodeo/sdk";
import {
  getItemId,
  getPluginId,
  RULER_MESSAGE_CHANNEL,
  SHORT_ID_PREFIX,
  TOOL_ID,
} from "./idStrings";
import { checkIcon, deleteActionIcon, undoIcon, xIcon } from "./icons";

export function createRulerActions() {
  OBR.tool.createAction({
    id: getPluginId("clear-all"),
    icons: [
      {
        icon: deleteActionIcon,
        label: "Clear All Rulers",
        filter: {
          activeTools: [TOOL_ID],
          roles: ["GM"],
          metadata: [{ key: "measuring", value: false }],
        },
      },
    ],
    onClick: async () => {
      const items = await OBR.scene.items.getItems(
        (item) => item.layer === "RULER",
      );
      const deleteList: string[] = [];
      for (let item of items) {
        if (item.id.startsWith(SHORT_ID_PREFIX, 0)) deleteList.push(item.id);
      }
      OBR.scene.items.deleteItems(deleteList);
    },
  });

  OBR.tool.createAction({
    id: getPluginId("clear"),
    icons: [
      {
        icon: deleteActionIcon,
        label: "Clear My Ruler",
        filter: {
          activeTools: [TOOL_ID],
          roles: ["PLAYER"],
          metadata: [{ key: "measuring", value: false }],
        },
      },
    ],
    onClick: async () => {
      const items = await OBR.scene.items.getItems(
        (item) => item.layer === "RULER",
      );
      const deleteList: string[] = [];
      const playerId = await OBR.player.getId();
      //todo: should probably use metadata for this
      for (let item of items) {
        if (item.id === getItemId("line", playerId)) deleteList.push(item.id);
        if (item.id === getItemId("label", playerId)) deleteList.push(item.id);
        if (item.id === getItemId("end-point", playerId))
          deleteList.push(item.id);
        if (item.id === getItemId("background", playerId))
          deleteList.push(item.id);
      }
      OBR.scene.items.deleteItems(deleteList);
    },
  });

  OBR.tool.createAction({
    id: getPluginId("cancel"),
    icons: [
      {
        icon: xIcon,
        label: "Cancel (Escape)",
        filter: {
          activeTools: [TOOL_ID],
          metadata: [
            { key: "measuring", value: true },
            { key: "points", value: "ONE" },
          ],
        },
      },
    ],
    onClick: () =>
      OBR.broadcast.sendMessage(RULER_MESSAGE_CHANNEL, "CANCEL", {
        destination: "LOCAL",
      }),
  });

  OBR.tool.createAction({
    id: getPluginId("undo"),
    icons: [
      {
        icon: undoIcon,
        label: "Remove Segment (Backspace)",
        filter: {
          activeTools: [TOOL_ID],
          metadata: [
            { key: "measuring", value: true },
            { key: "points", value: "MULTIPLE" },
          ],
        },
      },
    ],
    onClick: () =>
      OBR.broadcast.sendMessage(RULER_MESSAGE_CHANNEL, "UNDO", {
        destination: "LOCAL",
      }),
  });

  OBR.tool.createAction({
    id: getPluginId("check"),
    icons: [
      {
        icon: checkIcon,
        label: "Confirm",
        filter: {
          activeTools: [TOOL_ID],
          metadata: [
            { key: "measuring", value: true },
            { key: "points", value: "MULTIPLE" },
          ],
        },
      },
    ],
    shortcut: "Enter",
    onClick: () =>
      OBR.broadcast.sendMessage(RULER_MESSAGE_CHANNEL, "CONFIRM", {
        destination: "LOCAL",
      }),
  });
}

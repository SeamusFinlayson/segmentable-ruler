import OBR, { isCurve } from "@owlbear-rodeo/sdk";
import {
  CONTEXT_MENU_ID,
  DRAG_MEASURE_MODE_ID,
  STORED_MEASUREMENT_METADATA_ID,
  TOOL_ID,
} from "./idStrings";
import { sendMessage } from "./sendMessage";
import { toolIcon } from "./icons";

export function createContextMenu() {
  OBR.contextMenu.create({
    id: CONTEXT_MENU_ID,
    icons: [
      {
        icon: toolIcon,
        label: "Continue Measurement",
        filter: {
          every: [
            {
              key: ["metadata", STORED_MEASUREMENT_METADATA_ID],
              operator: "!=",
              value: undefined,
            },
          ],
          max: 1,
          min: 1,
        },
      },
    ],
    onClick: (context) => {
      const target = context.items[0];
      if (!isCurve(target)) return;

      OBR.player.deselect();

      OBR.tool.activateTool(TOOL_ID);
      OBR.tool.activateMode(TOOL_ID, DRAG_MEASURE_MODE_ID);

      sendMessage({
        type: "RULER_DATA",
        points: target.points,
        position: target.position,
        creatingPlayerId: target.createdUserId,
        visible: target.visible,
        color: target.style.strokeColor,
      });
    },
  });
}

import OBR, { Math2, isCurve } from "@owlbear-rodeo/sdk";
import {
  CONTEXT_MENU_ID,
  DRAG_MEASURE_MODE_ID,
  CONTINUE_READY_METADATA_ID,
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
              key: ["metadata", CONTINUE_READY_METADATA_ID],
              value: true,
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

      const points = target.points.map((point) =>
        Math2.add(point, target.position),
      );

      sendMessage({
        type: "RULER_DATA",
        points: points,
        playerId: target.createdUserId,
        visible: target.visible,
        color: target.style.strokeColor,
      });
    },
  });
}

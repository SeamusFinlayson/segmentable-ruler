import OBR, {
  Vector2,
  isImage,
  isCurve,
  isShape,
  isLabel,
} from "@owlbear-rodeo/sdk";
import { privateRulerIcon } from "./icons";
import {
  snapPosition,
  calculateSegmentEndPosition,
  calculateDisplayDistance,
  getLabelPosition,
} from "./mathHelpers";
import {
  getItemId,
  PRIVATE_DRAG_MEASURE_MODE_ID,
  RULER_MESSAGE_CHANNEL,
  TOOL_ID,
} from "./idStrings";
import { Grid, Player, RulerIds } from "./types";
import { buildRuler } from "./rulerBuilder";
import { updateToolMetadata } from "./updateToolMetadata";

export function createPrivateDragMeasureMode(grid: Grid, player: Player) {
  let dragStarted = false;
  let interactionIsExpired = false;

  const rulerIds: RulerIds = {
    background: getItemId("background", player.id, true),
    line: getItemId("line", player.id, true),
    label: getItemId("label", player.id, true),
    endDot: getItemId("end-point", player.id, true),
  };

  // Set flags to reset interactions
  const expireAllInteractions = () => {
    // Only expire interactions if the user has started a new drag
    if (dragStarted) {
      interactionIsExpired = true;
    }
  };

  // Act on flags to reset interactions
  const stopExpiredInteractions = () => {
    if (interactionIsExpired) {
      OBR.scene.local.deleteItems(Object.values(rulerIds));

      dragStarted = false;
      interactionIsExpired = false;
    }
  };

  // State that doesn't require extra handling
  let rulerPoints: Vector2[] = []; // Points in the line being measured
  let pointerPosition: Vector2; // Track pointer position so it accessible to keyboard events
  let lastPosition: Vector2; // Memoize last position the token snapped to to prevent path measurement recalculation
  let lastLabelText: string = "";

  const addSegment = async (position?: Vector2) => {
    position ?? pointerPosition;
    rulerPoints.push(
      await calculateSegmentEndPosition(
        grid,
        rulerPoints[rulerPoints.length - 1],
        pointerPosition,
      ),
    );
    if (rulerPoints.length >= 2) updateToolMetadata({ points: "MULTIPLE" });
  };

  const removeSegment = async () => {
    if (rulerPoints.length <= 1) return;
    // Remove most recent segment
    rulerPoints.pop();
    // Refresh with segment removed
    pointerPosition = rulerPoints[rulerPoints.length - 1];
    await updateToolItems();
    updateToolItems(true);

    if (rulerPoints.length === 1) updateToolMetadata({ points: "ONE" });
  };

  const cleanupRuler = async () => {
    await updateToolItems();
    expireAllInteractions();
    stopExpiredInteractions();
    updateToolMetadata({ measuring: false, points: "NONE" });
  };

  OBR.broadcast.onMessage(RULER_MESSAGE_CHANNEL, async (event) => {
    if (!dragStarted) return;

    if (event.data === "CONFIRM") {
      cleanupRuler();
    } else if (event.data === "UNDO") {
      removeSegment();
    } else if (event.data === "CANCEL") {
      cleanupRuler();
    }
  });

  OBR.tool.createMode({
    id: PRIVATE_DRAG_MEASURE_MODE_ID,
    icons: [
      {
        icon: privateRulerIcon,
        label: "Private Ruler",
        filter: {
          activeTools: [TOOL_ID],
        },
      },
    ],
    cursors: [
      {
        cursor: "crosshair",
        filter: {
          metadata: [{ key: "measuring", value: true, operator: "==" }],
        },
      },
      { cursor: "move" },
    ],
    preventDrag: {
      target: [{ key: "locked", value: true }],
      metadata: [{ key: "measuring", value: false }],
    },
    onToolClick: async (_, event) => {
      if (!dragStarted) {
        pointerPosition = event.pointerPosition;
        dragStarted = true;

        const startPosition = await snapPosition(
          grid,
          event.target && isImage(event.target) && !event.target.locked
            ? event.target.position
            : pointerPosition,
        );
        rulerPoints = [];
        rulerPoints.push(startPosition);
        lastPosition = startPosition;

        OBR.scene.local.addItems(
          await buildRuler(
            rulerIds,
            grid,
            player,
            [startPosition, await snapPosition(grid, pointerPosition)],
            true,
            true,
          ),
        );

        // Because this function is asynchronous, interactions
        // may already be expired if the drag was short enough
        stopExpiredInteractions();
        updateToolMetadata({ measuring: true, points: "ONE" });
      } else {
        addSegment();
      }
    },
    onToolMove: (_, event) => {
      if (!dragStarted) return;
      pointerPosition = event.pointerPosition;
      updateToolItems();
    },
    onToolDragEnd: async () => {
      if (!dragStarted) return;
      addSegment();
    },
    onKeyDown: async (_, event) => {
      if (!dragStarted) return;

      if (event.key === "Delete") removeSegment();
      if (event.key === "Backspace") removeSegment();

      if (event.key === "Escape") cleanupRuler();
    },
    onToolDoubleClick: async () => {
      if (!dragStarted) return;
      cleanupRuler();
    },
    onDeactivate: () => {
      if (!dragStarted) return;
      cleanupRuler();
    },
  });

  async function updateToolItems(forceRecalculation = false) {
    const newPosition = await calculateSegmentEndPosition(
      grid,
      rulerPoints[rulerPoints.length - 1],
      pointerPosition,
    );

    let labelText: string | null = null;
    if (
      !(lastPosition.x === newPosition.x && newPosition.y === lastPosition.y) ||
      forceRecalculation
    ) {
      labelText =
        "Private\n" +
        (await calculateDisplayDistance(grid, [...rulerPoints, newPosition]));
    }
    if (!labelText) {
      labelText = lastLabelText;
    }
    lastLabelText = labelText;

    if (dragStarted) {
      OBR.scene.local.updateItems(
        Object.values(rulerIds),
        (items) => {
          items.forEach((item) => {
            if (item.id === rulerIds.line && isCurve(item)) {
              item.points = [...rulerPoints, newPosition];
            } else if (item.id === rulerIds.background && isCurve(item)) {
              item.points = [...rulerPoints, newPosition];
            } else if (item.id === rulerIds.endDot && isShape(item)) {
              item.position = newPosition;
            } else if (item.id === rulerIds.label && isLabel(item)) {
              item.position = getLabelPosition(grid, newPosition);
              item.text.plainText = labelText;
            }
          });
        },
        true,
      );
    }
    lastPosition = newPosition;
  }
}

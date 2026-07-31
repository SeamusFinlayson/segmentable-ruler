import OBR, {
  InteractionManager,
  Item,
  Vector2,
  isImage,
  isCurve,
  isShape,
  isLabel,
  ToolEvent,
} from "@owlbear-rodeo/sdk";
import { toolIcon } from "./icons";
import {
  snapPosition,
  calculateSegmentEndPosition,
  calculateDisplayDistance,
  getLabelPosition,
} from "./mathHelpers";
import { DRAG_MEASURE_MODE_ID, getItemId, TOOL_ID } from "./idStrings";
import { Grid, Player, RulerIds } from "./types";
import { buildRuler } from "./rulerBuilder";

type TimeStampedInteractionManager = {
  initTime: number;
  manager: InteractionManager<Item[]>;
};

export function createDragMeasureMode(grid: Grid, player: Player) {
  let interactions: TimeStampedInteractionManager[] = [];
  let currentRulerInitTime = 0;

  // State that doesn't require extra handling
  let initialInteractedItem: Item | null = null;
  let sharedAttachments: Item[] = [];
  let localAttachments: Item[] = [];
  let rulerPoints: Vector2[] = []; // Points in the line being measured
  let pointerPosition: Vector2; // Track pointer position so it accessible to keyboard events
  let lastPosition: Vector2; // Memoize last position the token snapped to to prevent path measurement recalculation

  const rulerIds: RulerIds = {
    background: getItemId("background", player.id),
    line: getItemId("line", player.id),
    label: getItemId("label", player.id),
    endDot: getItemId("end-point", player.id),
  };

  const endUnusedInteractions = () => {
    const newItemInteractions: TimeStampedInteractionManager[] = [];
    for (let i = 0; i < interactions.length; i++) {
      if (currentRulerInitTime !== interactions[i].initTime) {
        interactions[i].manager[1]();
      } else {
        newItemInteractions.push(interactions[i]);
      }
    }
    interactions = newItemInteractions;
  };

  const createRulerInteractions = async (event: ToolEvent) => {
    const interactionStartTime = Date.now();
    currentRulerInitTime = interactionStartTime;
    pointerPosition = event.pointerPosition;
    OBR.scene.items.deleteItems(Object.values(rulerIds));
    let interaction: InteractionManager<Item[]>;

    const token = event.target;
    if (token && isImage(token) && !token.locked) {
      initialInteractedItem = token;
      const startPosition = await snapPosition(grid, token.position);
      lastPosition = startPosition;
      rulerPoints = [];
      rulerPoints.push(startPosition);

      [interaction, sharedAttachments, localAttachments] = await Promise.all([
        OBR.interaction.startItemInteraction([
          ...(await buildRuler(
            rulerIds,
            grid,
            player,
            [startPosition, await snapPosition(grid, pointerPosition)],
            token.visible,
            true,
          )),
          token,
        ]),
        OBR.scene.items.getItemAttachments([token.id]),
        OBR.scene.local.getItemAttachments([token.id]),
      ]);
    } else {
      initialInteractedItem = null;
      const startPosition = await snapPosition(grid, pointerPosition);
      lastPosition = startPosition;
      rulerPoints = [];
      rulerPoints.push(startPosition);

      [interaction] = await Promise.all([
        OBR.interaction.startItemInteraction(
          await buildRuler(
            rulerIds,
            grid,
            player,
            [startPosition, pointerPosition],
            true,
            true,
          ),
        ),
      ]);
    }

    interactions.push({ manager: interaction, initTime: interactionStartTime });

    // Because this function is asynchronous and contains await statements, interactions
    // may already be expired if the drag was short enough in duration
    endUnusedInteractions();

    setTimeout(() => {
      recreateRulerInteractions(interactionStartTime);
    }, 700);
  };

  const recreateRulerInteractions = async (parentRulerInitTime: number) => {
    if (currentRulerInitTime === parentRulerInitTime) {
      const interactionStartTime = Date.now();
      currentRulerInitTime = interactionStartTime;
      let interactionManager: InteractionManager<Item[]> | null = null;
      rulerIds.label = getItemId("label", player.id) + Math.random();

      const endPointPosition = await calculateSegmentEndPosition(
        grid,
        rulerPoints[rulerPoints.length - 1],
        pointerPosition,
      );
      if (initialInteractedItem !== null) {
        const endPointItem = { ...initialInteractedItem };
        endPointItem.position = endPointPosition;
        [interactionManager, sharedAttachments, localAttachments] =
          await Promise.all([
            OBR.interaction.startItemInteraction([
              ...(await buildRuler(
                rulerIds,
                grid,
                player,
                [...rulerPoints, endPointPosition],
                endPointItem.visible,
                true,
              )),
              endPointItem,
            ]),
            OBR.scene.items.getItemAttachments([endPointItem.id]),
            OBR.scene.local.getItemAttachments([endPointItem.id]),
          ]);
      } else {
        [interactionManager] = await Promise.all([
          OBR.interaction.startItemInteraction(
            await buildRuler(
              rulerIds,
              grid,
              player,
              [...rulerPoints, endPointPosition],
              true,
              true,
            ),
          ),
        ]);
      }

      // TODO: interaction cleanup here
      endUnusedInteractions();

      interactions.push({
        initTime: interactionStartTime,
        manager: interactionManager,
      });

      // Call again after delay
      setTimeout(() => {
        recreateRulerInteractions(interactionStartTime);
      }, 700);
    } else {
      console.log("ended");
    }
    endUnusedInteractions();
  };

  OBR.tool.createMode({
    id: DRAG_MEASURE_MODE_ID,
    icons: [
      {
        icon: toolIcon,
        label: "Ruler",
        filter: {
          activeTools: [TOOL_ID],
        },
      },
    ],
    cursors: [
      {
        cursor: "grab",
        filter: {
          target: [
            { key: "locked", value: true, operator: "!=" },
            { key: "image", value: undefined, operator: "!=" },
          ],
        },
      },
      { cursor: "crosshair" },
    ],
    onToolDragStart: async (_, event) => {
      createRulerInteractions(event);
    },
    onToolDragMove: (_, event) => {
      pointerPosition = event.pointerPosition;
      updateToolItems();
      // OBR.player.deselect();
    },
    onKeyDown: async (_, event) => {
      if (interactions || true) {
        if (event.key === "z" || event.key === "Z") {
          // Add segment
          rulerPoints.push(
            await calculateSegmentEndPosition(
              grid,
              rulerPoints[rulerPoints.length - 1],
              pointerPosition,
            ),
          );
        }

        if (
          (event.key === "x" || event.key === "X") &&
          rulerPoints.length > 1
        ) {
          // Remove most recent segment
          rulerPoints.pop();
          // Refresh with segment removed
          updateToolItems(true);
        }

        if (event.key === "Enter") {
          // Run final update
          const items = await updateToolItems();
          await updateInteractionTargetItems(pointerPosition);

          // Add ruler to the scene
          const ruler: Item[] = [];
          for (let rulerId of Object.values(rulerIds)) {
            for (let item of items) {
              if (item.id === rulerId) {
                ruler.push(item);
                break;
              }
            }
          }
          OBR.scene.items.addItems(ruler);

          endUnusedInteractions();
        }
      }
    },
    onToolDragEnd: async (_, event) => {
      // Run final update
      const items = await updateToolItems();
      await updateInteractionTargetItems(event.pointerPosition);

      // Add ruler to the scene
      const ruler: Item[] = [];
      let addItemsToScene = true;
      for (let rulerId of Object.values(rulerIds)) {
        for (let item of items) {
          if (
            item.id === rulerIds.label &&
            isLabel(item) &&
            item.text.plainText.startsWith("0")
          ) {
            addItemsToScene = false;
          }
          if (item.id === rulerId) {
            ruler.push(item);
            break;
          }
        }
      }
      if (addItemsToScene) OBR.scene.items.addItems(ruler);

      currentRulerInitTime = 0;
      endUnusedInteractions();
    },
    onToolDragCancel: () => {
      // Fix bug where token is not locally displayed at its initial position on cancel
      const manager = interactions.find(
        (value) => value.initTime === currentRulerInitTime,
      )?.manager;

      if (manager) {
        manager[0]((items) => {
          items.forEach((item) => {
            if (initialInteractedItem && item.id === initialInteractedItem.id)
              item.position = initialInteractedItem.position;
          });
        });
      }

      currentRulerInitTime = 0;
      endUnusedInteractions();
    },
  });

  async function updateInteractionTargetItems(pointerPosition: Vector2) {
    if (interactions && initialInteractedItem) {
      const newPosition = await calculateSegmentEndPosition(
        grid,
        rulerPoints[rulerPoints.length - 1],
        pointerPosition,
      );

      const positionChange = {
        x: newPosition.x - initialInteractedItem.position.x,
        y: newPosition.y - initialInteractedItem.position.y,
      };

      // Update dragged item and shared attachments
      for (let i = 0; i < sharedAttachments.length; i++) {
        sharedAttachments[i].position.x += positionChange.x;
        sharedAttachments[i].position.y += positionChange.y;
      }
      OBR.scene.items.addItems(sharedAttachments);

      // Update local attachments
      for (let i = 0; i < localAttachments.length; i++) {
        localAttachments[i].position.x += positionChange.x;
        localAttachments[i].position.y += positionChange.y;
      }
      OBR.scene.local.addItems(localAttachments);
    }
  }

  async function updateToolItems(forceRecalculation = false): Promise<Item[]> {
    const newPosition = await calculateSegmentEndPosition(
      grid,
      rulerPoints[rulerPoints.length - 1],
      pointerPosition,
    );

    let newText: string | null = null;
    if (
      !(lastPosition.x === newPosition.x && newPosition.y === lastPosition.y) ||
      forceRecalculation
    ) {
      newText = await calculateDisplayDistance(grid, [
        ...rulerPoints,
        newPosition,
      ]);
    }
    lastPosition = newPosition;

    let items: Item[] = [];
    const manager = interactions.find(
      (value) => value.initTime === currentRulerInitTime,
    )?.manager;
    if (manager) {
      items = manager[0]((items) => {
        items.forEach((item) => {
          if (initialInteractedItem && item.id === initialInteractedItem.id) {
            item.position = newPosition;
          } else if (item.id === rulerIds.line && isCurve(item)) {
            item.points = [...rulerPoints, newPosition];
          } else if (item.id === rulerIds.background && isCurve(item)) {
            item.points = [...rulerPoints, newPosition];
          } else if (item.id === rulerIds.endDot && isShape(item)) {
            item.position = newPosition;
          } else if (item.id.includes(rulerIds.label) && isLabel(item)) {
            item.position = getLabelPosition(grid, newPosition);
            if (newText) item.text.plainText = newText;
          }
        });
      });
    }

    return items;
  }
}

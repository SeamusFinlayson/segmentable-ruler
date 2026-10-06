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
import { sharedRulerIcon } from "./icons";
import {
  snapPosition,
  calculateSegmentEndPosition,
  calculateDisplayDistance,
  getLabelPosition,
} from "./mathHelpers";
import {
  DRAG_MEASURE_MODE_ID,
  getItemId,
  getPluginId,
  RULER_MESSAGE_CHANNEL,
  STORED_MEASUREMENT_METADATA_ID,
  TOOL_ID,
} from "./idStrings";
import { Grid } from "./types/Grid";
import { Player } from "./types/Player";
import { RulerIds } from "./types/RulerIds";
import { buildRuler } from "./rulerBuilder";
import { updateToolMetadata } from "./updateToolMetadata";
import { MessageZod } from "./types/Message";
import { clearRulerItems } from "./clearRulerItems";
import { RulerData } from "./types/RulerData";

type TimeStampedInteractionManager = {
  initTime: number;
  manager: InteractionManager<Item[]>;
};

export function createSharedRulerMode(grid: Grid, player: Player) {
  let interactions: TimeStampedInteractionManager[] = [];
  let currentRulerInitTime = 0;

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

  // State that doesn't require extra handling
  let initialInteractedItem: Item | null = null;
  let restorableRulerData: RulerData | null = null;
  let sharedAttachments: Item[] = [];
  let localAttachments: Item[] = [];

  // let ctrlKeyPressed = false;
  let rulerPoints: Vector2[] = []; // Points in the line being measured
  let pointerPosition: Vector2 = { x: 0, y: 0 }; // Track pointer position so it accessible to keyboard events
  let lastPosition: Vector2 = { x: 0, y: 0 }; // Memoize last position the token snapped to to prevent path measurement recalculation
  let rulerVisible = true;

  let ctrlKeyPressed = false;
  const checkSnapping = () =>
    grid.measurement !== "EUCLIDEAN" || ctrlKeyPressed;

  const rulerIds: RulerIds = {
    background: getItemId("background", player.id),
    line: getItemId("line", player.id),
    label: getItemId("label", player.id),
    endDot: getItemId("end-point", player.id),
  };

  const createRulerInteractions = async (event: ToolEvent) => {
    const interactionStartTime = Date.now();
    currentRulerInitTime = interactionStartTime;
    pointerPosition = event.pointerPosition;
    clearRulerItems({ scope: "PLAYER" });
    let interaction: InteractionManager<Item[]>;

    const [updateMount, updateCharacter] = await Promise.all([
      player.role === "GM" || OBR.player.hasPermission("MOUNT_UPDATE"),
      player.role === "GM" || OBR.player.hasPermission("CHARACTER_UPDATE"),
    ]);

    const token = event.target;
    const idsInUse = (await OBR.party.getPlayers())
      .map((player) => player.metadata?.[getPluginId("targetItem")])
      .filter((val) => typeof val === "string");

    const snap = checkSnapping();
    rulerVisible = true;

    if (
      token &&
      isImage(token) &&
      !idsInUse.includes(token.id) &&
      ((token.layer === "CHARACTER" && updateCharacter) ||
        (token.layer === "MOUNT" && updateMount)) &&
      !token.locked &&
      !event.altKey
    ) {
      initialInteractedItem = token;
      const startPosition = snap
        ? await snapPosition(grid, token.position)
        : token.position;
      lastPosition = startPosition;
      console.log("start poistion", startPosition);
      rulerPoints = [];
      rulerPoints.push(startPosition);
      rulerVisible = token.visible;

      [interaction, sharedAttachments, localAttachments] = await Promise.all([
        OBR.interaction.startItemInteraction([
          ...(await buildRuler(
            rulerIds,
            grid,
            player,
            [
              startPosition,
              await calculateSegmentEndPosition(
                grid,
                startPosition,
                pointerPosition,
                !snap,
              ),
            ],
            rulerVisible,
          )),
          token,
        ]),
        OBR.scene.items.getItemAttachments([token.id]),
        OBR.scene.local.getItemAttachments([token.id]),
        OBR.player.setMetadata({ [getPluginId("targetItem")]: token.id }),
      ]);
    } else {
      initialInteractedItem = null;
      const startPosition = snap
        ? await snapPosition(grid, pointerPosition)
        : pointerPosition;
      lastPosition = startPosition;
      rulerPoints = [];
      rulerPoints.push(startPosition);

      [interaction] = await Promise.all([
        OBR.interaction.startItemInteraction(
          await buildRuler(
            rulerIds,
            grid,
            player,
            [startPosition, startPosition],
            true,
          ),
        ),
      ]);
    }

    interactions.push({ manager: interaction, initTime: interactionStartTime });

    // Because this function is asynchronous and contains await statements, interactions
    // may already be expired if the drag was short enough in duration
    endUnusedInteractions();

    updateToolItems();

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
        rulerPoints[0],
        pointerPosition,
        !checkSnapping(),
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
    }
    endUnusedInteractions();
  };

  const addSegment = async (position?: Vector2) => {
    position ?? pointerPosition;
    rulerPoints.push(
      await calculateSegmentEndPosition(
        grid,
        rulerPoints[0],
        pointerPosition,
        !checkSnapping(),
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

  const addRulerToScene = (items: Item[]) => {
    for (let item of items) {
      if (
        item.id === rulerIds.label &&
        isLabel(item) &&
        item.text.plainText.startsWith("0")
      ) {
        return;
      }
      if (item.id === rulerIds.line) {
        item.metadata[STORED_MEASUREMENT_METADATA_ID] = {};
      }
    }

    OBR.scene.items.addItems(items);
  };

  const cleanupRuler = () => {
    currentRulerInitTime = 0;
    endUnusedInteractions();
    updateToolMetadata({ measuring: false, points: "NONE" });
    OBR.player.setMetadata({ [getPluginId("targetItem")]: undefined });
  };

  OBR.broadcast.onMessage(RULER_MESSAGE_CHANNEL, async (event) => {
    const data = MessageZod.parse(event.data);

    if (data.type === "RULER_DATA") {
      console.log(data);
      clearRulerItems({ scope: "PLAYER", playerId: data.creatingPlayerId });
      clearRulerItems({ scope: "PLAYER", playerId: player.id });
      rulerPoints = data.points;
      pointerPosition = data.points[data.points.length - 1];
      const time = Date.now();
      currentRulerInitTime = time;
      rulerVisible = data.visible;
      initialInteractedItem = null;
      restorableRulerData = data;
      updateToolMetadata({ measuring: true, points: "MULTIPLE" });
      recreateRulerInteractions(time);
    }

    if (interactions.length === 0) return;

    if (data.type === "CONFIRM") {
      const items = await buildRuler(
        rulerIds,
        grid,
        player,
        rulerPoints,
        rulerVisible,
      );
      await updateInteractionTargetItems(rulerPoints[rulerPoints.length - 1]);
      addRulerToScene(items);
      cleanupRuler();
    } else if (data.type === "UNDO") {
      removeSegment();
    } else if (data.type === "CANCEL") {
      await updateInteractionTargetItems(rulerPoints[0]);
      cleanupRuler();
    }
  });

  OBR.tool.createMode({
    id: DRAG_MEASURE_MODE_ID,
    icons: [
      {
        icon: sharedRulerIcon,
        label: "Public Ruler",
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
      {
        cursor: "pointer",
        filter: {
          target: [
            { key: "locked", value: true, operator: "!=" },
            { key: "image", value: undefined, operator: "!=" },
            { key: "layer", value: "CHARACTER" },
          ],
          metadata: [{ key: "ignoreClickTarget", value: true, operator: "!=" }],
          permissions: ["CHARACTER_UPDATE"],
        },
      },
      {
        cursor: "pointer",
        filter: {
          target: [
            { key: "locked", value: true, operator: "!=" },
            { key: "image", value: undefined, operator: "!=" },
            { key: "layer", value: "MOUNT" },
          ],
          metadata: [{ key: "ignoreClickTarget", value: true, operator: "!=" }],
          permissions: ["MOUNT_UPDATE"],
        },
      },
      { cursor: "move" },
    ],
    preventDrag: {
      target: [{ key: "locked", value: true }],
      metadata: [{ key: "measuring", value: false }],
    },
    onToolClick: async (_, event) => {
      if (interactions.length === 0) {
        createRulerInteractions(event);
        updateToolMetadata({ measuring: true, points: "ONE" });
      } else {
        addSegment(event.target?.position);
      }
    },
    onToolMove: (_, event) => {
      updateToolMetadata({ ignoreClickTarget: event.altKey });
      pointerPosition = event.pointerPosition;
      ctrlKeyPressed = event.ctrlKey;
      if (interactions.length === 0) return;
      updateToolItems();
    },
    onKeyDown: async (_, event) => {
      updateToolMetadata({ ignoreClickTarget: event.altKey });
      ctrlKeyPressed = event.ctrlKey;

      if (interactions.length === 0) return;

      if (event.key === "Delete") removeSegment();
      else if (event.key === "Backspace") removeSegment();
      else if (event.key === "Escape") {
        await updateInteractionTargetItems(rulerPoints[0], true);
        cleanupRuler();
      } else updateToolItems();
    },
    onKeyUp: async (_, event) => {
      updateToolMetadata({ ignoreClickTarget: event.altKey });
      ctrlKeyPressed = event.ctrlKey;
      if (interactions.length === 0) return;
      updateToolItems();
    },
    onToolDragEnd(_, event) {
      if (interactions.length === 0) return;
      addSegment(event.target?.position);
    },
    onToolDoubleClick: async (_, event) => {
      if (interactions.length === 0) return;
      // Run final update
      const items = await buildRuler(
        rulerIds,
        grid,
        player,
        rulerPoints,
        rulerVisible,
      );
      await updateInteractionTargetItems(event.pointerPosition);

      // Add ruler to the scene
      addRulerToScene(items);

      cleanupRuler();
    },
    onDeactivate: async () => {
      if (interactions.length === 0) return;
      await updateInteractionTargetItems(rulerPoints[0], true);
      cleanupRuler();
    },
  });

  async function updateInteractionTargetItems(
    position: Vector2,
    restore = false,
  ) {
    if (restore && restorableRulerData) {
      addRulerToScene(
        await buildRuler(
          rulerIds,
          grid,
          {
            id: restorableRulerData.creatingPlayerId,
            color: restorableRulerData.color,
          },
          restorableRulerData.points,
          restorableRulerData.visible,
        ),
      );
    }
    restorableRulerData = null;

    if (interactions && initialInteractedItem) {
      const newPosition = restore
        ? initialInteractedItem.position
        : await calculateSegmentEndPosition(
            grid,
            rulerPoints[0],
            position,
            !checkSnapping(),
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
      rulerPoints[0],
      pointerPosition,
      !checkSnapping(),
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

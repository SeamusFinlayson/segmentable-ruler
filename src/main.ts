import OBR from "@owlbear-rodeo/sdk";
import { createGrid } from "./types/Grid";
import { Grid } from "./types/Grid";
import { Player } from "./types/Player";
import { createRulerActions } from "./createRulerActions";
import { createSharedRulerMode } from "./createSharedRulerMode";
import { createSegmentableRulerTool } from "./createSegmentableRulerTool";
import { createPrivateDragMeasureMode } from "./createPrivateRulerMode";
import { createContextMenu } from "./createContextMenu";

OBR.onReady(async () => {
  printVersionToConsole();
  startWhenSceneIsReady();
});

async function printVersionToConsole() {
  fetch("/manifest.json")
    .then((response) => response.json())
    .then((json) =>
      console.log(json["name"] + " - version: " + json["version"]),
    );
}

async function startWhenSceneIsReady() {
  // Handle when the scene is either changed or made ready after extension load
  OBR.scene.onReadyChange(async (isReady) => {
    if (isReady) start();
  });

  // Check if the scene is already ready once the extension loads
  const isReady = await OBR.scene.isReady();
  if (isReady) start();
}

async function start() {
  createSegmentableRulerTool();
  createRulerActions();
  createContextMenu();

  const [
    gridDpi,
    gridType,
    gridMeasurement,
    gridScale,
    playerColor,
    playerRole,
  ] = await Promise.all([
    OBR.scene.grid.getDpi(),
    OBR.scene.grid.getType(),
    OBR.scene.grid.getMeasurement(),
    OBR.scene.grid.getScale(),
    OBR.player.getColor(),
    OBR.player.getRole(),
  ]);
  const grid = createGrid(gridDpi, gridType, gridMeasurement, gridScale);

  const player: Player = {
    id: OBR.player.id,
    color: playerColor,
    role: playerRole,
  };

  createSharedRulerMode(grid, player);
  createPrivateDragMeasureMode(grid, player);
  startCallbacks(grid, player);
}

// Keep passed objects up to date with the scene
async function startCallbacks(grid: Grid, player: Player) {
  let callbacksStarted = false;
  if (!callbacksStarted) {
    callbacksStarted = true;

    const unsubscribeFromGrid = OBR.scene.grid.onChange(async (newGrid) => {
      grid.update(
        newGrid.dpi,
        newGrid.type,
        newGrid.measurement,
        await OBR.scene.grid.getScale(),
      );
    });

    const unsubscribeFromPlayer = OBR.player.onChange(async (newPlayer) => {
      player.id = newPlayer.id;
      player.color = newPlayer.color;
      player.role = newPlayer.role;
    });

    // Unsubscribe listeners that rely on the scene if it stops being ready
    const unsubscribeFromScene = OBR.scene.onReadyChange((isReady) => {
      if (!isReady) {
        unsubscribeFromGrid();
        unsubscribeFromPlayer();
        unsubscribeFromScene();
        callbacksStarted = false;
      }
    });
  }
}

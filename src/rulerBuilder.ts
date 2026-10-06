import {
  Vector2,
  Item,
  buildCurve,
  buildLabel,
  buildShape,
} from "@owlbear-rodeo/sdk";
import { getLabelPosition, calculateDisplayDistance } from "./mathHelpers";
import { Grid } from "./types/Grid";
import { Player } from "./types/Player";
import { RulerIds } from "./types/RulerIds";
import parse from "color-parse";
import { CREATED_BY_METADATA_ID } from "./idStrings";

type Options = { endDot: boolean; position: Vector2 };

export async function buildRuler(
  rulerIds: RulerIds,
  grid: Grid,
  player: Omit<Player, "role">,
  points: Vector2[],
  visible: boolean,
  options?: Partial<Options>,
): Promise<Item[]> {
  const definedOptions = { endDot: true, position: { x: 0, y: 0 }, ...options };

  const rulerConstituentItems: any[] = [];

  rulerConstituentItems.push(
    buildCurve()
      .id(rulerIds.line)
      .position(definedOptions.position)
      // .attachedTo(rulerIds.label)
      .points(points)
      .strokeColor(player.color)
      .fillOpacity(0)
      .strokeWidth(grid.dpi / 15)
      .strokeDash([grid.dpi / 3, grid.dpi / 5])
      .tension(0)
      .visible(visible)
      .layer("RULER")
      .zIndex(10002)
      .metadata({ [CREATED_BY_METADATA_ID]: player.id })
      .build(),
  );

  rulerConstituentItems.push(
    buildLabel()
      .id(rulerIds.label)
      .position(definedOptions.position)
      .attachedTo(rulerIds.line)
      .position(getLabelPosition(grid, points[points.length - 1]))
      .plainText(await calculateDisplayDistance(grid, points))
      // .fontFamily("Times New Roman")
      .pointerHeight(0)
      .backgroundOpacity(1)
      .visible(visible)
      .layer("RULER")
      .zIndex(10004)
      .disableHit(true)
      .metadata({ [CREATED_BY_METADATA_ID]: player.id })
      .build(),
  );

  if (definedOptions.endDot) {
    rulerConstituentItems.push(
      buildShape()
        .id(rulerIds.endDot)
        .position(definedOptions.position)
        .attachedTo(rulerIds.line)
        .visible(visible)
        .layer("RULER")
        .position(points[points.length - 1])
        .shapeType("CIRCLE")
        .fillColor(player.color)
        .strokeColor("white")
        .strokeOpacity(0.03)
        .strokeWidth(grid.dpi / 120)
        .width(grid.dpi / 4)
        .height(grid.dpi / 4)
        .zIndex(10001)
        .disableHit(true)
        .metadata({ [CREATED_BY_METADATA_ID]: player.id })
        .build(),
    );
  }

  if (useBackground(player.color)) {
    rulerConstituentItems.push(
      buildCurve()
        .id(rulerIds.background)
        .position(definedOptions.position)
        .attachedTo(rulerIds.line)
        .points(points)
        .strokeColor("white")
        .strokeOpacity(0.2)
        .fillOpacity(0)
        .strokeWidth(grid.dpi / 8)
        .tension(0)
        .visible(visible)
        .layer("RULER")
        .zIndex(10000)
        .disableHit(true)
        .metadata({ [CREATED_BY_METADATA_ID]: player.id })
        .build(),
    );
  }

  return rulerConstituentItems;
}

const useBackground = (color: string): boolean => {
  const parsedColor = parse(color);
  if (parsedColor.space !== "rgb") return false;
  const colorMax = Math.max(...parsedColor.values);
  if (colorMax > 100) return false;
  return true;
};

import OBR, { Vector2 } from "@owlbear-rodeo/sdk";
import { Grid } from "./types/Grid";

export async function calculateDisplayDistance(
  grid: Grid,
  points: Vector2[],
): Promise<string> {
  let distance = 0;
  if (grid.type === "SQUARE") {
    if (grid.measurement === "CHEBYSHEV") {
      // called chessboard in ui
      for (let i = 1; i < points.length; i++) {
        distance += Math.max(
          Math.abs(points[i].x - points[i - 1].x),
          Math.abs(points[i].y - points[i - 1].y),
        );
      }
    } else if (grid.measurement === "ALTERNATING") {
      let diagonalsCount = 0;
      for (let i = 1; i < points.length; i++) {
        const vertical = Math.abs(
          Math.round((points[i].y - points[i - 1].y) / grid.dpi),
        );
        const horizontal = Math.abs(
          Math.round((points[i].x - points[i - 1].x) / grid.dpi),
        );
        const longEdge = Math.max(vertical, horizontal);
        const shortEdge = Math.min(vertical, horizontal);
        distance += longEdge;
        diagonalsCount += shortEdge;
      }
      distance += Math.floor(diagonalsCount * 0.5);
    } else if (grid.measurement === "EUCLIDEAN") {
      for (let i = 1; i < points.length; i++) {
        const vertical = Math.abs(Math.round(points[i].y - points[i - 1].y));
        const horizontal = Math.abs(Math.round(points[i].x - points[i - 1].x));
        distance += Math.sqrt(vertical ** 2 + horizontal ** 2);
      }
    } else {
      // grid.measurement is MANHATTAN
      for (let i = 1; i < points.length; i++) {
        const vertical = Math.abs(points[i].y - points[i - 1].y);
        const horizontal = Math.abs(points[i].x - points[i - 1].x);
        distance += vertical + horizontal;
      }
    }
    if (grid.measurement !== "ALTERNATING") distance = distance / grid.dpi;
  } else {
    const getDistances: Promise<number>[] = [];
    for (let i = 1; i < points.length; i++) {
      getDistances.push(
        new Promise((resolve) => {
          resolve(OBR.scene.grid.getDistance(points[i], points[i - 1]));
        }),
      );
    }
    const distances = await Promise.all(getDistances);
    distances.forEach((val) => (distance += val));
  }

  const scaledDistance = distance * grid.scale.parsed.multiplier;
  const fixed = scaledDistance.toFixed(grid.scale.parsed.digits);
  return `${fixed}${grid.scale.parsed.unit}`;
}

export async function calculateSegmentEndPosition(
  grid: Grid,
  startPosition: Vector2,
  pointerPosition: Vector2,
  disableSnapping = false,
): Promise<Vector2> {
  if (disableSnapping) return pointerPosition;
  if (grid.type === "SQUARE") {
    if (grid.measurement === "EUCLIDEAN")
      return snapPosition(grid, pointerPosition);
    return {
      x:
        startPosition.x +
        Math.round((pointerPosition.x - startPosition.x) / grid.dpi) * grid.dpi,
      y:
        startPosition.y +
        Math.round((pointerPosition.y - startPosition.y) / grid.dpi) * grid.dpi,
    };
  } else if (grid.type === "DIMETRIC" || grid.type === "ISOMETRIC") {
    return await OBR.scene.grid.snapPosition(pointerPosition, 0.45);
  } else {
    return await OBR.scene.grid.snapPosition(pointerPosition, 1);
  }
}

export async function snapPosition(
  grid: Grid,
  position: Vector2,
): Promise<Vector2> {
  if (grid.type === "SQUARE") {
    const nearestVertex = {
      x: Math.round(position.x / grid.dpi) * grid.dpi,
      y: Math.round(position.y / grid.dpi) * grid.dpi,
    };
    // Centers are offset from vertices by half a cell
    const halfGridDpi = grid.dpi * 0.5;
    const nearestCenter = {
      x:
        Math.round((position.x + halfGridDpi) / grid.dpi) * grid.dpi -
        halfGridDpi,
      y:
        Math.round((position.y + halfGridDpi) / grid.dpi) * grid.dpi -
        halfGridDpi,
    };
    return distance(position, nearestVertex) < distance(position, nearestCenter)
      ? nearestVertex
      : nearestCenter;
  } else if (grid.type === "DIMETRIC" || grid.type === "ISOMETRIC") {
    return await OBR.scene.grid.snapPosition(position, 0.45);
  } else {
    return await OBR.scene.grid.snapPosition(position, 1);
  }
}

function distance(point1: Vector2, point2: Vector2): number {
  return Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2);
}

export function getLabelPosition(
  grid: Grid,
  rulerEndPosition: Vector2,
): Vector2 {
  return {
    x: rulerEndPosition.x,
    y: rulerEndPosition.y - grid.dpi / 2,
  };
}

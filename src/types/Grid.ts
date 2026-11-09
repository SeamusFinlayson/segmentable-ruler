import { GridType, GridMeasurement, GridScale } from "@owlbear-rodeo/sdk";

export interface Grid {
  dpi: number;
  type: GridType;
  measurement: GridMeasurement;
  scale: GridScale;
  update: (
    dpi: number,
    type: GridType,
    measurement: GridMeasurement,
    scale: GridScale,
  ) => void;
}

export function createGrid(
  dpi: number,
  type: GridType,
  measurement: GridMeasurement,
  scale: GridScale,
): Grid {
  const grid: Grid = {
    dpi: dpi,
    type: type,
    measurement: measurement,
    scale: scale,
    update: (
      dpi: number,
      type: GridType,
      measurement: GridMeasurement,
      scale: GridScale,
    ) => {
      grid.dpi = dpi;
      grid.type = type;
      grid.measurement = measurement;
      grid.scale = scale;
    },
  };

  return grid;
}

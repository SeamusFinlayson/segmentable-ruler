import z from "zod";
import { PointsZod } from "./Points";

export const RulerDataZod = z.object({
  points: PointsZod,
  playerId: z.string(),
  visible: z.boolean(),
  color: z.string(),
});

export type RulerData = z.infer<typeof RulerDataZod>;

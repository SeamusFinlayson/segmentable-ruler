import z from "zod";

export const PointZod = z.object({
  x: z.number(),
  y: z.number(),
});
export const PointsZod = z.array(PointZod);

export type Point = z.infer<typeof PointZod>;
export type Points = z.infer<typeof PointsZod>;

import { z } from "zod";
import { RulerDataZod } from "./RulerData";

const confirmMessage = z.object({ type: z.literal("CONFIRM") });
const undoMessage = z.object({ type: z.literal("UNDO") });
const cancelMessage = z.object({ type: z.literal("CANCEL") });
const recreateMessage = z.object({
  type: z.literal("RULER_DATA"),
  ...RulerDataZod.shape,
});

export const MessageZod = z.union([
  confirmMessage,
  undoMessage,
  cancelMessage,
  recreateMessage,
]);

export type Message = z.infer<typeof MessageZod>;

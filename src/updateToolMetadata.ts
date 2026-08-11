import OBR from "@owlbear-rodeo/sdk";
import { TOOL_ID } from "./idStrings";
import { ToolMetadata } from "./toolMetadataType";

export function updateToolMetadata(toolMetadata: Partial<ToolMetadata>) {
  OBR.tool.setMetadata(TOOL_ID, toolMetadata);
}

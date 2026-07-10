import { Mastra } from "@mastra/core";
import { kopra } from "./agents/kopra";

export const mastra = new Mastra({
  agents: { kopra },
});

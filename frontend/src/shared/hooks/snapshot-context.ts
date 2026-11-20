import { createContext } from "react";
import type { SnapshotScope } from "../data/snapshot-scope";

export const SnapshotContext = createContext<{
  scope: SnapshotScope;
  termId?: string;
  savedTermId?: string;
}>({ scope: "full" });

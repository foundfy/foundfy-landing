import { findActivePropertyConnection } from "./db";
import type { GscPropertyConnectionRecord, ObserveOwnerRecord } from "./types";

export function isOwnerSearchConsoleConnection(
  connection: GscPropertyConnectionRecord | null,
  owner: Pick<ObserveOwnerRecord, "googleIdentityId">,
): connection is GscPropertyConnectionRecord {
  return Boolean(
    connection &&
      connection.status === "connected" &&
      connection.googleIdentityId === owner.googleIdentityId,
  );
}

export async function findOwnerSearchConsoleConnection(input: {
  websiteId: string;
  owner: Pick<ObserveOwnerRecord, "googleIdentityId">;
}): Promise<GscPropertyConnectionRecord | null> {
  const connection = await findActivePropertyConnection(input.websiteId);
  return isOwnerSearchConsoleConnection(connection, input.owner) ? connection : null;
}

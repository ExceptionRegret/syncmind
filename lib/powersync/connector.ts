import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/web";

export class BackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const url = process.env.NEXT_PUBLIC_POWERSYNC_URL;
    const token = process.env.NEXT_PUBLIC_POWERSYNC_TOKEN;

    if (!url || !token) {
      console.warn("PowerSync credentials not configured");
      return null;
    }

    return { endpoint: url, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const record = { ...op.opData, id: op.id };

        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: op.table,
            op: op.op,
            record,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.statusText}`);
        }
      }
      await transaction.complete();
    } catch (error) {
      console.error("Data upload error:", error);
      throw error;
    }
  }
}

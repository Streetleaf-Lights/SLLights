import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueueItem, QueueStorage } from "./queue";

const KEY = "streetleaf.installQueue.v1";

/**
 * The queue on the phone's own storage (AsyncStorage: survives closing the
 * app and restarting the phone; removed only by uninstalling). Installs
 * aren't secrets, and the keychain store is too small for a long queue.
 * A damaged entry is set aside rather than thrown away silently.
 */
export const asyncStorageQueue: QueueStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
    } catch {
      await AsyncStorage.setItem(`${KEY}.unreadable.${Date.now()}`, raw);
      return [];
    }
  },
  async save(items) {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },
};

class OfflineSyncService {
  initialize() {
    console.log('Offline sync service initialized');
  }

  forceSync() {
    console.log('Force sync triggered');
  }
}

export const offlineSyncService = new OfflineSyncService();
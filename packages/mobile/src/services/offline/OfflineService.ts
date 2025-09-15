import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import SQLite from 'react-native-sqlite-storage';

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'requisition' | 'approval' | 'delivery' | 'user_preference';
  data: any;
  timestamp: number;
  vesselId?: string;
  userId: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  conflictData?: any;
}

export interface SyncResult {
  success: boolean;
  syncedActions: number;
  failedActions: number;
  conflicts: OfflineAction[];
  errors: string[];
}

export interface ConflictResolution {
  actionId: string;
  resolution: 'local' | 'remote' | 'merge';
  mergedData?: any;
}

class OfflineService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isOnline = false;
  private syncInProgress = false;
  private readonly OFFLINE_ACTIONS_KEY = 'offline_actions';
  private readonly LAST_SYNC_KEY = 'last_sync_timestamp';
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private syncTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize offline service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize SQLite database
      await this.initializeDatabase();
      
      // Setup network monitoring
      this.setupNetworkMonitoring();
      
      // Start sync timer
      this.startSyncTimer();
      
      console.log('Offline service initialized');
    } catch (error) {
      console.error('Error initializing offline service:', error);
    }
  }

  /**
   * Initialize SQLite database for offline storage
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = SQLite.openDatabase(
        {
          name: 'flowmarine_offline.db',
          location: 'default',
        },
        () => {
          console.log('Database opened successfully');
          this.createTables().then(resolve).catch(reject);
        },
        (error) => {
          console.error('Error opening database:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      `CREATE TABLE IF NOT EXISTS offline_actions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        entity TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        vessel_id TEXT,
        user_id TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        status TEXT DEFAULT 'pending',
        conflict_data TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS offline_requisitions (
        id TEXT PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
    ];

    for (const table of tables) {
      await this.executeSQL(table);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_actions_status ON offline_actions(status)',
      'CREATE INDEX IF NOT EXISTS idx_actions_timestamp ON offline_actions(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_actions_user ON offline_actions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_requisitions_vessel ON offline_requisitions(vessel_id)',
    ];

    for (const index of indexes) {
      await this.executeSQL(index);
    }
  }

  /**
   * Execute SQL query
   */
  private executeSQL(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.executeSql(
        sql,
        params,
        (result) => resolve(result),
        (error) => reject(error)
      );
    });
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true;
      
      console.log('Network state changed:', {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      // If we just came online, trigger sync
      if (!wasOnline && this.isOnline) {
        this.syncOfflineActions();
      }
    });
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncOfflineActions();
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Add offline action
   */
  async addOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const offlineAction: OfflineAction = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    try {
      // Store in SQLite
      await this.executeSQL(
        `INSERT INTO offline_actions (
          id, type, entity, data, timestamp, vessel_id, user_id, 
          retry_count, max_retries, status, conflict_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          offlineAction.id,
          offlineAction.type,
          offlineAction.entity,
          JSON.stringify(offlineAction.data),
          offlineAction.timestamp,
          offlineAction.vesselId || null,
          offlineAction.userId,
          offlineAction.retryCount,
          offlineAction.maxRetries,
          offlineAction.status,
          offlineAction.conflictData ? JSON.stringify(offlineAction.conflictData) : null,
        ]
      );

      // If online, try to sync immediately
      if (this.isOnline) {
        this.syncOfflineActions();
      }

      return offlineAction.id;
    } catch (error) {
      console.error('Error adding offline action:', error);
      throw error;
    }
  }

  /**
   * Get pending offline actions
   */
  async getPendingActions(): Promise<OfflineAction[]> {
    try {
      const result = await this.executeSQL(
        `SELECT * FROM offline_actions 
         WHERE status IN ('pending', 'failed') 
         ORDER BY timestamp ASC`
      );

      return result[0].rows.raw().map((row: any) => ({
        id: row.id,
        type: row.type,
        entity: row.entity,
        data: JSON.parse(row.data),
        timestamp: row.timestamp,
        vesselId: row.vessel_id,
        userId: row.user_id,
        retryCount: row.retry_count,
        maxRetries: row.max_retries,
        status: row.status,
        conflictData: row.conflict_data ? JSON.parse(row.conflict_data) : undefined,
      }));
    } catch (error) {
      console.error('Error getting pending actions:', error);
      return [];
    }
  }

  /**
   * Sync offline actions with server
   */
  async syncOfflineActions(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return {
        success: false,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: ['Sync already in progress or offline'],
      };
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      success: true,
      syncedActions: 0,
      failedActions: 0,
      conflicts: [],
      errors: [],
    };

    try {
      const pendingActions = await this.getPendingActions();
      console.log(`Syncing ${pendingActions.length} offline actions`);

      for (const action of pendingActions) {
        try {
          // Update action status to syncing
          await this.updateActionStatus(action.id, 'syncing');

          // Attempt to sync action
          const syncResult = await this.syncSingleAction(action);

          if (syncResult.success) {
            await this.updateActionStatus(action.id, 'synced');
            result.syncedActions++;
          } else if (syncResult.conflict) {
            await this.updateActionStatus(action.id, 'conflict', syncResult.conflictData);
            result.conflicts.push({
              ...action,
              status: 'conflict',
              conflictData: syncResult.conflictData,
            });
          } else {
            // Increment retry count
            const newRetryCount = action.retryCount + 1;
            if (newRetryCount >= action.maxRetries) {
              await this.updateActionStatus(action.id, 'failed');
              result.failedActions++;
              result.errors.push(`Action ${action.id} failed after ${action.maxRetries} retries`);
            } else {
              await this.updateActionRetryCount(action.id, newRetryCount);
            }
          }
        } catch (error) {
          console.error(`Error syncing action ${action.id}:`, error);
          result.errors.push(`Action ${action.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.failedActions++;
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp();

    } catch (error) {
      console.error('Error during sync:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Sync single action with server
   */
  private async syncSingleAction(action: OfflineAction): Promise<{
    success: boolean;
    conflict?: boolean;
    conflictData?: any;
  }> {
    try {
      // TODO: Implement actual API calls based on action type and entity
      console.log(`Syncing action: ${action.type} ${action.entity}`, action.data);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));

      // For now, simulate success
      return {success: true};
    } catch (error) {
      console.error('Error syncing single action:', error);
      return {success: false};
    }
  }

  /**
   * Update action status
   */
  private async updateActionStatus(
    actionId: string, 
    status: OfflineAction['status'], 
    conflictData?: any
  ): Promise<void> {
    await this.executeSQL(
      `UPDATE offline_actions 
       SET status = ?, conflict_data = ? 
       WHERE id = ?`,
      [status, conflictData ? JSON.stringify(conflictData) : null, actionId]
    );
  }

  /**
   * Update action retry count
   */
  private async updateActionRetryCount(actionId: string, retryCount: number): Promise<void> {
    await this.executeSQL(
      `UPDATE offline_actions 
       SET retry_count = ?, status = 'pending' 
       WHERE id = ?`,
      [retryCount, actionId]
    );
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(resolution: ConflictResolution): Promise<boolean> {
    try {
      const action = await this.getActionById(resolution.actionId);
      if (!action || action.status !== 'conflict') {
        return false;
      }

      let finalData = action.data;

      switch (resolution.resolution) {
        case 'local':
          // Keep local data
          break;
        case 'remote':
          // Use remote data
          finalData = action.conflictData;
          break;
        case 'merge':
          // Use merged data
          finalData = resolution.mergedData || action.data;
          break;
      }

      // Update action with resolved data and reset status
      await this.executeSQL(
        `UPDATE offline_actions 
         SET data = ?, status = 'pending', conflict_data = NULL, retry_count = 0 
         WHERE id = ?`,
        [JSON.stringify(finalData), resolution.actionId]
      );

      // Trigger sync
      if (this.isOnline) {
        this.syncOfflineActions();
      }

      return true;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return false;
    }
  }

  /**
   * Get action by ID
   */
  private async getActionById(actionId: string): Promise<OfflineAction | null> {
    try {
      const result = await this.executeSQL(
        'SELECT * FROM offline_actions WHERE id = ?',
        [actionId]
      );

      const rows = result[0].rows.raw();
      if (rows.length === 0) return null;

      const row = rows[0];
      return {
        id: row.id,
        type: row.type,
        entity: row.entity,
        data: JSON.parse(row.data),
        timestamp: row.timestamp,
        vesselId: row.vessel_id,
        userId: row.user_id,
        retryCount: row.retry_count,
        maxRetries: row.max_retries,
        status: row.status,
        conflictData: row.conflict_data ? JSON.parse(row.conflict_data) : undefined,
      };
    } catch (error) {
      console.error('Error getting action by ID:', error);
      return null;
    }
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTimestamp(): Promise<void> {
    const timestamp = Date.now().toString();
    await this.executeSQL(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) 
       VALUES (?, ?, ?)`,
      [this.LAST_SYNC_KEY, timestamp, Date.now()]
    );
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(): Promise<number | null> {
    try {
      const result = await this.executeSQL(
        'SELECT value FROM sync_metadata WHERE key = ?',
        [this.LAST_SYNC_KEY]
      );

      const rows = result[0].rows.raw();
      if (rows.length === 0) return null;

      return parseInt(rows[0].value, 10);
    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Get network status
   */
  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  /**
   * Force sync
   */
  async forceSync(): Promise<SyncResult> {
    return this.syncOfflineActions();
  }

  /**
   * Clear synced actions (cleanup)
   */
  async clearSyncedActions(olderThanDays: number = 7): Promise<void> {
    const cutoffTimestamp = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    await this.executeSQL(
      `DELETE FROM offline_actions 
       WHERE status = 'synced' AND timestamp < ?`,
      [cutoffTimestamp]
    );
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    pending: number;
    synced: number;
    failed: number;
    conflicts: number;
    lastSync: number | null;
  }> {
    try {
      const [pendingResult, syncedResult, failedResult, conflictResult] = await Promise.all([
        this.executeSQL("SELECT COUNT(*) as count FROM offline_actions WHERE status = 'pending'"),
        this.executeSQL("SELECT COUNT(*) as count FROM offline_actions WHERE status = 'synced'"),
        this.executeSQL("SELECT COUNT(*) as count FROM offline_actions WHERE status = 'failed'"),
        this.executeSQL("SELECT COUNT(*) as count FROM offline_actions WHERE status = 'conflict'"),
      ]);

      const lastSync = await this.getLastSyncTimestamp();

      return {
        pending: pendingResult[0].rows.raw()[0].count,
        synced: syncedResult[0].rows.raw()[0].count,
        failed: failedResult[0].rows.raw()[0].count,
        conflicts: conflictResult[0].rows.raw()[0].count,
        lastSync,
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        pending: 0,
        synced: 0,
        failed: 0,
        conflicts: 0,
        lastSync: null,
      };
    }
  }

  /**
   * Cleanup and close database
   */
  async cleanup(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default new OfflineService();
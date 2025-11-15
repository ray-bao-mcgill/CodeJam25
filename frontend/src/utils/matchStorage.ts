/**
 * Match summary storage using localStorage
 * Stores match results as JSON - fast, no server queries
 */

export interface PlayerResult {
  final_score: number;
  rank: number;
  scores_by_category?: Record<string, number>;
  key_strengths?: string[];
  areas_for_improvement?: string[];
}

export interface MatchSummary {
  id: string;
  created_at: string;
  started_at?: string;
  completed_at: string;
  players: Array<{ id: string; name: string }>;
  results: Record<string, PlayerResult>;
  match_summary_text?: string;
  winner_id?: string;
  total_questions: number;
  duration_seconds?: number;
}

const STORAGE_KEY = 'match_summaries';
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB safety limit (browsers allow ~5-10MB)

class MatchStorage {
  /**
   * Get all stored match summaries
   */
  getAll(): MatchSummary[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading match summaries:', error);
      return [];
    }
  }

  /**
   * Save a match summary
   */
  save(summary: MatchSummary): boolean {
    try {
      const summaries = this.getAll();
      
      // Check if match already exists, update it
      const existingIndex = summaries.findIndex(m => m.id === summary.id);
      if (existingIndex >= 0) {
        summaries[existingIndex] = summary;
      } else {
        summaries.push(summary);
      }

      // Sort by completed_at (newest first)
      summaries.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      // Check storage size before saving
      const jsonString = JSON.stringify(summaries);
      const sizeInBytes = new Blob([jsonString]).size;

      if (sizeInBytes > MAX_STORAGE_SIZE) {
        console.warn('Storage limit approaching, removing oldest matches');
        // Remove oldest matches until under limit
        while (summaries.length > 0 && sizeInBytes > MAX_STORAGE_SIZE) {
          summaries.pop(); // Remove oldest
          const newJson = JSON.stringify(summaries);
          if (new Blob([newJson]).size <= MAX_STORAGE_SIZE) {
            break;
          }
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));
      return true;
    } catch (error) {
      console.error('Error saving match summary:', error);
      
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, removing oldest matches');
        this.clearOldest(10); // Remove 10 oldest
        return this.save(summary); // Retry
      }
      
      return false;
    }
  }

  /**
   * Get a specific match summary by ID
   */
  getById(matchId: string): MatchSummary | null {
    const summaries = this.getAll();
    return summaries.find(m => m.id === matchId) || null;
  }

  /**
   * Get match history for a specific player
   */
  getPlayerHistory(playerId: string, limit: number = 10): MatchSummary[] {
    const summaries = this.getAll();
    return summaries
      .filter(m => m.players.some(p => p.id === playerId))
      .slice(0, limit);
  }

  /**
   * Get storage size info
   */
  getStorageInfo(): { used: number; available: number; percentage: number } {
    try {
      const data = localStorage.getItem(STORAGE_KEY) || '';
      const used = new Blob([data]).size;
      const available = MAX_STORAGE_SIZE;
      const percentage = (used / available) * 100;
      
      return { used, available, percentage };
    } catch {
      return { used: 0, available: MAX_STORAGE_SIZE, percentage: 0 };
    }
  }

  /**
   * Clear oldest N matches
   */
  clearOldest(count: number): void {
    const summaries = this.getAll();
    summaries.splice(-count); // Remove last N (oldest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));
  }

  /**
   * Clear all match summaries
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Delete a specific match
   */
  delete(matchId: string): boolean {
    const summaries = this.getAll();
    const filtered = summaries.filter(m => m.id !== matchId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered.length < summaries.length;
  }
}

export const matchStorage = new MatchStorage();


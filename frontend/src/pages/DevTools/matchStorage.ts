/**
 * Match summary storage - Client-side cache layer
 * Syncs with Python backend database via API endpoints
 * 
 * Note: This is a client-side cache. The source of truth is the Python backend database.
 * Consider migrating all match storage operations to use the backend API directly.
 */

import { API_URL } from "../../config";

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

const STORAGE_KEY = 'match_summaries_cache';
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB safety limit (browsers allow ~5-10MB)
const DB_API = `${API_URL}/admin/db`;

class MatchStorage {
  /**
   * Get all stored match summaries from backend database
   */
  async getAll(): Promise<MatchSummary[]> {
    try {
      const res = await fetch(`${DB_API}/matches`);
      const data = await res.json();
      if (data.success && data.matches) {
        // Transform backend format to frontend format
        return data.matches.map((m: any) => ({
          id: m.match_id,
          created_at: m.created_at,
          started_at: m.started_at,
          completed_at: m.completed_at,
          players: m.players,
          results: m.results,
          match_summary_text: m.match_summary_text,
          winner_id: m.winner_id,
          total_questions: m.total_questions,
          duration_seconds: m.duration_seconds,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching match summaries:', error);
      // Fallback to localStorage cache if API fails
      return this.getCached();
    }
  }

  /**
   * Get cached data from localStorage (fallback)
   */
  private getCached(): MatchSummary[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading cached match summaries:', error);
      return [];
    }
  }

  /**
   * Save a match summary to backend database
   */
  async save(summary: MatchSummary): Promise<boolean> {
    try {
      // Transform to backend format
      const backendFormat = {
        match_id: summary.id,
        players: summary.players,
        results: summary.results,
        match_summary_text: summary.match_summary_text,
        winner_id: summary.winner_id,
        total_questions: summary.total_questions,
        duration_seconds: summary.duration_seconds,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
      };

      const res = await fetch(`${DB_API}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendFormat),
      });

      const data = await res.json();
      if (data.success) {
        // Also cache locally for offline access
        this.cacheLocally(summary);
        return true;
      } else {
        console.error('Failed to save match:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error saving match summary:', error);
      // Fallback to localStorage if API fails
      return this.saveLocally(summary);
    }
  }

  /**
   * Save to localStorage as fallback
   */
  private saveLocally(summary: MatchSummary): boolean {
    try {
      const summaries = this.getCached();
      
      const existingIndex = summaries.findIndex(m => m.id === summary.id);
      if (existingIndex >= 0) {
        summaries[existingIndex] = summary;
      } else {
        summaries.push(summary);
      }

      summaries.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      const jsonString = JSON.stringify(summaries);
      const sizeInBytes = new Blob([jsonString]).size;

      if (sizeInBytes > MAX_STORAGE_SIZE) {
        console.warn('Storage limit approaching, removing oldest matches');
        while (summaries.length > 0 && sizeInBytes > MAX_STORAGE_SIZE) {
          summaries.pop();
          const newJson = JSON.stringify(summaries);
          if (new Blob([newJson]).size <= MAX_STORAGE_SIZE) {
            break;
          }
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  /**
   * Cache locally without saving to backend
   */
  private cacheLocally(summary: MatchSummary): void {
    try {
      const summaries = this.getCached();
      const existingIndex = summaries.findIndex(m => m.id === summary.id);
      if (existingIndex >= 0) {
        summaries[existingIndex] = summary;
      } else {
        summaries.push(summary);
      }
      summaries.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));
    } catch (error) {
      // Silently fail for cache operations
    }
  }

  /**
   * Get a specific match summary by ID from backend
   */
  async getById(matchId: string): Promise<MatchSummary | null> {
    try {
      const res = await fetch(`${DB_API}/matches/${matchId}`);
      const data = await res.json();
      if (data.success && data.match) {
        const m = data.match;
        return {
          id: m.match_id,
          created_at: m.created_at,
          started_at: m.started_at,
          completed_at: m.completed_at,
          players: m.players,
          results: m.results,
          match_summary_text: m.match_summary_text,
          winner_id: m.winner_id,
          total_questions: m.total_questions,
          duration_seconds: m.duration_seconds,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching match:', error);
      // Fallback to cache
      const summaries = this.getCached();
      return summaries.find(m => m.id === matchId) || null;
    }
  }

  /**
   * Get match history for a specific player
   */
  async getPlayerHistory(playerId: string, limit: number = 10): Promise<MatchSummary[]> {
    const summaries = await this.getAll();
    return summaries
      .filter(m => m.players.some(p => p.id === playerId))
      .slice(0, limit);
  }

  /**
   * Get storage size info (localStorage cache only)
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
   * Clear oldest N matches from cache
   */
  clearOldest(count: number): void {
    const summaries = this.getCached();
    summaries.splice(-count);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summaries));
  }

  /**
   * Clear all match summaries from cache (does not affect backend)
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Delete a specific match from backend
   */
  async delete(matchId: string): Promise<boolean> {
    try {
      const res = await fetch(`${DB_API}/matches/${matchId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        // Also remove from cache
        const summaries = this.getCached();
        const filtered = summaries.filter(m => m.id !== matchId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting match:', error);
      // Fallback to local cache deletion
      const summaries = this.getCached();
      const filtered = summaries.filter(m => m.id !== matchId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return filtered.length < summaries.length;
    }
  }
}

export const matchStorage = new MatchStorage();


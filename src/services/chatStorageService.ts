import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

const CHAT_STORAGE_KEY = '@sharebite_chat_sessions';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string; // Stored as ISO string
  suggestions?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messages: ChatMessage[];
}

export const chatStorageService = {
  /**
   * Get all saved chat sessions, sorted by most recent
   */
  async getAllSessions(): Promise<ChatSession[]> {
    try {
      const data = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
      if (!data) return [];
      
      const sessions: ChatSession[] = JSON.parse(data);
      return sessions.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Failed to get chat sessions:', error);
      return [];
    }
  },

  /**
   * Save or update a chat session
   */
  async saveSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const index = sessions.findIndex(s => s.id === session.id);
      
      if (index !== -1) {
        sessions[index] = session;
      } else {
        sessions.push(session);
      }
      
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      logger.error('Failed to save chat session:', error);
      throw error;
    }
  },

  /**
   * Delete a specific chat session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(filteredSessions));
    } catch (error) {
      logger.error('Failed to delete chat session:', error);
      throw error;
    }
  },

  /**
   * Clear all chat history
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (error) {
      logger.error('Failed to clear chat history:', error);
      throw error;
    }
  }
};

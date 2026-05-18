import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local Data Storage Service
 * For storing chat messages and call logs locally on device
 */

const CHAT_STORAGE_KEY = '@sharebite_chats';
const CALL_LOGS_STORAGE_KEY = '@sharebite_call_logs';

// ==================== CHAT OPERATIONS ====================

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantType: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

// Get all conversations for a user
export const getConversations = async (
  userId: string
): Promise<Conversation[]> => {
  try {
    const chatsJson = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!chatsJson) return [];

    const allChats: ChatMessage[] = JSON.parse(chatsJson);
    const userChats = allChats.filter(
      chat => chat.senderId === userId || chat.receiverId === userId
    );

    // Group by conversation
    const conversationsMap = new Map<string, Conversation>();

    userChats.forEach(chat => {
      const otherUserId =
        chat.senderId === userId ? chat.receiverId : chat.senderId;
      const otherUserName =
        chat.senderId === userId ? chat.receiverName : chat.senderName;

      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, {
          id: chat.conversationId,
          participantId: otherUserId,
          participantName: otherUserName,
          participantType: 'user',
          lastMessage: chat.message,
          lastMessageTime: chat.timestamp,
          unreadCount: 0,
        });
      }

      const conversation = conversationsMap.get(otherUserId)!;
      if (new Date(chat.timestamp) > new Date(conversation.lastMessageTime)) {
        conversation.lastMessage = chat.message;
        conversation.lastMessageTime = chat.timestamp;
      }

      if (!chat.read && chat.receiverId === userId) {
        conversation.unreadCount++;
      }
    });

    return Array.from(conversationsMap.values()).sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime()
    );
  } catch (error) {
    console.error('Error getting conversations:', error);
    return [];
  }
};

// Get messages for a conversation
export const getMessages = async (
  conversationId: string
): Promise<ChatMessage[]> => {
  try {
    const chatsJson = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!chatsJson) return [];

    const allChats: ChatMessage[] = JSON.parse(chatsJson);
    return allChats
      .filter(chat => chat.conversationId === conversationId)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
};

// Send a message
export const sendMessage = async (
  message: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>
): Promise<{ success: boolean; message?: ChatMessage }> => {
  try {
    const chatsJson = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    const allChats: ChatMessage[] = chatsJson ? JSON.parse(chatsJson) : [];

    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    allChats.push(newMessage);
    await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(allChats));

    return { success: true, message: newMessage };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false };
  }
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  try {
    const chatsJson = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!chatsJson) return false;

    const allChats: ChatMessage[] = JSON.parse(chatsJson);
    const updatedChats = allChats.map(chat => {
      if (
        chat.conversationId === conversationId &&
        chat.receiverId === userId &&
        !chat.read
      ) {
        return { ...chat, read: true };
      }
      return chat;
    });

    await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(updatedChats));
    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return false;
  }
};

// ==================== CALL LOGS OPERATIONS ====================

export interface CallLog {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: number; // in seconds
  timestamp: string;
}

// Get call logs for a user
export const getCallLogs = async (userId: string): Promise<CallLog[]> => {
  try {
    const logsJson = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
    if (!logsJson) return [];

    const allLogs: CallLog[] = JSON.parse(logsJson);
    return allLogs
      .filter(log => log.callerId === userId || log.receiverId === userId)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  } catch (error) {
    console.error('Error getting call logs:', error);
    return [];
  }
};

// Add call log
export const addCallLog = async (
  log: Omit<CallLog, 'id' | 'timestamp'>
): Promise<{ success: boolean; log?: CallLog }> => {
  try {
    const logsJson = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
    const allLogs: CallLog[] = logsJson ? JSON.parse(logsJson) : [];

    const newLog: CallLog = {
      ...log,
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    allLogs.push(newLog);
    await AsyncStorage.setItem(CALL_LOGS_STORAGE_KEY, JSON.stringify(allLogs));

    return { success: true, log: newLog };
  } catch (error) {
    console.error('Error adding call log:', error);
    return { success: false };
  }
};

// Clear old call logs (older than 30 days)
export const clearOldCallLogs = async (): Promise<boolean> => {
  try {
    const logsJson = await AsyncStorage.getItem(CALL_LOGS_STORAGE_KEY);
    if (!logsJson) return true;

    const allLogs: CallLog[] = JSON.parse(logsJson);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = allLogs.filter(
      log => new Date(log.timestamp) > thirtyDaysAgo
    );

    await AsyncStorage.setItem(
      CALL_LOGS_STORAGE_KEY,
      JSON.stringify(recentLogs)
    );
    return true;
  } catch (error) {
    console.error('Error clearing old call logs:', error);
    return false;
  }
};

export default {
  // Chat
  getConversations,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  // Call logs
  getCallLogs,
  addCallLog,
  clearOldCallLogs,
};

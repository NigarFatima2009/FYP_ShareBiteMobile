import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '../theme';
import puterChatbot from '../services/puterChatbot';
import logger from '../utils/logger';
import { chatStorageService, ChatSession, ChatMessage } from '../services/chatStorageService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  suggestions?: string[];
}

interface AIChatbotProps {
  navigation: any;
  user: any;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ navigation, user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const quickQuestions = [
    'How do I donate food?',
    'What can I donate?',
    'Food safety tips',
    'Become a volunteer',
  ];

  // Load chat sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const savedSessions = await chatStorageService.getAllSessions();
    setSessions(savedSessions);
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    if (!isHistoryView) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isHistoryView]);

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setIsHistoryView(false);
    logger.info('Started new chat session');
  };

  const openSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setIsHistoryView(false);
    logger.info(`Opened chat session: ${session.id}`);
  };

  const deleteSession = async (sessionId: string) => {
    await chatStorageService.deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      startNewChat();
    }
    loadSessions();
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    // Determine session ID
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = `session_${Date.now()}`;
      setCurrentSessionId(sessionId);
    }

    try {
      logger.info('Sending message to Puter AI (GPT-5.2)...');

      const response = await puterChatbot.chat(
        messageText,
        user?.uid || user?.id || 'guest',
        sessionId
      );

      if (response) {
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: response.response,
          sender: 'bot',
          timestamp: new Date().toISOString(),
          suggestions: response.suggestions,
        };

        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);

        // Persist to local storage
        const session: ChatSession = {
          id: sessionId,
          title: updatedMessages[0].text.substring(0, 40) + (updatedMessages[0].text.length > 40 ? '...' : ''),
          lastMessage: botMessage.text,
          timestamp: new Date().toISOString(),
          messages: finalMessages,
        };

        await chatStorageService.saveSession(session);
        loadSessions(); // Refresh history list in background
        logger.info('Chat session saved locally');
      }
    } catch (error) {
      logger.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I\'m having trouble connecting. Please try again.',
        sender: 'bot',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryView = () => (
    <View style={styles.historyContainer}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Chat History</Text>
        <TouchableOpacity onPress={startNewChat} style={styles.newChatButton}>
          <Icon name="add" size={20} color={colors.white} />
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.warningBox}>
        <Icon name="information-circle-outline" size={20} color="#856404" />
        <Text style={styles.warningText}>
          Chats are stored locally. Clearing app data or uninstalling will remove your chat history.
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="chatbubble-ellipses-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No previous chats found</Text>
          <TouchableOpacity onPress={startNewChat} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Start your first conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.sessionList}>
          {sessions.map(session => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => openSession(session)}
            >
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionCardTitle} numberOfLines={1}>{session.title}</Text>
                <Text style={styles.sessionLastMsg} numberOfLines={1}>{session.lastMessage}</Text>
                <Text style={styles.sessionTime}>
                  {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteSession(session.id)}
                style={styles.deleteIconButton}
              >
                <Icon name="trash-outline" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderChatView = () => (
    <View style={{ flex: 1 }}>
      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <Icon name="chatbubbles" size={64} color={colors.primary} />
            <Text style={styles.welcomeText}>How can I help you today?</Text>
            <Text style={styles.welcomeSubtext}>Ask me anything about food donation, safety, or volunteering.</Text>
          </View>
        )}

        {messages.map(message => (
          <View key={message.id}>
            <View
              style={[
                styles.messageWrapper,
                message.sender === 'user' ? styles.userMessageWrapper : styles.botMessageWrapper,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.sender === 'user' ? styles.userMessage : styles.botMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.sender === 'user' ? styles.userMessageText : styles.botMessageText,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    message.sender === 'user' ? styles.userMessageTime : styles.botMessageTime,
                  ]}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>

            {/* Suggestion buttons for bot messages */}
            {message.sender === 'bot' && message.suggestions && message.suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {message.suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={() => sendMessage(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <Icon name="arrow-forward" size={14} color={colors.white} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        {loading && (
          <View style={styles.botMessageWrapper}>
            <View style={[styles.messageBubble, styles.botMessage, styles.typingBubble]}>
              <Icon name="chatbubbles" size={30} color={colors.primary} />
              <Text style={styles.typingText}>Typing...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickQuestionsContainer}
        >
          {quickQuestions.map((question, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => sendMessage(question)}
              style={styles.quickQuestionButton}
            >
              <Text style={styles.quickQuestionText}>{question}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            style={styles.input}
            onSubmitEditing={() => sendMessage()}
            multiline
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || loading}
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled,
            ]}
          >
            <Icon name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>ShareBite Agent</Text>
                <Text style={styles.headerSubtitle}>AI-Powered Assistant</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => setIsHistoryView(!isHistoryView)}
                  style={styles.headerActionButton}
                >
                  <Icon name={isHistoryView ? "chatbubble-ellipses" : "archive-outline"} size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={startNewChat}
                  style={styles.headerActionButton}
                >
                  <Icon name="add-circle-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {isHistoryView ? renderHistoryView() : renderChatView()}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 10,
    paddingHorizontal: 19,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700' as const,
    fontFamily: typography.fontFamily.bold,
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 30,
  },
  messagesContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  messageWrapper: {
    marginBottom: spacing.sm,
  },
  userMessageWrapper: {
    alignItems: 'flex-end',
  },
  botMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.sm,
    borderRadius: 16,
  },
  userMessage: {
    backgroundColor: colors.primary,
  },
  botMessage: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  botMessageTime: {
    color: '#999',
  },
  quickQuestionsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickQuestionButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
  },
  quickQuestionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: spacing.md,
    paddingBottom: spacing.lg,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    maxHeight: 100,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: typography.fontSize.sm,
    color: colors.secondary,
    marginLeft: 8,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  suggestionText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionButton: {
    padding: spacing.xs,
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    gap: 4,
  },
  newChatText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    fontFamily: typography.fontFamily.regular,
    lineHeight: 16,
  },
  sessionList: {
    padding: spacing.md,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionCardTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  sessionLastMsg: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 11,
    color: '#999',
  },
  deleteIconButton: {
    padding: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    color: '#999',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  welcomeText: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  welcomeSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});

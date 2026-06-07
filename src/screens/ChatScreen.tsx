import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { colors } from '../theme';

type Message = {
  id: string;
  text: string;
  timestamp: number;
  senderId: string;
  receiverId: string;
  senderName: string;
};

export default function ChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { contactId, contactName, contactImage } = route.params as any;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedContactImage, setFetchedContactImage] = useState<string | null>(contactImage);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth().currentUser;

  // Generate consistent conversation ID
  const getConversationId = () => {
    if (!currentUser?.uid || !contactId) return null;
    return [currentUser.uid, contactId].sort().join('_');
  };

  useEffect(() => {
    let unsubscribe: any;

    const setupListener = async () => {
      // Validate contactId
      if (!contactId) {
        setError('Contact information not available');
        setLoading(false);
        return;
      }

      if (!currentUser) {
        setError('Please sign in to chat');
        setLoading(false);
        return;
      }

      unsubscribe = await loadMessages();

      // Fetch contact profile image if not provided
      if (!contactImage && contactId) {
        try {
          const userDoc = await firestore().collection('users').doc(contactId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.profileImage) {
              setFetchedContactImage(userData.profileImage);
            }
          }
        } catch (e) {
          console.log('Error fetching contact image:', e);
        }
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [contactId, currentUser?.uid]);

  const loadMessages = async () => {
    try {
      const conversationId = getConversationId();

      if (!conversationId) {
        setError('Unable to load conversation');
        setLoading(false);
        return;
      }

      // Check if conversation exists FIRST to avoid security rule errors
      const convDoc = await firestore().collection('conversations').doc(conversationId).get();

      if (!convDoc.exists) {
        // Conversation hasn't been started yet. This is normal.
        // Don't show error, just stop loading and show empty state.
        setMessages([]);
        setLoading(false);
        return null;
      }

      // Set up real-time listener for messages
      const unsubscribe = firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(
          (snapshot) => {
            const messagesList: Message[] = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                text: data.message || data.text || '',
                timestamp: data.timestamp?.toMillis?.() || Date.now(),
                senderId: data.senderId,
                receiverId: data.receiverId,
                senderName: data.senderName,
              };
            });
            setMessages(messagesList);
            setLoading(false);
            setError(null);

            // Scroll to end when messages update
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          },
          (err) => {
            console.log('Chat listener error:', err);
            if (err.message.includes('permission-denied')) {
              setError('Database permission denied. Please ensure you are logged in and have permission to chat.');
            } else {
              setMessages([]);
            }
            setLoading(false);
          }
        );

      return unsubscribe;
    } catch (err) {
      console.log('Load messages error:', err);
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser || !contactId) return;

    const conversationId = getConversationId();
    if (!conversationId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to send message. Contact not found.',
      });
      return;
    }

    setSending(true);
    try {
      const messageData = {
        message: inputText.trim(),
        text: inputText.trim(), // Add both for compatibility
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        receiverId: contactId,
        receiverName: contactName || 'User',
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false,
      };

      // 1. Create/Update conversation metadata FIRST
      // This ensures the parent document exists for security rules 
      // which check conversation.participants before allowing messages
      await firestore()
        .collection('conversations')
        .doc(conversationId)
        .set({
          participants: [currentUser.uid, contactId],
          participantNames: {
            [currentUser.uid]: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            [contactId]: contactName || 'User',
          },
          lastMessage: inputText.trim(),
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastMessageSender: currentUser.uid,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

      // 2. Add message to Firestore subcollection
      await firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add(messageData);

      // 3. Send notification to recipient
      try {
        await firestore().collection('notifications').add({
          userId: contactId,
          title: 'New Message',
          message: `${currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone'} sent you a message`,
          type: 'message',
          read: false,
          createdAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          senderId: currentUser.uid,
          senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          fromUserId: currentUser.uid,
          fromUserName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          conversationId: conversationId,
          contactId: currentUser.uid,
        });
      } catch (notifError) {
        // Silent fail for notification
      }

      setInputText('');

      Toast.show({
        type: 'success',
        text1: 'Message sent',
        visibilityTime: 1500,
      });
    } catch (err) {
      console.log('Send message error:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message. Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCall = () => {
    // Navigate to call screen or directly make call
    const params = route.params as any;
    if (params?.contactPhone) {
      Linking.openURL(`tel:${params.contactPhone}`);
    } else {
      // Try to get phone from Firestore
      firestore()
        .collection('users')
        .doc(contactId)
        .get()
        .then(doc => {
          const phone = doc.data()?.phone;
          if (phone) {
            Linking.openURL(`tel:${phone}`);
          } else {
            Toast.show({
              type: 'error',
              text1: 'No Phone Number',
              text2: 'Contact phone number not available',
            });
          }
        })
        .catch(() => {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Could not get contact info',
          });
        });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === currentUser?.uid;

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.theirMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.theirMessageText
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.timeText,
            isMyMessage ? styles.myTimeText : styles.theirTimeText
          ]}>
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  // Render header component
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        {fetchedContactImage ? (
          <Image source={{ uri: fetchedContactImage }} style={styles.headerImage} />
        ) : (
          <View style={styles.headerImagePlaceholder}>
            <Icon name="person" size={20} color="#fff" />
          </View>
        )}
        <Text style={styles.headerTitle}>{contactName || 'Chat'}</Text>
      </View>

      <TouchableOpacity onPress={handleCall}>
        <Icon name="call" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  if (error) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              loadMessages();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {renderHeader()}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chatbubble-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} disabled={sending}>
          <Icon name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          editable={!sending}
        />

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="send" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  headerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ring,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: colors.secondary,
  },
  theirTimeText: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});

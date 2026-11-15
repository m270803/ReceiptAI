import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestApi } from '../utils/api';

const QUICK_PROMPTS = [
  'How do I scan a receipt?',
  'Why is my spending high this month?',
  'Give me a budget plan.',
  'How do I add an expense?',
  'Explain the Insights screen.',
  'How can I increase my savings?',
];

export default function AskAssistantScreen() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'bot',
      text: 'Hi! I’m your assistant. Ask me anything about budgets, savings, your expenses, or how to use ReceiptAI!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatId] = useState(
    () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  const sendMessage = async (forcedText) => {
    const finalText = (forcedText || input).trim();
    if (!finalText || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: finalText,
    };

    setMessages((previous) => [...previous, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const conversation = [
        ...messages.map((message) => ({
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.text,
        })),
        { role: 'user', content: finalText },
      ].slice(-20);
      const { reply } = await requestApi('/api/assistant/chat', {
        chatId,
        messages: conversation,
      });

      setMessages((previous) => [
        ...previous,
        { id: `${Date.now()}-reply`, sender: 'bot', text: reply },
      ]);
    } catch (error) {
      console.error('Assistant API error:', error);
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-error`,
          sender: 'bot',
          text: error.message || 'Something went wrong. Try again later.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => (
    <>
      <View
        style={[
          styles.messageBubble,
          item.sender === 'user' ? styles.userBubble : styles.botBubble,
        ]}
      >
        <Text style={styles.messageText}>{item.text}</Text>
      </View>

      {index === 0 && (
        <View style={styles.quickPromptContainer}>
          {QUICK_PROMPTS.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.quickPromptButton}
              onPress={() => sendMessage(prompt)}
              disabled={loading}
            >
              <Text style={styles.quickPromptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.heading}>Ask Assistant</Text>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.chatContainer}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={input}
          onChangeText={setInput}
          editable={!loading}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={() => sendMessage()} disabled={loading}>
          <Ionicons name="send" size={24} color="#1c2b48" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f6f8fa',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1c2b48',
    marginTop: 14,
    marginBottom: 14,
  },
  quickPromptContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    marginTop: -4,
  },
  quickPromptButton: {
    backgroundColor: '#e8f0ff',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  quickPromptText: {
    fontSize: 14,
    color: '#1c2b48',
    fontWeight: '600',
  },
  chatContainer: {
    flexGrow: 1,
    paddingVertical: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    maxWidth: '75%',
  },
  userBubble: {
    backgroundColor: '#d1e3ff',
    alignSelf: 'flex-end',
  },
  botBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    color: '#1c2b48',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#cbd5e1',
    paddingTop: 10,
    marginTop: 10,
    marginBottom: 50,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
    marginRight: 10,
    fontSize: 15,
  },
});

/**
 * AI Chatbot Service for React Native
 * Uses reliable Puter.js AI SDK for dynamic reasoning and knowledge.
 */
import puter from '@heyputer/puter.js';
import logger from '../utils/logger';

interface PuterChatResponse {
  response: string;
  intent: string;
  confidence: number;
  suggestions?: string[];
}

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class PuterChatbotService {
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();
  private readonly SYSTEM_PROMPT = `You are ShareBite Assistant, an AI helper for the ShareBite food donation app. 
You help users with general knowledge, math, science, and the app features:
- Food donation process
- NGO coordination
- Volunteer delivery
- Food safety guidelines
- Answer ANY general knowledge, math or logic question correctly.

Always be helpful, friendly, and accurate. Make sure to respond clearly. If the user asks 2+2, answer 4.
Provide responses formatted as JSON matching this schema exactly:
{
  "response": "Your well-formatted Markdown answer string to the user",
  "intent": "general, math, donate_food, track_delivery, or find_ngo",
  "confidence": 0.95,
  "suggestions": ["3 short suggested follow-up questions for the user"]
}`;

  async chat(
    message: string,
    userId: string = 'anonymous',
    sessionId?: string
  ): Promise<PuterChatResponse> {
    const conversationKey = sessionId || userId;

    if (!this.conversationHistory.has(conversationKey)) {
      this.conversationHistory.set(conversationKey, [
        { role: 'system', content: this.SYSTEM_PROMPT }
      ]);
    }

    const history = this.conversationHistory.get(conversationKey)!;
    history.push({ role: 'user', content: message });

    try {
      logger.info('Calling Pollinations AI Chat API...');
      
      const responseObj = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(h => ({ role: h.role, content: h.content })),
          jsonMode: true
        })
      });

      if (!responseObj.ok) {
          throw new Error('Chat API returned 403 or server error');
      }
      
      let content = await responseObj.text();
      
      let parsedResponse;
      if (typeof content === 'object' && content !== null && 'response' in content) {
          parsedResponse = content;
      } else {
          let contentString = content as string;
          if (typeof contentString === 'string') {
              contentString = contentString.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
          }

          try {
              parsedResponse = JSON.parse(contentString);
          } catch (e) {
              // If it fails to parse, it might be raw text. Try extracting JSON using regex
              const jsonMatch = contentString.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                  try {
                      parsedResponse = JSON.parse(jsonMatch[0]);
                  } catch (e2) {
                      parsedResponse = { response: contentString, intent: 'general', confidence: 0.5 };
                  }
              } else {
                  // Not JSON at all, so just use it as a plain string answer!
                  parsedResponse = { response: contentString, intent: 'general', confidence: 0.5 };
              }
          }
      }
      
      history.push({ role: 'assistant', content: parsedResponse.response });

      return {
        response: parsedResponse.response || content,
        intent: parsedResponse.intent || 'general',
        confidence: parsedResponse.confidence || 0.9,
        suggestions: parsedResponse.suggestions || ['Tell me more'],
      };

    } catch (error) {
      logger.error('Puter.js Chat failed:', error);
      
      // Basic fallback if JSON parsing fails or network is down
      return {
        response: "I'm currently having a little trouble connecting to my central servers. Could you repeat that?",
        intent: 'general',
        confidence: 0.1,
        suggestions: ['Retry'],
      };
    }
  }

  clearHistory(userId: string, sessionId?: string): void {
    const conversationKey = sessionId || userId;
    this.conversationHistory.delete(conversationKey);
  }
}

export default new PuterChatbotService();

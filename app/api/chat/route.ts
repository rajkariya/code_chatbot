import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';

// Initialize OpenAI with error handling
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Initialize Gemini with error handling
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

const SYSTEM_PROMPTS = {
  chatgpt: `You are an expert coding assistant with deep knowledge in software development. You can:
1. Help with code-related questions and debugging
2. Generate code examples with detailed explanations
3. Explain programming concepts and best practices
4. Assist with software architecture and design patterns
5. Guide through development workflows and tools

Format all code using markdown code blocks with appropriate language tags.
Keep responses focused on programming and development topics only.`,

  gemini: `You are a specialized AI coding assistant focused on practical software development. Your expertise includes:
1. Writing efficient and maintainable code
2. Debugging complex issues
3. Implementing modern development practices
4. Explaining technical concepts clearly
5. Providing actionable solutions

Always include code examples when relevant, using markdown formatting.
Stay focused on technical and development-related topics only.`
};

// Add context window size limit
const MAX_CONTEXT_MESSAGES = 6;

// Helper to truncate conversation history
function truncateMessages(messages: any[]) {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages;
  return [
    messages[0], // Keep system prompt
    { role: "system", content: "... Earlier conversation history ..." },
    ...messages.slice(-MAX_CONTEXT_MESSAGES)
  ];
}

export async function POST(req: NextRequest) {
  const { message, model, conversationHistory = [] } = await req.json();

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'Message is required' }),
      { status: 400 }
    );
  }

  try {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    if (model === 'chatgpt') {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
      }

      const messages = truncateMessages([
        { role: "system", content: SYSTEM_PROMPTS.chatgpt },
        ...conversationHistory,
        { role: "user", content: message }
      ]);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        stream: true,
      });

      (async () => {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          await writer.write(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Streaming Error:', error);
        } finally {
          await writer.close();
        }
      })();

    } else if (model === 'gemini') {
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error('Google API key is not configured');
      }

      const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      try {
        // Format history for Gemini
        const formattedHistory = conversationHistory
          .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
          .join('\n\n');

        const prompt = `${SYSTEM_PROMPTS.gemini}\n\nConversation history:\n${formattedHistory}\n\nUser question: ${message}`;
        
        const result = await geminiModel.generateContent(prompt);
        
        if (!result) {
          throw new Error('Failed to generate content');
        }

        const response = await result.response;
        const text = response.text();

        // Improved chunking that preserves markdown structure
        const chunks = text.split(/(?<=\n\n|\n```|\n\||\.\s|\?\s|\!\s)/).filter(Boolean);
        
        (async () => {
          try {
            for (const chunk of chunks) {
              await new Promise(resolve => setTimeout(resolve, 75));
              await writer.write(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            }
            await writer.write(encoder.encode('data: [DONE]\n\n'));
          } catch (error) {
            console.error('Streaming Error:', error);
          } finally {
            await writer.close();
          }
        })();

      } catch (error) {
        console.error('Gemini Error:', error);
        throw error;
      }
    } else {
      throw new Error('Invalid model specified');
    }

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { status: 500 }
    );
  }
}
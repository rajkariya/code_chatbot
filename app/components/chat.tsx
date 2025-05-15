"use client"

import { useState, useRef, useEffect } from "react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import { ModelType } from "../types/chat"

// Add these suggested topics
const INITIAL_SUGGESTIONS = [
  {
    id: '1',
    text: 'How to implement authentication in Next.js?',
    category: 'Next.js'
  },
  {
    id: '2',
    text: 'Explain React Server Components',
    category: 'React'
  },
  {
    id: '3',
    text: 'Best practices for API route handling',
    category: 'Backend'
  },
  {
    id: '4',
    text: 'How to optimize React performance?',
    category: 'Performance'
  }
];

const POPULAR_TOPICS = [
  {
    id: '1',
    text: 'How to build a REST API in Node.js?',
    category: 'Backend',
    icon: '🚀'
  },
  {
    id: '2',
    text: 'Explain React hooks and their use cases',
    category: 'React',
    icon: '⚛️'
  },
  {
    id: '3',
    text: 'Best practices for Next.js performance optimization',
    category: 'Next.js',
    icon: '⚡'
  },
  {
    id: '4',
    text: 'How to implement authentication in a web app?',
    category: 'Security',
    icon: '🔒'
  },
  {
    id: '5',
    text: 'Compare different state management solutions',
    category: 'Architecture',
    icon: '🏗️'
  },
  {
    id: '6',
    text: 'Database design best practices',
    category: 'Database',
    icon: '💾'
  }
];

function RecommendationChip({ text, category, onClick }: { text: string; category: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:border-transparent"
    >
      <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-white transition-colors">
        {text}
      </span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
        {category}
      </span>
    </button>
  );
}

function TopicCard({ topic, onClick }: { topic: typeof POPULAR_TOPICS[0], onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="group relative p-4 text-left rounded-xl bg-white dark:bg-gray-800 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:border-transparent shadow-sm hover:shadow-lg"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{topic.icon}</span>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-white mb-1">
            {topic.text}
          </h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 group-hover:bg-white/20 group-hover:text-white transition-colors">
            {topic.category}
          </span>
        </div>
        <span className="text-gray-400 group-hover:text-white transition-colors">
          →
        </span>
      </div>
    </motion.button>
  );
}

export function Chat() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; id: string }>>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<ModelType>("chatgpt")
  const { theme, setTheme } = useTheme()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollTimeout = useRef<NodeJS.Timeout>()
  const isAutoScrollEnabled = useRef(true)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [suggestions, setSuggestions] = useState(POPULAR_TOPICS)
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (!isAutoScrollEnabled.current) return;
    
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, 100);
  }

  // Handle manual scroll
  const handleScroll = () => {
    if (!mainContentRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = mainContentRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAutoScrollEnabled.current = isAtBottom;
  }

  useEffect(() => {
    scrollToBottom();
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    }
  }, [messages]);

  // Add scroll event listener
  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll);
      return () => mainContent.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleQuestionSelect = async (question: string) => {
    if (isLoading || !question.trim()) return;
    
    setIsLoading(true);
    setError(null);

    const messageId = Date.now().toString();
    const newMessage = { 
      role: 'user', 
      content: question,
      id: messageId 
    };
    setMessages(prev => [...prev, newMessage]);
    setCurrentMessageId(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          model,
          conversationHistory: messages.map(({ role, content }) => ({ role, content }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMessageId = Date.now().toString();
      setCurrentMessageId(assistantMessageId);
      setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantMessageId }]);
      
      let accumulatedContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(5);
              if (data === '[DONE]') continue;

              try {
                const { content } = JSON.parse(data);
                accumulatedContent += content;
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error reading stream:', error);
        throw error;
      } finally {
        reader.releaseLock();
      }

      // Generate new suggestions based on the complete response
      setSuggestions(generateSuggestions(accumulatedContent));
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${errorMessage}`, 
        id: Date.now().toString() 
      }]);
    } finally {
      setIsLoading(false);
      setCurrentMessageId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !input.trim()) return;
    
    const question = input;
    setInput("");
    await handleQuestionSelect(question);
  };

  const handleModelChange = (newModel: ModelType) => {
    setModel(newModel)
    setError(null)
    setMessages([]) // Clear chat history when switching models
  }

  const getErrorMessage = (error: any): string => {
    if (error?.message?.includes("API key")) {
      return "API key is invalid or missing. Please check your configuration."
    }
    if (error?.message?.includes("quota")) {
      return "API quota exceeded. Please try again later or upgrade your plan."
    }
    if (error?.message?.includes("rate limit")) {
      return "Too many requests. Please wait a moment and try again."
    }
    return error?.message || "An unexpected error occurred. Please try again."
  }

  // Function to generate new suggestions based on the last message
  const generateSuggestions = (lastMessage: string) => {
    const topics = {
      'react': [
        { text: 'How to use React hooks effectively?', category: 'React', icon: '⚛️' },
        { text: 'Explain React component lifecycle', category: 'React', icon: '⚛️' },
        { text: 'Best practices for state management', category: 'React', icon: '⚛️' }
      ],
      'next': [
        { text: 'How to implement SSR in Next.js?', category: 'Next.js', icon: '⚡' },
        { text: 'Explain Next.js routing system', category: 'Next.js', icon: '⚡' },
        { text: 'Next.js deployment strategies', category: 'Next.js', icon: '⚡' }
      ],
      'api': [
        { text: 'How to handle API authentication?', category: 'Backend', icon: '🔒' },
        { text: 'Best practices for RESTful APIs', category: 'Backend', icon: '🚀' },
        { text: 'Implementing API rate limiting', category: 'Backend', icon: '⚡' }
      ],
      'database': [
        { text: 'Compare SQL vs NoSQL databases', category: 'Database', icon: '💾' },
        { text: 'Database optimization techniques', category: 'Performance', icon: '⚡' },
        { text: 'How to implement database caching?', category: 'Database', icon: '💾' }
      ],
      'performance': [
        { text: 'How to optimize website loading speed?', category: 'Performance', icon: '🚀' },
        { text: 'Implementing code splitting', category: 'Performance', icon: '⚡' },
        { text: 'Browser rendering optimization', category: 'Performance', icon: '⚡' }
      ]
    };

    const lastMessageLower = lastMessage.toLowerCase();
    let newSuggestions = [];

    for (const [key, suggestions] of Object.entries(topics)) {
      if (lastMessageLower.includes(key)) {
        newSuggestions.push(...suggestions);
      }
    }

    if (newSuggestions.length === 0) {
      newSuggestions = POPULAR_TOPICS;
    }

    return newSuggestions
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((suggestion, index) => ({
        ...suggestion,
        id: Date.now().toString() + index
      }));
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 border-b dark:border-gray-700">
        <div className="w-[80%] max-w-7xl mx-auto">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI Code Assistant
              </h1>
              <div className="hidden md:flex items-center space-x-3 bg-white/50 dark:bg-gray-800/50 rounded-lg p-1.5 backdrop-blur-sm">
                <ModelSelector model={model} onModelChange={handleModelChange} />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-lg bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <SunIcon className="w-5 h-5 text-blue-600" />
                ) : (
                  <MoonIcon className="w-5 h-5 text-purple-600" />
                )}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2.5 rounded-lg bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20"
                aria-label="Toggle menu"
              >
                <MenuIcon className="w-5 h-5 text-blue-600 dark:text-purple-400" />
              </button>
            </div>
          </div>
          {/* Mobile menu with gradient background */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden border-t dark:border-gray-700 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-lg"
              >
                <div className="p-4">
                  <div className="flex items-center justify-center space-x-3">
                    <ModelSelector model={model} onModelChange={handleModelChange} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main 
        ref={mainContentRef}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent scroll-smooth"
      >
        <div className="w-[80%] max-w-7xl mx-auto py-6">
          <div className="space-y-6">
            {messages.length === 0 ? (
              <div className="w-full max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center p-8 rounded-lg bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-lg"
                >
                  <div className="max-w-3xl mx-auto">
                    <div className="text-5xl mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      👨‍💻
                    </div>
                    <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Welcome to AI Code Assistant!
                    </h2>
                    <p className="mb-8 text-gray-600 dark:text-gray-300">
                      Get instant answers to your coding questions. Choose a topic to get started:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {POPULAR_TOPICS.map((topic) => (
                        <TopicCard
                          key={topic.id}
                          topic={topic}
                          onClick={() => handleQuestionSelect(topic.text)}
                        />
                      ))}
                    </div>

                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                      <span>Powered by</span>
                      <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                        {model === "chatgpt" ? "ChatGPT" : "Gemini"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`rounded-lg px-6 py-3 max-w-[85%] ${
                        message.role === "assistant"
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-lg"
                          : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      }`}
                    >
                      <div className="prose dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                          components={{
                            pre: PreBlock,
                            code: CodeBlock,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {message.id === currentMessageId && (
                          <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
                onAnimationComplete={() => scrollToBottom('smooth')}
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg px-6 py-3 shadow-lg">
                  <LoadingDots />
                </div>
              </motion.div>
            )}

            {error && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center"
                onAnimationComplete={() => scrollToBottom('smooth')}
              >
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg px-6 py-3 text-sm border border-red-200 dark:border-red-800">
                  {error}
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-px" />
          </div>
        </div>
      </main>

      {/* Add recommendations section before footer */}
      {messages.length > 0 && !isLoading && (
        <div className="w-[80%] max-w-7xl mx-auto py-4 border-t dark:border-gray-700">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Recommended Questions
            </h3>
            <div className="flex flex-wrap gap-3">
              {suggestions.map((suggestion) => (
                <RecommendationChip
                  key={suggestion.id}
                  text={suggestion.text}
                  category={suggestion.category}
                  onClick={() => {
                    setInput(suggestion.text);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="sticky bottom-0 border-t dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
        <div className="w-[80%] max-w-7xl mx-auto py-4">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask a coding question using ${model}...`}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 text-white font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </form>
        </div>
      </footer>
    </div>
  )
}

function ModelSelector({ model, onModelChange }: { model: ModelType; onModelChange: (model: ModelType) => void }) {
  return (
    <>
      <button
        onClick={() => onModelChange("chatgpt")}
        className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
          model === "chatgpt"
            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        ChatGPT
      </button>
      <button
        onClick={() => onModelChange("gemini")}
        className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
          model === "gemini"
            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        Gemini
      </button>
    </>
  )
}

function PreBlock(props: any) {
  return (
    <div className="relative group">
      <pre className="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-x-auto">
        {props.children}
      </pre>
      <button
        onClick={() => {
          const codeElement = props.children as React.ReactElement
          const code = codeElement?.props?.children || ""
          navigator.clipboard.writeText(typeof code === 'string' ? code : '')
        }}
        className="absolute top-2 right-2 p-1 rounded bg-gray-800 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <CopyIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function CodeBlock(props: any) {
  const { className } = props
  const isInline = !className?.includes('language-')
  return isInline ? (
    <code className="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5">
      {props.children}
    </code>
  ) : (
    <code {...props} />
  )
}

function LoadingDots() {
  return (
    <div className="flex space-x-1.5">
      <motion.div
        className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
        animate={{ y: ["0%", "-50%", "0%"] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
        animate={{ y: ["0%", "-50%", "0%"] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
        animate={{ y: ["0%", "-50%", "0%"] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
      />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  )
} 
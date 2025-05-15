export type Message = {
  id: string
  content: string
  role: 'user' | 'assistant'
  createdAt: Date
  model: 'chatgpt' | 'gemini'
}

export type ModelType = "chatgpt" | "gemini";

export type ChatState = {
  messages: Message[]
  isLoading: boolean
  error: string | null
  model: ModelType
} 
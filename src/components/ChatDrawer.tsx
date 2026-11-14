import { Send, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AIError, quickPrompts, recipeChat, type ChatMessage } from '../services/aiService'
import type { Recipe } from '../types/recipe'
import { RichText } from './ui'

export default function ChatDrawer({
  recipe,
  servings,
  onClose,
  stepNumber,
}: {
  recipe: Recipe
  servings: number
  onClose: () => void
  /** Khi mở từ chế độ nấu: bước người dùng đang làm. */
  stepNumber?: number
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      abortRef.current?.abort()
    }
  }, [onClose])

  const ask = async (question: string) => {
    const content = question.trim()
    if (!content || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setDraft('')
    setError(null)
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      let answer = ''
      for await (const chunk of recipeChat(recipe, servings, history, controller.signal, stepNumber)) {
        if (controller.signal.aborted) break
        answer += chunk
        setMessages([...history, { role: 'assistant', content: answer }])
      }
      if (!answer) setMessages(history)
    } catch (err) {
      if (!controller.signal.aborted) {
        setMessages(history)
        setError(err instanceof AIError ? err.message : 'Có lỗi khi hỏi AI. Hãy thử lại.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <section
        role="dialog"
        aria-label="Hỏi BepAI về món này"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise flex max-h-[85dvh] w-full max-w-3xl flex-col rounded-t-3xl bg-cream shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-chili text-white">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight font-bold">Hỏi BepAI</h2>
            <p className="truncate text-xs text-ink/60">
              Về món {recipe.title} · {servings} người{stepNumber ? ` · đang ở bước ${stepNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-paper"
          >
            <X size={20} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-ink/70">Chạm một câu hỏi gợi ý hoặc tự gõ bên dưới:</p>
              {(stepNumber
                ? [
                    `Bước ${stepNumber} làm sao biết đã đạt?`,
                    'Tôi lỡ làm quá lửa / quá mặn, chữa thế nào?',
                    'Thiếu dụng cụ cho bước này thì dùng gì thay?',
                    ...quickPrompts(recipe).slice(0, 1),
                  ]
                : quickPrompts(recipe)
              ).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void ask(prompt)}
                  className="block w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.99]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <div key={index} className="ml-10 w-fit max-w-full justify-self-end rounded-2xl rounded-br-md bg-chili px-4 py-2.5 text-sm font-medium text-white ms-auto">
                {message.content}
              </div>
            ) : (
              <div key={index} className="mr-6 rounded-2xl rounded-bl-md border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed">
                {message.content ? <RichText text={message.content} /> : <span className="text-ink/50">BepAI đang nghĩ…</span>}
              </div>
            ),
          )}
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void ask(draft)
          }}
          className="flex gap-2 border-t border-line px-4 pt-3 pb-safe"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Hỏi về nguyên liệu, cách làm…"
            aria-label="Câu hỏi của bạn"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-chili"
          />
          {busy ? (
            <button
              type="button"
              aria-label="Dừng trả lời"
              onClick={() => abortRef.current?.abort()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Gửi"
              disabled={!draft.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-chili text-white disabled:opacity-40"
            >
              <Send size={20} />
            </button>
          )}
        </form>
      </section>
    </div>
  )
}

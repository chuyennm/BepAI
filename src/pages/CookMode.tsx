import { BellRing, ChevronLeft, ChevronRight, Mic, MicOff, PartyPopper, Sparkles, Sun, Timer, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ChatDrawer from '../components/ChatDrawer'
import { navigate } from '../hooks/useHashRoute'
import { speak, speechSupported, stopSpeaking, useVoiceCommands, voiceSupported, type VoiceCommand } from '../hooks/useVoice'
import { useWakeLock } from '../hooks/useWakeLock'
import { useProfile } from '../lib/household'
import { useRecipe } from '../lib/recipes'
import { formatAmount, scaleIngredient } from '../lib/scaling'
import { useStored } from '../lib/storage'
import { formatClock, splitInstruction } from '../lib/timeParse'

interface KitchenTimer {
  id: number
  label: string
  total: number
  endsAt: number
  done: boolean
}

/** Ba tiếng bíp bằng Web Audio — không cần file âm thanh nên chạy được offline. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    const start = ctx.currentTime + i * 0.45
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
    osc.start(start)
    osc.stop(start + 0.4)
  }
}

export default function CookMode({ id }: { id: string }) {
  const recipe = useRecipe(id)
  const [profile] = useProfile()
  const [servingsMap] = useStored<Record<string, number>>('servings', {})
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [showIngredients, setShowIngredients] = useState(false)
  const [timers, setTimers] = useState<KitchenTimer[]>([])
  const [now, setNow] = useState(Date.now())
  const audioRef = useRef<AudioContext | null>(null)
  const nextTimerId = useRef(1)

  const wakeLocked = useWakeLock(true)
  const stepCount = recipe?.steps.length ?? 0
  const step = recipe?.steps[Math.min(index, stepCount - 1)]

  const go = useCallback(
    (delta: number) => {
      setFinished(false)
      setIndex((i) => {
        const next = i + delta
        if (next >= stepCount) {
          setFinished(true)
          return i
        }
        return Math.max(next, 0)
      })
    },
    [stepCount],
  )

  const readStep = useCallback(() => {
    if (step) speak(`Bước ${step.stepNumber}. ${step.instruction}${step.tip ? ` Mẹo: ${step.tip}` : ''}`)
  }, [step])

  const { listening, error: voiceError } = useVoiceCommands(voiceOn, (command: VoiceCommand) => {
    if (command === 'next') go(1)
    else if (command === 'back') go(-1)
    else readStep()
  })

  // Bật giọng nói thì tự đọc mỗi khi sang bước mới.
  useEffect(() => {
    if (voiceOn && !finished) readStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, voiceOn])
  useEffect(() => stopSpeaking, [])

  // Đồng hồ: tính theo mốc kết thúc nên không lệch khi tab bị tạm dừng.
  useEffect(() => {
    if (!timers.some((t) => !t.done)) return
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(tick)
  }, [timers])

  useEffect(() => {
    const due = timers.filter((t) => !t.done && t.endsAt <= now)
    if (!due.length) return
    setTimers((list) => list.map((t) => (due.some((d) => d.id === t.id) ? { ...t, done: true } : t)))
    beep(audioRef.current)
    navigator.vibrate?.([400, 150, 400, 150, 400])
    if (voiceOn) speak(`Hết giờ: ${due[0].label}`)
  }, [now, timers, voiceOn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (chatOpen) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, chatOpen])

  if (!recipe || !step) {
    navigate('/')
    return null
  }

  const servings = servingsMap[id] ?? profile.familySize ?? recipe.baseServings
  const factor = servings / recipe.baseServings

  const startTimer = (seconds: number, label: string) => {
    // Tạo AudioContext ngay trong thao tác chạm để trình duyệt cho phép phát tiếng sau này.
    audioRef.current ??= new AudioContext()
    void audioRef.current.resume()
    setNow(Date.now())
    setTimers((list) => [
      ...list,
      { id: nextTimerId.current++, label, total: seconds, endsAt: Date.now() + seconds * 1000, done: false },
    ])
  }

  const exit = () => navigate(`/r/${recipe.id}`)

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-cream">
      {/* Thanh trên */}
      <header className="flex items-center gap-2 px-3 pt-safe pb-2">
        <button type="button" aria-label="Thoát chế độ nấu" onClick={exit} className="flex h-12 w-12 items-center justify-center rounded-full bg-paper shadow-sm">
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight font-bold">{recipe.title}</p>
          <p className="flex items-center gap-1 text-xs text-ink/60">
            {servings} người
            {wakeLocked && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-herb">
                · <Sun size={12} /> màn hình luôn sáng
              </span>
            )}
          </p>
        </div>
        {speechSupported() && (
          <button type="button" aria-label="Đọc to bước này" onClick={readStep} className="flex h-12 w-12 items-center justify-center rounded-full bg-paper shadow-sm">
            <Volume2 size={20} />
          </button>
        )}
        {voiceSupported() && (
          <button
            type="button"
            aria-pressed={voiceOn}
            aria-label={voiceOn ? 'Tắt điều khiển giọng nói' : 'Bật điều khiển giọng nói'}
            onClick={() => setVoiceOn((v) => !v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm ${
              voiceOn ? `bg-chili text-white ${listening ? 'animate-ring' : ''}` : 'bg-paper'
            }`}
          >
            {voiceOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        )}
      </header>

      {/* Tiến độ */}
      <div className="flex gap-1 px-4" aria-hidden>
        {recipe.steps.map((s, i) => (
          <span key={s.stepNumber} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-chili' : 'bg-line'}`} />
        ))}
      </div>
      {voiceOn && (
        <p className="px-4 pt-2 text-center text-xs font-semibold text-chili-dark">
          {voiceError ?? 'Đang nghe: nói “Tiếp theo”, “Quay lại” hoặc “Đọc lại”'}
        </p>
      )}

      {/* Nội dung bước */}
      <main className="flex-1 overflow-y-auto px-5 py-5">
        {finished ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <PartyPopper size={56} className="text-chili" />
            <h2 className="mt-4 font-display text-4xl font-bold">Xong rồi!</h2>
            <p className="mt-2 text-lg text-ink/75">Chúc cả nhà ngon miệng với {recipe.title}.</p>
            {recipe.pairing.drinks.length > 0 && (
              <p className="mt-4 rounded-2xl border border-nhau/30 bg-nhau/5 px-4 py-3 text-base">
                Hợp vị cùng: <strong>{recipe.pairing.drinks.slice(0, 2).join(', ')}</strong>
              </p>
            )}
          </div>
        ) : (
          <div key={index} className="animate-rise mx-auto max-w-2xl">
            <p className="text-sm font-bold tracking-widest text-chili uppercase">
              Bước {step.stepNumber} / {stepCount}
            </p>
            <p className="mt-3 text-[1.7rem] leading-[1.45] font-medium sm:text-4xl sm:leading-[1.4]">
              {splitInstruction(step.instruction).map((part, i) =>
                part.seconds ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => startTimer(part.seconds!, `Bước ${step.stepNumber} · ${part.text}`)}
                    className="mx-0.5 inline-flex items-center gap-1.5 rounded-full bg-chili px-3.5 py-0.5 align-baseline font-bold whitespace-nowrap text-white shadow-sm active:bg-chili-dark"
                  >
                    <Timer size={22} /> {part.text}
                  </button>
                ) : (
                  part.text
                ),
              )}
            </p>
            {step.tip && (
              <p className="mt-5 rounded-2xl border border-chili/25 bg-chili/5 px-4 py-3 text-lg leading-relaxed">
                <strong className="text-chili-dark">Mẹo:</strong> {step.tip}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="flex h-12 items-center gap-2 rounded-full border-2 border-chili px-4 text-base font-bold text-chili-dark"
              >
                <Sparkles size={18} /> Vướng chỗ này? Hỏi BepAI
              </button>
              <button
                type="button"
                aria-expanded={showIngredients}
                onClick={() => setShowIngredients((v) => !v)}
                className="h-12 rounded-full border border-line bg-paper px-4 text-base font-semibold"
              >
                {showIngredients ? 'Ẩn nguyên liệu' : 'Xem nguyên liệu'}
              </button>
            </div>
            {showIngredients && (
              <ul className="mt-4 grid gap-x-6 gap-y-1.5 rounded-2xl border border-line bg-paper p-4 text-base sm:grid-cols-2">
                {recipe.ingredients.map((ingredient) => {
                  const scaled = scaleIngredient(ingredient, factor)
                  return (
                    <li key={ingredient.name} className="flex justify-between gap-3">
                      <span>{ingredient.name}</span>
                      <strong className="shrink-0 tabular-nums">{formatAmount(scaled.amount, scaled.unit)}</strong>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* Đồng hồ nổi */}
      {timers.length > 0 && (
        <div className="space-y-2 px-4 pb-2" aria-live="polite">
          {timers.map((timer) => {
            const remaining = (timer.endsAt - now) / 1000
            const progress = timer.done ? 1 : 1 - Math.max(remaining, 0) / timer.total
            return (
              <div
                key={timer.id}
                className={`relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-2.5 text-white shadow-lg ${
                  timer.done ? 'animate-ring bg-chili' : 'bg-ink'
                }`}
              >
                <span className="absolute inset-y-0 left-0 bg-white/15" style={{ width: `${progress * 100}%` }} />
                {timer.done ? <BellRing size={22} className="relative" /> : <Timer size={22} className="relative" />}
                <span className="relative min-w-0 flex-1 truncate text-sm font-semibold">{timer.label}</span>
                <span className="relative text-2xl font-bold tabular-nums">
                  {timer.done ? 'Hết giờ!' : formatClock(remaining)}
                </span>
                <button
                  type="button"
                  aria-label={timer.done ? 'Tắt báo' : 'Huỷ hẹn giờ'}
                  onClick={() => setTimers((list) => list.filter((t) => t.id !== timer.id))}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Điều hướng */}
      <footer className="flex gap-3 border-t border-line bg-paper px-4 pt-3 pb-safe">
        <button
          type="button"
          disabled={index === 0 && !finished}
          onClick={() => go(finished ? 0 : -1)}
          className="flex h-16 flex-1 items-center justify-center gap-1 rounded-2xl border-2 border-ink text-lg font-bold disabled:border-line disabled:text-ink/30"
        >
          <ChevronLeft size={24} /> Quay lại
        </button>
        {finished ? (
          <button type="button" onClick={exit} className="flex h-16 flex-[1.6] items-center justify-center rounded-2xl bg-herb text-lg font-bold text-white">
            Về công thức
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            className="flex h-16 flex-[1.6] items-center justify-center gap-1 rounded-2xl bg-chili text-lg font-bold text-white active:bg-chili-dark"
          >
            {index === stepCount - 1 ? 'Hoàn thành' : 'Tiếp theo'} <ChevronRight size={24} />
          </button>
        )}
      </footer>

      {chatOpen && (
        <ChatDrawer recipe={recipe} servings={servings} stepNumber={step.stepNumber} onClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}

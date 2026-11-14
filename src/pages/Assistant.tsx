import { CloudSun, LoaderCircle, Refrigerator, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageHeader, RecipeCard } from '../components/ui'
import { navigate } from '../hooks/useHashRoute'
import { useOnline } from '../lib/app'
import { conditionLabel, profilePlace, useProfile, useWeather, weatherSummary } from '../lib/household'
import { AI_RECIPES_KEY, storeAIRecipes } from '../lib/recipes'
import { useStored } from '../lib/storage'
import {
  AIError,
  AI_SETTINGS_KEY,
  DEFAULT_AI_SETTINGS,
  FRIDGE_STYLES,
  PROVIDERS,
  generateFromFridge,
  type AISettings,
  type FridgeResult,
  type FridgeStyle,
} from '../services/aiService'
import type { Recipe } from '../types/recipe'

const QUICK_ADD = ['ba chỉ', 'ức gà', 'trứng', 'đậu hũ', 'tôm', 'cá', 'thịt bò', 'cà chua', 'nấm', 'rau muống', 'sả', 'bia']

export default function Assistant() {
  const [input, setInput] = useState('')
  const [style, setStyle] = useState<FridgeStyle>('com-nha')
  const [busy, setBusy] = useState<'fridge' | 'today' | null>(null)
  const [result, setResult] = useState<FridgeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const online = useOnline()
  const [profile] = useProfile()
  const weather = useWeather(profile)
  const [settings] = useStored<Partial<AISettings>>(AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS)
  const [history] = useStored<Recipe[]>(AI_RECIPES_KEY, [])

  const provider = settings.provider ?? 'gemini'
  const hasKey = !!settings.apiKeys?.[provider]?.trim()

  const run = async (mode: 'fridge' | 'today') => {
    if (busy) return
    setBusy(mode)
    setError(null)
    setResult(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const generated = await generateFromFridge(mode === 'fridge' ? input : '', style, controller.signal)
      if (!generated.mock) storeAIRecipes(generated.recipes)
      setResult(generated)
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof AIError ? err.message : 'Có lỗi khi tạo công thức. Hãy thử lại.')
    } finally {
      setBusy(null)
    }
  }

  const addTag = (tag: string) =>
    setInput((prev) => (prev.trim() ? `${prev.trim().replace(/,$/, '')}, ${tag}` : tag))

  const previous = history.filter((r) => !result?.recipes.some((x) => x.id === r.id)).slice(0, 6)

  return (
    <>
      <PageHeader title="BepAI" subtitle="Trợ lý bếp núc hiểu thời tiết, khẩu vị và sức khoẻ nhà bạn" />

      <div className="space-y-4 px-4">
        {/* Trạng thái AI */}
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={`flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold ${
            hasKey && online ? 'bg-herb/10 text-herb' : 'bg-nhau/10 text-nhau'
          }`}
        >
          <Sparkles size={16} className="shrink-0" />
          {!hasKey
            ? 'Chưa có API key — đang dùng gợi ý có sẵn. Chạm để thêm key (Gemini miễn phí).'
            : !online
              ? 'Đang mất mạng — dùng gợi ý có sẵn cho tới khi có mạng lại.'
              : `AI sẵn sàng · ${PROVIDERS[provider].label}`}
        </button>

        {/* Bối cảnh mà AI sẽ dùng */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <h2 className="text-xs font-bold tracking-wide text-ink/60 uppercase">BepAI đang cân nhắc</h2>
          <div className="mt-2 flex flex-wrap gap-1.5 text-sm font-medium">
            <span className="rounded-full bg-cream px-3 py-1">👨‍👩‍👧 {profile.familySize} người</span>
            <span className="rounded-full bg-cream px-3 py-1">📍 {profilePlace(profile)}</span>
            {weather && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-900">
                {weatherSummary(weather).emoji} {Math.round(weather.temp)}°C
              </span>
            )}
            {profile.conditions.map((c) => (
              <span key={c} className="rounded-full bg-red-100 px-3 py-1 text-red-800">
                {conditionLabel(c)}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void run('today')}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-bold text-white disabled:opacity-60"
          >
            {busy === 'today' ? <LoaderCircle size={20} className="animate-spin" /> : <CloudSun size={20} />}
            Hôm nay ăn gì? Gợi ý theo thời tiết & gia đình
          </button>
        </section>

        {/* Tủ lạnh có gì nấu nấy */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Refrigerator size={22} className="text-chili" /> Tủ lạnh có gì nấu nấy
          </h2>
          <label htmlFor="fridge" className="mt-1 block text-sm text-ink/70">
            Kể tự nhiên hoặc liệt kê nguyên liệu, cách nhau bằng dấu phẩy.
          </label>
          <textarea
            id="fridge"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ví dụ: còn 300g ba chỉ, ít sả, ớt chuông, nửa lon bia"
            className="mt-2 w-full rounded-2xl border border-line bg-cream p-3 text-base outline-none focus:border-chili"
          />
          <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            {QUICK_ADD.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="shrink-0 rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-medium"
              >
                + {tag}
              </button>
            ))}
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold tracking-wide text-ink/60 uppercase">Muốn nấu kiểu gì?</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {FRIDGE_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={style === s.id}
                  onClick={() => setStyle(s.id)}
                  className={`rounded-2xl border px-1 py-2.5 text-center text-sm font-semibold ${
                    style === s.id
                      ? s.id === 'mon-nhau'
                        ? 'border-nhau bg-nhau text-white'
                        : 'border-chili bg-chili text-white'
                      : 'border-line bg-cream'
                  }`}
                >
                  <span className="block text-2xl">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            disabled={!!busy || input.trim().length < 3}
            onClick={() => void run('fridge')}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-chili text-base font-bold text-white disabled:opacity-50"
          >
            {busy === 'fridge' ? <LoaderCircle size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {busy === 'fridge' ? 'Đang nghĩ món…' : 'Gợi ý món nấu được ngay'}
          </button>
        </section>

        {busy && (
          <div className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3 text-sm" role="status">
            <span>BepAI đang soạn công thức, thường mất 5–15 giây…</span>
            <button type="button" onClick={() => abortRef.current?.abort()} className="font-bold text-chili-dark underline">
              Huỷ
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {result && (
          <section className="animate-rise space-y-3">
            <h2 className="font-display text-xl font-bold">{result.mock ? 'Món có sẵn hợp nhất' : 'BepAI đề xuất'}</h2>
            {result.notice && <p className="rounded-2xl bg-nhau/10 px-4 py-3 text-sm text-ink/80">{result.notice}</p>}
            <div className="grid grid-cols-2 gap-3">
              {result.recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
            {!result.mock && <p className="text-xs text-ink/55">Công thức AI tạo được lưu trong mục Đã lưu để xem lại khi mất mạng.</p>}
          </section>
        )}

        {previous.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold">Món AI đã tạo gần đây</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previous.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

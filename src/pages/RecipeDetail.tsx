import { ArrowLeft, Check, HeartPulse, Clock, Flame, Lightbulb, Minus, Play, Plus, ShoppingBasket, Sparkles, Users, Wine } from 'lucide-react'
import { useState } from 'react'
import ChatDrawer from '../components/ChatDrawer'
import { Badges, Cover, EmptyState, SaveButton } from '../components/ui'
import { goBack, navigate } from '../hooks/useHashRoute'
import { toast } from '../lib/app'
import { conditionLabel, healthWarnings, useProfile } from '../lib/household'
import { addToShopping, useRecipe } from '../lib/recipes'
import { formatAmount, scaleIngredient } from '../lib/scaling'
import { useStored } from '../lib/storage'
import { formatMinutes, splitInstruction } from '../lib/timeParse'
import { DIFFICULTY_LABEL, type Ingredient, type IngredientGroup } from '../types/recipe'

const GROUPS: { id: IngredientGroup; title: string }[] = [
  { id: 'chinh', title: 'Nguyên liệu chính' },
  { id: 'gia-vi', title: 'Gia vị & nước sốt' },
]

const MAX_SERVINGS = 20

export default function RecipeDetail({ id }: { id: string }) {
  const recipe = useRecipe(id)
  const [servingsMap, setServingsMap] = useStored<Record<string, number>>('servings', {})
  const [haveMap, setHaveMap] = useStored<Record<string, string[]>>('have', {})
  const [notes, setNotes] = useStored<Record<string, string>>('notes', {})
  const [chatOpen, setChatOpen] = useState(false)
  const [profile] = useProfile()

  if (!recipe) {
    return (
      <div className="pt-safe">
        <EmptyState emoji="🍽️" title="Không tìm thấy món này">
          <button type="button" onClick={() => navigate('/')} className="font-semibold text-chili-dark underline">
            Về trang Khám phá
          </button>
        </EmptyState>
      </div>
    )
  }

  // Mặc định nấu cho đúng số người trong gia đình (đặt trong Cài đặt).
  const servings = servingsMap[id] ?? profile.familySize ?? recipe.baseServings
  const warnings = healthWarnings(recipe, profile.conditions)
  const factor = servings / recipe.baseServings
  const setServings = (n: number) =>
    setServingsMap((prev) => ({ ...prev, [id]: Math.min(Math.max(Math.round(n), 1), MAX_SERVINGS) }))

  const have = haveMap[id] ?? []
  const toggleHave = (name: string) =>
    setHaveMap((prev) => {
      const current = prev[id] ?? []
      return { ...prev, [id]: current.includes(name) ? current.filter((n) => n !== name) : [...current, name] }
    })

  const scaled: Ingredient[] = recipe.ingredients.map((i) => scaleIngredient(i, factor))
  const missing = scaled.filter((i) => !have.includes(i.name))
  const presets = recipe.category === 'mon-nhau' ? [2, 4, 6] : [1, 2, 4, 6]

  const pushMissing = () => {
    addToShopping(missing, recipe.title)
    toast(`Đã thêm ${missing.length} món vào danh sách đi chợ`)
  }

  return (
    <article className="pb-28">
      <div className="relative">
        <Cover recipe={recipe} className="h-56 sm:h-64 sm:rounded-b-3xl" />
        <button
          type="button"
          aria-label="Quay lại"
          onClick={() => goBack('/')}
          className="absolute top-0 left-3 mt-[max(env(safe-area-inset-top),0.75rem)] flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 shadow-sm backdrop-blur"
        >
          <ArrowLeft size={20} />
        </button>
        <SaveButton id={recipe.id} className="absolute top-0 right-3 mt-[max(env(safe-area-inset-top),0.75rem)]" />
      </div>

      <div className="relative -mt-6 space-y-4 rounded-t-3xl bg-cream px-4 pt-5">
        <header className="space-y-2.5">
          <Badges recipe={recipe} />
          <h1 className="font-display text-3xl leading-tight font-bold">{recipe.title}</h1>
          <p className="text-base leading-relaxed text-ink/80">{recipe.description}</p>
        </header>

        {warnings.length > 0 && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-red-800">
              <HeartPulse size={20} /> Lưu ý sức khoẻ cho gia đình bạn
            </h2>
            <ul className="mt-2 space-y-2 text-[15px] leading-relaxed">
              {warnings.map((w, i) => (
                <li key={i}>
                  <span
                    className={`mr-1.5 rounded-full px-2 py-0.5 text-xs font-bold text-white ${
                      w.severity === 'tranh' ? 'bg-red-600' : 'bg-nhau'
                    }`}
                  >
                    {w.severity === 'tranh' ? 'Nên tránh' : 'Hạn chế'}
                  </span>
                  <strong>{conditionLabel(w.condition)}:</strong> {w.advice}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-red-900/70">
              Gợi ý tham khảo theo nguyên tắc dinh dưỡng chung, không thay cho chỉ định của bác sĩ. Bấm “Hỏi BepAI” để nhờ
              chỉnh công thức cho phù hợp.
            </p>
          </section>
        )}

        {/* Bento thông số */}
        <dl className="grid grid-cols-4 gap-2 text-center">
          {[
            { icon: Clock, label: 'Sơ chế', value: formatMinutes(recipe.prepTime) },
            { icon: Flame, label: 'Nấu & chờ', value: formatMinutes(recipe.cookTime) },
            { icon: Users, label: 'Độ khó', value: DIFFICULTY_LABEL[recipe.difficulty] },
            { icon: Flame, label: 'Mỗi phần', value: `${recipe.calories} kcal` },
          ].map(({ icon: Icon, label, value }, i) => (
            <div key={label} className="rounded-2xl border border-line bg-paper px-1 py-3">
              {i < 2 && <Icon size={16} className="mx-auto mb-1 text-chili" />}
              <dt className="text-[11px] font-semibold text-ink/60 uppercase">{label}</dt>
              <dd className="mt-0.5 text-sm font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Khẩu phần */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Khẩu phần</h2>
              <p className="text-xs text-ink/60">Định lượng tự tính lại theo số người</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Giảm một người"
                disabled={servings <= 1}
                onClick={() => setServings(servings - 1)}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-cream disabled:opacity-40"
              >
                <Minus size={20} />
              </button>
              <output aria-live="polite" className="w-16 text-center">
                <span className="block text-2xl leading-none font-bold">{servings}</span>
                <span className="text-xs text-ink/60">người</span>
              </output>
              <button
                type="button"
                aria-label="Thêm một người"
                disabled={servings >= MAX_SERVINGS}
                onClick={() => setServings(servings + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-chili text-white disabled:opacity-40"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setServings(n)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  servings === n ? 'border-ink bg-ink text-white' : 'border-line bg-cream'
                }`}
              >
                {n} người
              </button>
            ))}
            <button
              type="button"
              onClick={() => setServings(8)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                servings === 8 ? 'border-nhau bg-nhau text-white' : 'border-nhau/40 bg-nhau/10 text-nhau'
              }`}
            >
              🍻 Bàn nhậu 6–10 người
            </button>
          </div>
        </section>

        {/* Nguyên liệu */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <h2 className="font-display text-xl font-bold">Nguyên liệu</h2>
          <p className="text-xs text-ink/60">Chạm để đánh dấu món nhà đã có sẵn</p>
          {GROUPS.map((group) => {
            const items = scaled.filter((i) => i.group === group.id)
            if (!items.length) return null
            return (
              <div key={group.id} className="mt-4">
                <h3 className="mb-1 text-xs font-bold tracking-wide text-chili-dark uppercase">{group.title}</h3>
                <ul className="divide-y divide-line">
                  {items.map((item) => {
                    const checked = have.includes(item.name)
                    return (
                      <li key={item.name}>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleHave(item.name)}
                            className="peer sr-only"
                          />
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-chili ${
                              checked ? 'border-herb bg-herb text-white' : 'border-ink/30'
                            }`}
                          >
                            {checked && <Check size={16} strokeWidth={3} />}
                          </span>
                          <span className={`flex-1 text-[15px] leading-snug ${checked ? 'text-ink/45 line-through' : ''}`}>
                            {item.name}
                            {item.isOptional && <span className="ml-1.5 text-xs text-ink/50 no-underline">(tuỳ chọn)</span>}
                            {item.note && <span className="block text-xs text-ink/55">{item.note}</span>}
                          </span>
                          <span className={`shrink-0 text-right text-[15px] font-bold tabular-nums ${checked ? 'text-ink/45' : ''}`}>
                            {formatAmount(item.amount, item.unit)}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          <button
            type="button"
            disabled={missing.length === 0}
            onClick={pushMissing}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink px-3 py-2 text-sm font-bold disabled:border-line disabled:text-ink/40"
          >
            <ShoppingBasket size={18} />
            {missing.length === 0 ? 'Nhà đã đủ nguyên liệu' : `Thêm ${missing.length} món còn thiếu vào danh sách đi chợ`}
          </button>
        </section>

        {/* Bí quyết */}
        {recipe.secrets.length > 0 && (
          <section className="rounded-3xl border border-chili/25 bg-chili/5 p-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-chili-dark">
              <Lightbulb size={20} /> Bí quyết ngon chuẩn vị
            </h2>
            <ul className="mt-2 space-y-2 text-[15px] leading-relaxed">
              {recipe.secrets.map((secret) => (
                <li key={secret} className="flex gap-2">
                  <span className="font-bold text-chili">•</span>
                  {secret}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Các bước */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <h2 className="font-display text-xl font-bold">Cách làm</h2>
          <ol className="mt-3 space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.stepNumber} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                  {step.stepNumber}
                </span>
                <div className="flex-1 text-[15px] leading-relaxed">
                  <p>
                    {splitInstruction(step.instruction).map((part, i) =>
                      part.seconds ? (
                        <strong key={i} className="font-bold whitespace-nowrap text-chili-dark">
                          {part.text}
                        </strong>
                      ) : (
                        part.text
                      ),
                    )}
                  </p>
                  {step.tip && (
                    <p className="mt-1.5 rounded-xl bg-cream px-3 py-2 text-sm text-ink/75">
                      <strong>Mẹo:</strong> {step.tip}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Ăn kèm */}
        {(recipe.pairing.drinks.length > 0 || recipe.pairing.sides.length > 0) && (
          <section className="rounded-3xl border border-nhau/30 bg-nhau/5 p-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-nhau">
              <Wine size={20} /> Đồ uống & món ăn kèm hợp vị
            </h2>
            {[
              { label: 'Đồ uống', items: recipe.pairing.drinks },
              { label: 'Ăn kèm', items: recipe.pairing.sides },
            ].map(
              ({ label, items }) =>
                items.length > 0 && (
                  <div key={label} className="mt-3">
                    <h3 className="text-xs font-bold text-ink/60 uppercase">{label}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {items.map((item) => (
                        <span key={item} className="rounded-full border border-nhau/30 bg-paper px-3 py-1 text-sm font-medium">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </section>
        )}

        {/* Ghi chú */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <label htmlFor="note" className="font-display text-xl font-bold">
            Ghi chú của bạn
          </label>
          <textarea
            id="note"
            rows={3}
            value={notes[id] ?? ''}
            onChange={(e) => setNotes((prev) => ({ ...prev, [id]: e.target.value }))}
            placeholder="Ví dụ: nhà mình thích ngọt hơn, lần sau thêm 1 muỗng đường…"
            className="mt-2 w-full rounded-2xl border border-line bg-cream p-3 text-[15px] outline-none focus:border-chili"
          />
          <p className="mt-1 text-xs text-ink/55">Tự lưu trên máy, xem được cả khi mất mạng.</p>
        </section>

        {recipe.image && <p className="text-xs text-ink/50">{recipe.image.credit}</p>}
        {recipe.tags.length > 0 && (
          <p className="text-sm text-ink/55">{recipe.tags.map((tag) => `#${tag.replace(/\s+/g, '')}`).join('  ')}</p>
        )}
      </div>

      {/* Thanh hành động */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-chili px-4 text-base font-bold text-chili-dark"
          >
            <Sparkles size={20} /> Hỏi BepAI
          </button>
          <button
            type="button"
            onClick={() => navigate(`/cook/${recipe.id}`)}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-chili text-base font-bold text-white shadow-sm active:bg-chili-dark"
          >
            <Play size={20} className="fill-white" /> Bắt đầu nấu
          </button>
        </div>
      </div>

      {chatOpen && <ChatDrawer recipe={recipe} servings={servings} onClose={() => setChatOpen(false)} />}
    </article>
  )
}

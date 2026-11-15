import { CalendarDays, Clock, Dices, Flame, ShoppingBasket, TriangleAlert, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import { Chip, PageHeader } from '../components/ui'
import { MEAL_SETS } from '../data/mealSets'
import { navigate } from '../hooks/useHashRoute'
import { toast } from '../lib/app'
import { useProfile, useWeather, weatherMood } from '../lib/household'
import {
  addMealToShopping,
  autoPlanWeek,
  mealCalories,
  mealDishes,
  mealMinutes,
  mealWarningCount,
  next7Days,
  PLAN_KEY,
  rankedMealSets,
  setPlanDay,
  type Plan,
  type RankedMeal,
} from '../lib/meals'
import { useAllRecipes } from '../lib/recipes'
import { useStored } from '../lib/storage'
import { formatMinutes } from '../lib/timeParse'
import { REGION_LABEL } from '../types/recipe'

type Tab = 'all' | 'bac' | 'trung' | 'nam' | 'nhau'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'bac', label: 'Miền Bắc' },
  { id: 'trung', label: 'Miền Trung' },
  { id: 'nam', label: 'Miền Nam' },
  { id: 'nhau', label: '🍻 Bàn nhậu' },
]

export function MealCard({ item, weatherMatch }: { item: RankedMeal; weatherMatch: boolean }) {
  const [profile] = useProfile()
  const { meal, dishes } = item
  const warned = mealWarningCount(dishes, profile)
  return (
    <button
      type="button"
      onClick={() => navigate(`/mam/${meal.id}`)}
      className="w-full rounded-3xl border border-line bg-paper p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cream text-3xl">{meal.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2 py-0.5 text-white ${meal.kind === 'nhau' ? 'bg-nhau' : 'bg-ink'}`}>
              {meal.kind === 'nhau' ? 'Bàn nhậu' : REGION_LABEL[meal.region]}
            </span>
            {weatherMatch && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">Hợp thời tiết</span>}
            {warned > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                <TriangleAlert size={12} /> {warned} món cần lưu ý
              </span>
            )}
          </div>
          <h3 className="mt-1 font-display text-xl leading-tight font-bold">{meal.title}</h3>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-[15px]">
        {dishes.map((dish) => (
          <li key={dish.id} className="flex gap-2">
            <span>{dish.emoji}</span>
            <span>{dish.title}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-4 text-xs font-medium text-ink/65">
        <span className="inline-flex items-center gap-1">
          <Clock size={14} /> khoảng {formatMinutes(mealMinutes(dishes))}
        </span>
        <span className="inline-flex items-center gap-1">
          <Flame size={14} /> {mealCalories(dishes)} kcal/người
        </span>
      </div>
    </button>
  )
}

export default function Meals() {
  const recipes = useAllRecipes()
  const [profile] = useProfile()
  const weather = useWeather(profile)
  const mood = weather ? weatherMood(weather) : null
  const [plan] = useStored<Plan>(PLAN_KEY, {})
  const [tab, setTab] = useState<Tab>('all')
  const days = next7Days()

  const ranked = rankedMealSets(recipes, profile, weather)
  const shown = ranked.filter(({ meal }) =>
    tab === 'all' ? true : tab === 'nhau' ? meal.kind === 'nhau' : meal.kind === 'com' && meal.region === tab,
  )
  const plannedCount = days.filter((d) => plan[d.key]).length

  const pickForMe = () => {
    const top = ranked.filter((r) => r.meal.kind === 'com').slice(0, 4)
    const pick = top[Math.floor(Math.random() * top.length)]
    if (pick) navigate(`/mam/${pick.meal.id}`)
  }

  const fillWeek = () => {
    const filled = autoPlanWeek(recipes, profile, weather)
    toast(filled ? `Đã xếp thêm ${filled} ngày, không trùng mâm` : 'Cả tuần đã có thực đơn rồi')
  }

  const shopWeek = () => {
    let lines = 0
    for (const day of days) {
      const meal = MEAL_SETS.find((m) => m.id === plan[day.key])
      if (meal) lines += addMealToShopping(meal, mealDishes(meal, recipes), profile.familySize)
    }
    toast(`Đã gom nguyên liệu ${plannedCount} ngày vào danh sách đi chợ (${lines} dòng)`)
  }

  return (
    <>
      <PageHeader title="Mâm cơm" subtitle={`Nấu cho ${profile.familySize} người · lên thực đơn cả tuần`} />

      <div className="space-y-5 px-4">
        <button
          type="button"
          onClick={pickForMe}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-chili text-base font-bold text-white shadow-sm active:bg-chili-dark"
        >
          <Dices size={22} /> Hôm nay ăn gì? Chọn giúp tôi
        </button>

        {/* Thực đơn 7 ngày */}
        <section className="rounded-3xl border border-line bg-paper p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <CalendarDays size={20} className="text-chili" /> Thực đơn 7 ngày
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {days.map((day) => {
              const meal = MEAL_SETS.find((m) => m.id === plan[day.key])
              return (
                <li key={day.key} className="flex min-h-13 items-center gap-3 py-2">
                  <span className="w-24 shrink-0 text-sm font-semibold text-ink/70">{day.label.split(' · ')[0]}</span>
                  {meal ? (
                    <>
                      <button type="button" onClick={() => navigate(`/mam/${meal.id}`)} className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold">
                        {meal.emoji} {meal.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Bỏ thực đơn ${day.label}`}
                        onClick={() => setPlanDay(day.key, null)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-ink/60"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <span className="flex-1 text-sm text-ink/40">Chưa chọn</span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={fillWeek} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-bold text-white">
              <Wand2 size={18} /> Xếp giúp cả tuần
            </button>
            <button
              type="button"
              disabled={plannedCount === 0}
              onClick={shopWeek}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-ink text-sm font-bold disabled:border-line disabled:text-ink/40"
            >
              <ShoppingBasket size={18} /> Đi chợ cả tuần
            </button>
          </div>
          <p className="mt-2 text-xs text-ink/55">Tự xếp theo thời tiết, vùng miền và lưu ý sức khoẻ nhà bạn; không lặp mâm trong tuần.</p>
        </section>

        {/* Danh sách mâm */}
        <section>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {TABS.map((t) => (
              <Chip key={t.id} active={tab === t.id} tone={t.id === 'nhau' ? 'nhau' : 'chili'} onClick={() => setTab(t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((item) => (
              <MealCard key={item.meal.id} item={item} weatherMatch={!!mood && item.meal.goodFor.includes(mood)} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

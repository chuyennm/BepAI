import { ArrowLeft, CalendarPlus, ChevronRight, Clock, Flame, ListOrdered, ShoppingBasket, Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/ui'
import { MEAL_SETS } from '../data/mealSets'
import { goBack, navigate } from '../hooks/useHashRoute'
import { toast } from '../lib/app'
import { conditionLabel, healthWarnings, useProfile } from '../lib/household'
import { addMealToShopping, mealCalories, mealDishes, mealMinutes, next7Days, PLAN_KEY, setPlanDay, type Plan } from '../lib/meals'
import { totalTime, useAllRecipes } from '../lib/recipes'
import { useStored } from '../lib/storage'
import { formatMinutes } from '../lib/timeParse'
import { COURSE_LABEL, REGION_LABEL } from '../types/recipe'

export default function MealDetail({ id }: { id: string }) {
  const recipes = useAllRecipes()
  const [profile] = useProfile()
  const [plan] = useStored<Plan>(PLAN_KEY, {})
  const [pickingDay, setPickingDay] = useState(false)
  const meal = MEAL_SETS.find((m) => m.id === id)

  if (!meal) {
    return (
      <div className="pt-safe">
        <EmptyState emoji="🍽️" title="Không tìm thấy mâm này">
          <button type="button" onClick={() => navigate('/mam')} className="font-semibold text-chili-dark underline">
            Xem các mâm cơm
          </button>
        </EmptyState>
      </div>
    )
  }

  const dishes = mealDishes(meal, recipes)
  const servings = profile.familySize
  // Món nào lâu nhất thì bắt tay vào trước.
  const order = [...dishes].sort((a, b) => totalTime(b) - totalTime(a))
  const days = next7Days()
  const plannedDay = days.find((d) => plan[d.key] === meal.id)
  const warnings = dishes.flatMap((dish) => healthWarnings(dish, profile.conditions).map((w) => ({ dish, ...w })))

  const shop = () => {
    const lines = addMealToShopping(meal, dishes, servings)
    toast(`Đã thêm nguyên liệu cả mâm cho ${servings} người (${lines} dòng)`)
  }

  return (
    <article className="pb-28">
      <header className={`px-4 pt-safe pb-6 text-white ${meal.kind === 'nhau' ? 'bg-nhau' : 'bg-ink'}`}>
        <button
          type="button"
          aria-label="Quay lại"
          onClick={() => goBack('/mam')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="mt-3 text-5xl">{meal.emoji}</div>
        <p className="mt-2 text-xs font-bold tracking-widest text-white/70 uppercase">
          {meal.kind === 'nhau' ? 'Bàn nhậu' : `Mâm cơm · ${REGION_LABEL[meal.region]}`}
        </p>
        <h1 className="mt-1 font-display text-3xl leading-tight font-bold">{meal.title}</h1>
        <p className="mt-2 text-base leading-relaxed text-white/85">{meal.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-white/85">
          <span className="inline-flex items-center gap-1.5">
            <Users size={16} /> {servings} người
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={16} /> khoảng {formatMinutes(mealMinutes(dishes))}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Flame size={16} /> {mealCalories(dishes)} kcal/người
          </span>
        </div>
      </header>

      <div className="-mt-3 space-y-4 rounded-t-3xl bg-cream px-4 pt-5">
        {warnings.length > 0 && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-[15px] leading-relaxed">
            <h2 className="font-display text-lg font-bold text-red-800">Lưu ý sức khoẻ cho gia đình bạn</h2>
            <ul className="mt-1.5 space-y-1.5">
              {warnings.slice(0, 6).map((w, i) => (
                <li key={i}>
                  <strong>
                    {w.dish.title} · {conditionLabel(w.condition)}:
                  </strong>{' '}
                  {w.advice}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-900/70">Gợi ý tham khảo, không thay cho chỉ định của bác sĩ.</p>
          </section>
        )}

        <section className="rounded-3xl border border-line bg-paper p-4">
          <h2 className="font-display text-xl font-bold">Trong mâm có</h2>
          <ul className="mt-2 divide-y divide-line">
            {dishes.map((dish) => (
              <li key={dish.id}>
                <button type="button" onClick={() => navigate(`/r/${dish.id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream text-2xl">{dish.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-snug font-bold">{dish.title}</span>
                    <span className="block text-xs text-ink/60">
                      {dish.course ? `${COURSE_LABEL[dish.course]} · ` : ''}
                      {formatMinutes(totalTime(dish))} · {dish.calories} kcal
                    </span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-ink/40" />
                </button>
              </li>
            ))}
          </ul>
          {meal.extras.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {meal.extras.map((extra) => (
                <span key={extra} className="rounded-full bg-cream px-3 py-1 text-sm font-medium">
                  + {extra}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-chili/25 bg-chili/5 p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-chili-dark">
            <ListOrdered size={20} /> Thứ tự nấu cho kịp giờ cơm
          </h2>
          <ol className="mt-2 space-y-2 text-[15px] leading-relaxed">
            <li className="flex gap-2">
              <span className="font-bold text-chili">0.</span> Cắm nồi cơm trước tiên.
            </li>
            {order.map((dish, i) => (
              <li key={dish.id} className="flex gap-2">
                <span className="font-bold text-chili">{i + 1}.</span>
                <span>
                  <strong>{dish.title}</strong> — {formatMinutes(totalTime(dish))}
                  {i === 0 && order.length > 1 ? ' (lâu nhất, bắt tay vào trước; trong lúc chờ thì sơ chế các món sau)' : ''}
                  {i === order.length - 1 && order.length > 1 && dish.course !== 'kem' ? ' (làm sau cùng để ăn nóng)' : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {pickingDay && (
          <section className="animate-rise rounded-3xl border border-line bg-paper p-4">
            <h2 className="font-display text-xl font-bold">Nấu mâm này vào ngày nào?</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {days.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => {
                    setPlanDay(day.key, meal.id)
                    setPickingDay(false)
                    toast(`Đã xếp vào ${day.label.split(' · ')[0].toLowerCase()}`)
                  }}
                  className={`rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold ${
                    plan[day.key] === meal.id ? 'border-chili bg-chili text-white' : 'border-line bg-cream'
                  }`}
                >
                  {day.label}
                  {plan[day.key] && plan[day.key] !== meal.id && <span className="block text-xs font-normal opacity-60">đang có mâm khác</span>}
                </button>
              ))}
            </div>
          </section>
        )}
        {plannedDay && !pickingDay && (
          <p className="text-center text-sm font-semibold text-herb">✓ Đã xếp vào {plannedDay.label.split(' · ')[0].toLowerCase()}</p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 pt-3">
          <button
            type="button"
            onClick={() => setPickingDay((v) => !v)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-ink px-4 text-base font-bold"
          >
            <CalendarPlus size={20} /> Xếp vào ngày
          </button>
          <button
            type="button"
            onClick={shop}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-chili text-base font-bold text-white shadow-sm active:bg-chili-dark"
          >
            <ShoppingBasket size={20} /> Đi chợ cả mâm
          </button>
        </div>
      </div>
    </article>
  )
}

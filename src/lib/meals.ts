import { MEAL_SETS } from '../data/mealSets'
import type { Ingredient, MealSet, Recipe } from '../types/recipe'
import { healthWarnings, suitability, weatherMood, type Profile, type Weather } from './household'
import { addToShopping, totalTime } from './recipes'
import { scaleIngredient } from './scaling'
import { getStored, setStored } from './storage'

export const PLAN_KEY = 'plan'
/** Thực đơn: ngày (YYYY-MM-DD) → id mâm cơm. */
export type Plan = Record<string, string>

export interface RankedMeal {
  meal: MealSet
  dishes: Recipe[]
  score: number
}

export const mealDishes = (meal: MealSet, recipes: Recipe[]): Recipe[] =>
  meal.dishes.map((id) => recipes.find((r) => r.id === id)).filter((r): r is Recipe => !!r)

/** Xếp hạng mâm cơm theo thời tiết, vùng miền, sức khoẻ và món mới nấu gần đây. */
export function rankedMealSets(
  recipes: Recipe[],
  profile: Profile,
  weather: Weather | null,
  kind?: MealSet['kind'],
): RankedMeal[] {
  const mood = weather ? weatherMood(weather) : null
  return MEAL_SETS.filter((meal) => !kind || meal.kind === kind)
    .map((meal, index) => {
      const dishes = mealDishes(meal, recipes)
      const average = dishes.reduce((sum, d) => sum + suitability(d, profile, weather), 0) / Math.max(dishes.length, 1)
      const score = average + (mood && meal.goodFor.includes(mood) ? 2 : 0)
      return { meal, dishes, score, index }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
}

/** Ước lượng thời gian nấu cả mâm: món lâu nhất + phần sơ chế của các món còn lại. */
export function mealMinutes(dishes: Recipe[]): number {
  if (!dishes.length) return 0
  const longest = [...dishes].sort((a, b) => totalTime(b) - totalTime(a))[0]
  const others = dishes.filter((d) => d !== longest).reduce((sum, d) => sum + d.prepTime + Math.min(d.cookTime, 10), 0)
  return totalTime(longest) + Math.round(others * 0.6)
}

export const mealCalories = (dishes: Recipe[]) => dishes.reduce((sum, d) => sum + d.calories, 0)

export function mealWarningCount(dishes: Recipe[], profile: Profile): number {
  return dishes.filter((d) => healthWarnings(d, profile.conditions).length > 0).length
}

/** Gom nguyên liệu cả mâm (theo số người) vào danh sách đi chợ. Trả về số dòng đã thêm. */
export function addMealToShopping(meal: MealSet, dishes: Recipe[], servings: number): number {
  let count = 0
  for (const dish of dishes) {
    const factor = servings / dish.baseServings
    const scaled: Ingredient[] = dish.ingredients.filter((i) => !i.isOptional).map((i) => scaleIngredient(i, factor))
    count += addToShopping(scaled, dish.title)
  }
  void meal
  return count
}

// ───────── Thực đơn 7 ngày ─────────

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function next7Days(): { key: string; label: string; short: string }[] {
  const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const dm = `${date.getDate()}/${date.getMonth() + 1}`
    return {
      key: dayKey(date),
      label: i === 0 ? `Hôm nay · ${dm}` : i === 1 ? `Ngày mai · ${dm}` : `${names[date.getDay()]} · ${dm}`,
      short: i === 0 ? 'Hôm nay' : names[date.getDay()],
    }
  })
}

export const getPlan = (): Plan => getStored<Plan>(PLAN_KEY, {})

export function setPlanDay(key: string, mealId: string | null): void {
  const plan = { ...getPlan() }
  if (mealId) plan[key] = mealId
  else delete plan[key]
  // Dọn các ngày đã qua để dữ liệu không phình ra.
  const today = dayKey(new Date())
  for (const k of Object.keys(plan)) if (k < today) delete plan[k]
  setStored(PLAN_KEY, plan)
}

/**
 * Tự xếp mâm cơm cho những ngày còn trống trong 7 ngày tới: ưu tiên mâm điểm cao,
 * không lặp mâm và hạn chế lặp món mặn chính giữa các ngày.
 */
export function autoPlanWeek(recipes: Recipe[], profile: Profile, weather: Weather | null): number {
  const plan = { ...getPlan() }
  const days = next7Days()
  const ranked = rankedMealSets(recipes, profile, weather, 'com').filter((r) => r.score > -3)
  const usedMeals = new Set(days.map((d) => plan[d.key]).filter(Boolean))
  const usedDishes = new Set<string>()
  for (const id of usedMeals) MEAL_SETS.find((m) => m.id === id)?.dishes.forEach((d) => usedDishes.add(d))
  let filled = 0
  for (const day of days) {
    if (plan[day.key]) continue
    const pick =
      ranked.find((r) => !usedMeals.has(r.meal.id) && !r.meal.dishes.slice(0, 2).some((d) => usedDishes.has(d))) ??
      ranked.find((r) => !usedMeals.has(r.meal.id))
    if (!pick) break
    plan[day.key] = pick.meal.id
    usedMeals.add(pick.meal.id)
    pick.meal.dishes.forEach((d) => usedDishes.add(d))
    filled++
  }
  setStored(PLAN_KEY, plan)
  return filled
}

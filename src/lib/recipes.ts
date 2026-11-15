import { useMemo } from 'react'
import { SEED_RECIPES } from '../data/recipes'
import type { Aisle, Category, Ingredient, Recipe } from '../types/recipe'
import { getStored, setStored, useStored } from './storage'

export const AI_RECIPES_KEY = 'ai-recipes'
export const SAVED_KEY = 'saved'
export const SHOPPING_KEY = 'shopping'

export interface ShoppingItem {
  id: string
  name: string
  amount: number | null
  unit: string
  aisle: Aisle
  checked: boolean
  from: string[]
}

export const COOKED_KEY = 'cooked'

/** Ghi nhận vừa nấu xong một món (giữ 20 lần gần nhất, bỏ qua lần bấm trùng trong 1 giờ). */
export function markCooked(id: string): void {
  const log = getStored<Record<string, number[]>>(COOKED_KEY, {})
  const times = log[id] ?? []
  if (times.length && Date.now() - times[times.length - 1] < 3600_000) return
  setStored(COOKED_KEY, { ...log, [id]: [...times, Date.now()].slice(-20) })
}

/** Số ngày kể từ lần nấu gần nhất (null nếu chưa nấu). */
export function daysSinceCooked(id: string): number | null {
  const times = getStored<Record<string, number[]>>(COOKED_KEY, {})[id]
  if (!times?.length) return null
  return Math.floor((Date.now() - times[times.length - 1]) / 86_400_000)
}

export const totalTime = (r: Recipe) => r.prepTime + r.cookTime

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu. */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

export function useAllRecipes(): Recipe[] {
  const [aiRecipes] = useStored<Recipe[]>(AI_RECIPES_KEY, [])
  return useMemo(() => [...SEED_RECIPES, ...aiRecipes], [aiRecipes])
}

export function useRecipe(id: string): Recipe | undefined {
  const all = useAllRecipes()
  return all.find((r) => r.id === id)
}

export function matchesOccasion(r: Recipe, occasion: Category | 'nhanh'): boolean {
  if (occasion === 'nhanh') return totalTime(r) <= 30
  return r.category === occasion || !!r.occasions?.includes(occasion)
}

/** Lưu công thức do AI tạo; giữ tối đa 30 món gần nhất (món đã thả tim thì không xoá). */
export function storeAIRecipes(recipes: Recipe[]): void {
  const saved = new Set(getStored<string[]>(SAVED_KEY, []))
  const existing = getStored<Recipe[]>(AI_RECIPES_KEY, [])
  const merged = [...recipes, ...existing.filter((e) => !recipes.some((r) => r.id === e.id))]
  const kept: Recipe[] = []
  let unsavedCount = 0
  for (const r of merged) {
    if (saved.has(r.id)) kept.push(r)
    else if (unsavedCount++ < 30) kept.push(r)
  }
  setStored(AI_RECIPES_KEY, kept)
}

/** Thêm nguyên liệu vào danh sách đi chợ, cộng dồn nếu trùng tên + đơn vị. */
export function addToShopping(ingredients: Ingredient[], recipeTitle: string): number {
  const list = [...getStored<ShoppingItem[]>(SHOPPING_KEY, [])]
  for (const ing of ingredients) {
    const key = fold(ing.name) + '|' + ing.unit.toLowerCase()
    const index = list.findIndex((i) => fold(i.name) + '|' + i.unit.toLowerCase() === key && !i.checked)
    if (index >= 0) {
      const item = list[index]
      list[index] = {
        ...item,
        amount: item.amount != null && ing.amount != null ? Math.round((item.amount + ing.amount) * 100) / 100 : item.amount ?? ing.amount,
        from: item.from.includes(recipeTitle) ? item.from : [...item.from, recipeTitle],
      }
    } else {
      list.push({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        aisle: ing.aisle,
        checked: false,
        from: recipeTitle ? [recipeTitle] : [],
      })
    }
  }
  setStored(SHOPPING_KEY, list)
  return ingredients.length
}

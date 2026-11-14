import type { Ingredient } from '../types/recipe'

const roundTo = (value: number, step: number) => Math.round(value / step) * step

const SPOON_UNITS = ['muỗng', 'thìa', 'chén', 'bát', 'cốc', 'ly']

/**
 * Quy đổi định lượng theo số khẩu phần và làm tròn "kiểu đi chợ":
 *  - g / ml: tròn 1 (dưới 10), tròn 5 (dưới 100), tròn 10; từ 1000 đổi sang kg / lít
 *  - muỗng, chén: tròn ¼ khi nhỏ hơn 1, còn lại tròn ½
 *  - đơn vị đếm (quả, củ, tép, cây…): tròn ½, tối thiểu ½
 */
export function scaleAmount(amount: number, unit: string, factor: number): { amount: number; unit: string } {
  const raw = amount * factor
  const u = unit.trim().toLowerCase()

  if (u === 'g' || u === 'ml') {
    if (raw >= 1000) return { amount: roundTo(raw / 1000, 0.05), unit: u === 'g' ? 'kg' : 'lít' }
    const step = raw < 10 ? 1 : raw < 100 ? 5 : 10
    return { amount: Math.max(roundTo(raw, step), 1), unit }
  }
  if (u === 'kg' || u === 'lít' || u === 'l') {
    if (raw < 1) return scaleAmount(raw * 1000, u === 'kg' ? 'g' : 'ml', 1)
    return { amount: roundTo(raw, 0.05), unit }
  }
  if (SPOON_UNITS.some((s) => u.startsWith(s))) {
    return { amount: raw < 1 ? Math.max(roundTo(raw, 0.25), 0.25) : roundTo(raw, 0.5), unit }
  }
  return { amount: Math.max(roundTo(raw, 0.5), 0.5), unit }
}

export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** "150 g", "0.5 quả", "2 muỗng canh", hoặc "vừa đủ" khi không có định lượng. */
export function formatAmount(amount: number | null, unit: string): string {
  if (amount == null) return unit || 'vừa đủ'
  return `${formatNumber(amount)} ${unit}`.trim()
}

export function scaleIngredient(ingredient: Ingredient, factor: number): Ingredient {
  if (ingredient.amount == null) return ingredient
  return { ...ingredient, ...scaleAmount(ingredient.amount, ingredient.unit, factor) }
}

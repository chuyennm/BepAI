import type { Aisle, Category, Course, DietFlag, Difficulty, Ingredient, IngredientGroup, Recipe, Region, WeatherMood } from '../types/recipe'

/**
 * Bộ dựng công thức dạng gọn để viết được nhiều món mà vẫn đúng interface Recipe.
 *  - Nguyên liệu: "Tên: 300 g; Tên khác: 2 mc; Rau thơm" (mc = muỗng canh, mcf = muỗng cà phê,
 *    dấu ? cuối tên = tuỳ chọn, "@quầy" cuối dòng để chỉ định quầy hàng).
 *  - Bước: "Nội dung ## mẹo". Thời lượng trong câu ("15 phút") tự thành hẹn giờ.
 */

const UNIT_ALIAS: Record<string, string> = { mc: 'muỗng canh', mcf: 'muỗng cà phê' }

const WORDS = {
  dairy: ['trứng', 'sữa', 'bơ', 'phô mai', 'kem tươi', 'parmesan', 'mozzarella'],
  drink: ['bia', 'rượu', 'nước dừa', 'soda', 'nước ngọt', 'vang'],
  seasoning: [
    'nước mắm', 'mắm', 'muối', 'đường', 'tiêu', 'dầu', 'tương', 'giấm', 'hạt nêm', 'nước màu', 'nước hàng', 'sa tế',
    'ngũ vị hương', 'quế', 'hồi', 'cà ri', 'mật ong', 'sốt', 'mayonnaise', 'mù tạt', 'bột nghệ', 'nước dùng',
    'nước cốt', 'oregano', 'húng tây', 'nguyệt quế', 'ớt bột', 'bột năng', 'bột bắp', 'mẻ', 'mirin', 'gochujang',
    'miso', 'viên cà ri', 'tương ớt', 'dấm', 'bột ngọt', 'bột canh', 'ngò khô',
  ],
  dry: [
    'khô', 'gạo', 'bún', 'mì', 'miến', 'phở', 'bánh', 'bột', 'đậu phộng', 'đậu xanh', 'đậu hũ', 'đậu phụ', 'mè',
    'nấm hương', 'mộc nhĩ', 'hành phi', 'nui', 'spaghetti', 'pasta', 'hủ tiếu', 'lạc', 'cơm', 'rong biển', 'kim chi',
    'lạp xưởng', 'vụn bánh mì',
  ],
  meat: [
    'thịt', 'sườn', 'gà', 'vịt', 'bò', 'heo', 'lợn', 'cá', 'tôm', 'mực', 'cua', 'ốc', 'nghêu', 'ngao', 'hến', 'giò',
    'chả', 'xương', 'thăn', 'ba chỉ', 'nạm', 'sụn', 'cánh', 'đùi', 'ức', 'bacon', 'nem chua', 'xúc xích', 'riêu',
  ],
}

/** Khớp theo nguyên từ (tránh "giòn" bị hiểu là "giò", "cái" thành "cá"). */
function hasAny(name: string, list: string[]): boolean {
  const padded = ` ${name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `
  return list.some((word) => padded.includes(` ${word} `))
}

export function inferAisle(name: string): Aisle {
  if (hasAny(name, WORDS.dairy)) return 'sua-trung'
  if (hasAny(name, WORDS.drink)) return 'do-uong'
  if (hasAny(name, WORDS.seasoning)) return 'gia-vi'
  if (hasAny(name, WORDS.dry)) return 'do-kho'
  if (hasAny(name, WORDS.meat)) return 'thit-ca'
  return 'rau-cu'
}

function parseIngredients(list: string, group: IngredientGroup): Ingredient[] {
  return list
    .split(';')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      let aisle: Aisle | undefined
      const text = raw.replace(/\s*@([a-z-]+)$/, (_, a: string) => ((aisle = a as Aisle), ''))
      const colon = text.lastIndexOf(':')
      let name = (colon < 0 ? text : text.slice(0, colon)).trim()
      const quantity = colon < 0 ? '' : text.slice(colon + 1).trim()
      const isOptional = name.endsWith('?')
      if (isOptional) name = name.slice(0, -1).trim()
      const match = /^([\d.]+)\s*(.*)$/.exec(quantity)
      const unit = match ? match[2].trim() : quantity
      return {
        name,
        amount: match ? parseFloat(match[1]) : null,
        unit: UNIT_ALIAS[unit] ?? (unit || 'vừa đủ'),
        aisle: aisle ?? inferAisle(name),
        group,
        isOptional: isOptional || undefined,
      }
    })
}

const UNIT_SECONDS: Record<string, number> = { giây: 1, phút: 60, tiếng: 3600, giờ: 3600 }

function firstDuration(text: string): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(giây|phút|tiếng|giờ)/i.exec(text)
  if (!m) return undefined
  return Math.round(parseFloat((m[2] ?? m[1]).replace(',', '.')) * UNIT_SECONDS[m[3].toLowerCase()])
}

export interface Extra {
  course?: Course
  occ?: Category[]
  good?: WeatherMood[]
  diet?: DietFlag[]
  tags?: string[]
  drinks?: string[]
  sides?: string[]
}

export function mk(
  id: string,
  title: string,
  emoji: string,
  region: Region,
  category: Category,
  meta: [prep: number, cook: number, servings: number, difficulty: Difficulty, kcal: number],
  description: string,
  main: string,
  seasoning: string,
  steps: string[],
  secrets: string[],
  extra: Extra = {},
): Recipe {
  return {
    id,
    title,
    slug: id,
    description,
    emoji,
    region,
    category,
    occasions: extra.occ,
    prepTime: meta[0],
    cookTime: meta[1],
    baseServings: meta[2],
    difficulty: meta[3],
    calories: meta[4],
    ingredients: [...parseIngredients(main, 'chinh'), ...parseIngredients(seasoning, 'gia-vi')],
    steps: steps.map((raw, i) => {
      const [instruction, tip] = raw.split('##').map((s) => s.trim())
      return { stepNumber: i + 1, instruction, durationSeconds: firstDuration(instruction), tip: tip || undefined }
    }),
    secrets,
    pairing: { drinks: extra.drinks ?? [], sides: extra.sides ?? [] },
    tags: extra.tags ?? [],
    course: extra.course,
    goodFor: extra.good,
    dietFlags: extra.diet,
    source: 'seed',
  }
}

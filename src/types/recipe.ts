export type Region = 'bac' | 'trung' | 'nam' | 'a' | 'au'
export type Category = 'com-nha' | 'mon-nhau' | 'an-sang' | 'tiec' | 'healthy'
export type Difficulty = 'de' | 'vua' | 'kho'

/** Quầy hàng ở chợ / siêu thị — dùng để gom danh sách đi chợ. */
export type Aisle = 'thit-ca' | 'rau-cu' | 'gia-vi' | 'do-kho' | 'sua-trung' | 'do-uong' | 'khac'

/** Nhóm hiển thị trong công thức. */
export type IngredientGroup = 'chinh' | 'gia-vi'

export interface Ingredient {
  name: string
  /** null = "vừa đủ / nêm theo khẩu vị", không tham gia tính khẩu phần. */
  amount: number | null
  unit: string
  aisle: Aisle
  group: IngredientGroup
  isOptional?: boolean
  note?: string
}

export interface Step {
  stepNumber: number
  instruction: string
  /** Thời lượng chính của bước (giây) — dùng cho nút hẹn giờ nhanh. */
  durationSeconds?: number
  tip?: string
}

export interface Pairing {
  drinks: string[]
  sides: string[]
}

/** Kiểu thời tiết mà món đặc biệt hợp. */
export type WeatherMood = 'nong' | 'mua' | 'lanh' | 'mat'

/** Đặc điểm dinh dưỡng cần lưu ý — dùng để cảnh báo theo bệnh lý trong gia đình. */
export type DietFlag =
  | 'man' // nhiều muối / nước mắm
  | 'ngot' // nhiều đường
  | 'beo' // nhiều mỡ, chiên rán
  | 'purin' // giàu đạm purin: thịt đỏ, hải sản, da, sụn
  | 'cay'
  | 'chua'
  | 'hai-san' // tôm, cua, cá, mắm tôm
  | 'dau-phong'
  | 'ruou'
  | 'tai-song' // chưa chín kỹ

export interface RecipeImage {
  url: string
  /** Tác giả + giấy phép (ảnh từ Wikimedia Commons). */
  credit: string
}

export interface Recipe {
  id: string
  title: string
  slug: string
  description: string
  emoji: string
  region: Region
  category: Category
  /** Các dịp khác mà món cũng hợp (ngoài category chính). */
  occasions?: Category[]
  /** Phút sơ chế (không tính thời gian ướp/ngâm chờ). */
  prepTime: number
  /** Phút nấu + chờ. */
  cookTime: number
  baseServings: number
  difficulty: Difficulty
  /** kcal cho 1 khẩu phần. */
  calories: number
  ingredients: Ingredient[]
  steps: Step[]
  /** Bí quyết ngon chuẩn vị. */
  secrets: string[]
  pairing: Pairing
  tags: string[]
  image?: RecipeImage
  goodFor?: WeatherMood[]
  dietFlags?: DietFlag[]
  source?: 'seed' | 'ai'
}

export const REGION_LABEL: Record<Region, string> = {
  bac: 'Miền Bắc',
  trung: 'Miền Trung',
  nam: 'Miền Nam',
  a: 'Món Á',
  au: 'Món Âu',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  'com-nha': 'Cơm gia đình',
  'mon-nhau': 'Món nhậu bén',
  'an-sang': 'Ăn sáng',
  tiec: 'Tiệc cuối tuần',
  healthy: 'Healthy / Eat Clean',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  de: 'Dễ',
  vua: 'Vừa',
  kho: 'Cỡ đầu bếp',
}

export const AISLE_LABEL: Record<Aisle, string> = {
  'thit-ca': 'Thịt, cá & hải sản',
  'rau-cu': 'Rau củ & trái cây',
  'gia-vi': 'Gia vị & nước chấm',
  'do-kho': 'Đồ khô, bún, mì',
  'sua-trung': 'Trứng, sữa & bơ',
  'do-uong': 'Đồ uống',
  khac: 'Khác',
}

export const AISLE_ORDER: Aisle[] = ['thit-ca', 'rau-cu', 'do-kho', 'sua-trung', 'gia-vi', 'do-uong', 'khac']

/**
 * Bối cảnh gia đình: số người, vùng miền, bệnh lý cần kiêng và thời tiết hiện tại.
 * Dùng để sắp xếp gợi ý, cảnh báo món không hợp và đưa vào prompt cho AI.
 * Tất cả lưu trên máy; chỉ có toạ độ thành phố được gửi tới Open-Meteo để lấy thời tiết.
 */
import { useEffect } from 'react'
import type { DietFlag, Recipe, WeatherMood } from '../types/recipe'
import { getStored, setStored, useStored } from './storage'

// ───────────────────────── Hồ sơ gia đình ─────────────────────────

export type HomeRegion = 'bac' | 'trung' | 'nam'

export type ConditionId =
  | 'tieu-duong'
  | 'huyet-ap'
  | 'mo-mau'
  | 'gout'
  | 'da-day'
  | 'than'
  | 'mang-thai'
  | 'tre-nho'
  | 'di-ung-hai-san'
  | 'di-ung-dau-phong'

export interface Profile {
  familySize: number
  cityId: string
  /** Toạ độ lấy từ GPS (nếu người dùng bấm "Dùng vị trí của tôi"). */
  coords: { lat: number; lon: number; label: string } | null
  conditions: ConditionId[]
  spicy: 'khong' | 'vua' | 'cay'
}

export const PROFILE_KEY = 'profile'
export const DEFAULT_PROFILE: Profile = { familySize: 4, cityId: 'hcm', coords: null, conditions: [], spicy: 'vua' }

export const CITIES: { id: string; name: string; region: HomeRegion; lat: number; lon: number }[] = [
  { id: 'hanoi', name: 'Hà Nội', region: 'bac', lat: 21.03, lon: 105.85 },
  { id: 'haiphong', name: 'Hải Phòng', region: 'bac', lat: 20.86, lon: 106.68 },
  { id: 'sapa', name: 'Lào Cai – Sa Pa', region: 'bac', lat: 22.34, lon: 103.84 },
  { id: 'vinh', name: 'Vinh – Nghệ An', region: 'trung', lat: 18.68, lon: 105.68 },
  { id: 'hue', name: 'Huế', region: 'trung', lat: 16.46, lon: 107.6 },
  { id: 'danang', name: 'Đà Nẵng', region: 'trung', lat: 16.05, lon: 108.2 },
  { id: 'nhatrang', name: 'Nha Trang', region: 'trung', lat: 12.24, lon: 109.19 },
  { id: 'dalat', name: 'Đà Lạt', region: 'trung', lat: 11.94, lon: 108.44 },
  { id: 'buonmathuot', name: 'Buôn Ma Thuột', region: 'trung', lat: 12.67, lon: 108.04 },
  { id: 'hcm', name: 'TP. Hồ Chí Minh', region: 'nam', lat: 10.78, lon: 106.7 },
  { id: 'bienhoa', name: 'Biên Hoà – Đồng Nai', region: 'nam', lat: 10.95, lon: 106.82 },
  { id: 'vungtau', name: 'Vũng Tàu', region: 'nam', lat: 10.35, lon: 107.08 },
  { id: 'cantho', name: 'Cần Thơ', region: 'nam', lat: 10.03, lon: 105.78 },
  { id: 'camau', name: 'Cà Mau', region: 'nam', lat: 9.18, lon: 105.15 },
]

export const HOME_REGION_LABEL: Record<HomeRegion, string> = { bac: 'miền Bắc', trung: 'miền Trung', nam: 'miền Nam' }

export const CONDITIONS: { id: ConditionId; label: string; emoji: string }[] = [
  { id: 'tieu-duong', label: 'Tiểu đường', emoji: '🩸' },
  { id: 'huyet-ap', label: 'Cao huyết áp', emoji: '❤️' },
  { id: 'mo-mau', label: 'Mỡ máu / tim mạch', emoji: '🫀' },
  { id: 'gout', label: 'Gout', emoji: '🦶' },
  { id: 'da-day', label: 'Đau dạ dày / trào ngược', emoji: '🔥' },
  { id: 'than', label: 'Bệnh thận', emoji: '💧' },
  { id: 'mang-thai', label: 'Đang mang thai', emoji: '🤰' },
  { id: 'tre-nho', label: 'Có trẻ nhỏ dưới 6 tuổi', emoji: '🧒' },
  { id: 'di-ung-hai-san', label: 'Dị ứng tôm cua cá', emoji: '🦐' },
  { id: 'di-ung-dau-phong', label: 'Dị ứng đậu phộng', emoji: '🥜' },
]

export const conditionLabel = (id: ConditionId) => CONDITIONS.find((c) => c.id === id)?.label ?? id

export function useProfile(): [Profile, (patch: Partial<Profile>) => void] {
  const [stored, setProfile] = useStored<Partial<Profile>>(PROFILE_KEY, DEFAULT_PROFILE)
  const profile = { ...DEFAULT_PROFILE, ...stored }
  return [profile, (patch) => setProfile((prev) => ({ ...DEFAULT_PROFILE, ...prev, ...patch }))]
}

export const getProfile = (): Profile => ({ ...DEFAULT_PROFILE, ...getStored<Partial<Profile>>(PROFILE_KEY, DEFAULT_PROFILE) })

export const profileCity = (p: Profile) => CITIES.find((c) => c.id === p.cityId) ?? CITIES[0]
export const profileRegion = (p: Profile): HomeRegion => profileCity(p).region
export const profilePlace = (p: Profile) => p.coords?.label ?? profileCity(p).name

// ───────────────────────── Cảnh báo theo bệnh lý ─────────────────────────

type Severity = 'tranh' | 'han-che'

/** Bệnh lý × đặc điểm món → mức độ + cách điều chỉnh. */
const RULES: Record<ConditionId, Partial<Record<DietFlag, [Severity, string]>>> = {
  'tieu-duong': {
    ngot: ['han-che', 'món dùng khá nhiều đường/mật. Giảm một nửa lượng đường, ăn kèm nhiều rau và bớt tinh bột.'],
  },
  'huyet-ap': {
    man: ['han-che', 'món đậm muối/nước mắm. Giảm 1/3–1/2 lượng mắm muối, không chan nước kho, nước chấm.'],
  },
  'mo-mau': {
    beo: ['han-che', 'nhiều mỡ động vật hoặc chiên rán. Chọn phần nạc, lọc bớt da mỡ, ưu tiên nướng/áp chảo ít dầu.'],
  },
  gout: {
    purin: ['han-che', 'giàu purin (thịt đỏ, da, sụn, hải sản). Chỉ nên ăn phần nhỏ, uống nhiều nước; tránh hẳn khi đang đau.'],
    ruou: ['tranh', 'có rượu bia trong món hoặc thường dùng kèm rượu bia — dễ kích cơn gout cấp.'],
    'hai-san': ['han-che', 'có hải sản — nhóm thực phẩm dễ làm tăng axit uric.'],
  },
  'da-day': {
    cay: ['han-che', 'có ớt/tiêu cay. Bỏ ớt, giảm tiêu khi nấu.'],
    chua: ['han-che', 'vị chua gắt (chanh, giấm, xoài xanh) dễ gây cồn cào. Không ăn lúc đói, giảm đồ chua.'],
    beo: ['han-che', 'nhiều dầu mỡ, chiên rán gây đầy bụng, trào ngược. Ăn lượng nhỏ.'],
  },
  than: {
    man: ['tranh', 'món mặn — người bệnh thận cần ăn nhạt. Nấu riêng phần nhạt, không dùng nước chấm.'],
    purin: ['han-che', 'lượng đạm cao. Ăn theo định mức đạm bác sĩ dặn.'],
  },
  'mang-thai': {
    'tai-song': ['tranh', 'có phần chưa chín kỹ. Nấu chín hoàn toàn (thịt bò chín kỹ, trứng chín).'],
    ruou: ['tranh', 'có rượu trong công thức. Bỏ rượu, thay bằng nước dùng.'],
  },
  'tre-nho': {
    cay: ['han-che', 'có ớt/tiêu cay. Múc riêng phần cho bé trước khi thêm ớt.'],
    ruou: ['tranh', 'có rượu trong công thức. Bỏ rượu khi nấu cho bé.'],
    'tai-song': ['tranh', 'có phần chưa chín kỹ. Nấu chín hoàn toàn phần của bé.'],
    man: ['han-che', 'khá mặn so với trẻ nhỏ. Nêm nhạt, không cho bé dùng nước chấm.'],
  },
  'di-ung-hai-san': {
    'hai-san': ['tranh', 'có tôm/cá/hải sản hoặc mắm làm từ hải sản. Không dùng cho người dị ứng.'],
  },
  'di-ung-dau-phong': {
    'dau-phong': ['tranh', 'có đậu phộng. Bỏ hẳn đậu phộng (thay bằng mè rang hoặc hành phi) và tránh lây chéo.'],
  },
}

export interface HealthWarning {
  condition: ConditionId
  severity: Severity
  advice: string
}

export function healthWarnings(recipe: Recipe, conditions: ConditionId[]): HealthWarning[] {
  const flags = recipe.dietFlags ?? []
  const warnings: HealthWarning[] = []
  for (const condition of conditions) {
    for (const flag of flags) {
      const rule = RULES[condition]?.[flag]
      if (rule) warnings.push({ condition, severity: rule[0], advice: rule[1] })
    }
  }
  return warnings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'tranh' ? -1 : 1))
}

// ───────────────────────── Thời tiết (Open-Meteo, không cần key) ─────────────────────────

export interface Weather {
  at: number
  place: string
  temp: number
  feels: number
  humidity: number
  rain: boolean
  code: number
}

const WEATHER_KEY = 'weather'
const WEATHER_TTL = 45 * 60 * 1000

function describeCode(code: number): { text: string; emoji: string } {
  if (code === 0) return { text: 'trời quang', emoji: '☀️' }
  if (code <= 2) return { text: 'ít mây', emoji: '🌤️' }
  if (code === 3) return { text: 'nhiều mây', emoji: '☁️' }
  if (code <= 48) return { text: 'sương mù', emoji: '🌫️' }
  if (code <= 57) return { text: 'mưa phùn', emoji: '🌦️' }
  if (code <= 67) return { text: 'mưa', emoji: '🌧️' }
  if (code <= 77) return { text: 'có tuyết', emoji: '❄️' }
  if (code <= 82) return { text: 'mưa rào', emoji: '🌧️' }
  return { text: 'mưa dông', emoji: '⛈️' }
}

export function weatherMood(w: Weather): WeatherMood {
  if (w.rain) return 'mua'
  if (w.feels >= 33 || w.temp >= 32) return 'nong'
  if (w.temp <= 20) return 'lanh'
  return 'mat'
}

export function weatherSummary(w: Weather): { emoji: string; headline: string; advice: string } {
  const { text, emoji } = describeCode(w.code)
  const headline = `${w.place} · ${Math.round(w.temp)}°C, ${text}`
  const advice = {
    nong: `Trời oi nóng (cảm giác ${Math.round(w.feels)}°C) — hợp gỏi, món trộn, đồ thanh mát, ít dầu mỡ.`,
    mua: 'Trời mưa — hợp món nóng hổi, kho, hầm, đồ nhắm giòn thơm.',
    lanh: 'Trời se lạnh — hợp món hầm, kho, áp chảo ấm bụng.',
    mat: 'Thời tiết dễ chịu — nấu gì cũng ngon, thử món mới nhé.',
  }[weatherMood(w)]
  return { emoji, headline, advice }
}

async function fetchWeather(lat: number, lon: number, place: string): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code&timezone=auto'
  const response = await fetch(url)
  if (!response.ok) throw new Error('weather')
  const { current } = (await response.json()) as {
    current: {
      temperature_2m: number
      apparent_temperature: number
      relative_humidity_2m: number
      precipitation: number
      weather_code: number
    }
  }
  return {
    at: Date.now(),
    place,
    temp: current.temperature_2m,
    feels: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    rain: current.precipitation > 0.1 || (current.weather_code >= 51 && current.weather_code !== 71),
    code: current.weather_code,
  }
}

let inflight: Promise<void> | null = null

export function refreshWeather(profile: Profile, force = false): Promise<void> {
  const place = profilePlace(profile)
  const cached = getStored<Weather | null>(WEATHER_KEY, null)
  if (!force && cached && cached.place === place && Date.now() - cached.at < WEATHER_TTL) return Promise.resolve()
  if (!navigator.onLine) return Promise.resolve()
  if (inflight) return inflight
  const { lat, lon } = profile.coords ?? profileCity(profile)
  inflight = fetchWeather(lat, lon, place)
    .then((weather) => setStored(WEATHER_KEY, weather))
    .catch(() => {
      /* không lấy được thời tiết: giữ bản cũ, app vẫn chạy bình thường */
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Thời tiết gần nhất (tự làm mới mỗi 45 phút khi có mạng). Bản quá 6 giờ coi như hết hạn. */
export function useWeather(profile: Profile): Weather | null {
  const [weather] = useStored<Weather | null>(WEATHER_KEY, null)
  const place = profilePlace(profile)
  useEffect(() => {
    void refreshWeather(profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place])
  if (!weather || weather.place !== place || Date.now() - weather.at > 6 * 60 * 60 * 1000) return null
  return weather
}

export const getWeather = (): Weather | null => {
  const weather = getStored<Weather | null>(WEATHER_KEY, null)
  return weather && Date.now() - weather.at < 6 * 60 * 60 * 1000 ? weather : null
}

/** Điểm phù hợp của một món với gia đình + thời tiết hôm nay (càng cao càng nên gợi ý). */
export function suitability(recipe: Recipe, profile: Profile, weather: Weather | null): number {
  let score = 0
  if (weather && recipe.goodFor?.includes(weatherMood(weather))) score += 3
  if (recipe.region === profileRegion(profile)) score += 1
  if (profile.spicy === 'khong' && recipe.dietFlags?.includes('cay')) score -= 1
  for (const w of healthWarnings(recipe, profile.conditions)) score -= w.severity === 'tranh' ? 4 : 1.5
  return score
}

/** Mô tả bối cảnh gia đình bằng lời — đưa vào prompt để AI gợi ý sát thực tế. */
export function householdContext(): string {
  const profile = getProfile()
  const weather = getWeather()
  const lines = [
    `- Gia đình ${profile.familySize} người, sống ở ${profilePlace(profile)} (${HOME_REGION_LABEL[profileRegion(profile)]}) — ưu tiên khẩu vị và nguyên liệu dễ mua ở vùng này.`,
    `- Khẩu vị cay: ${{ khong: 'không ăn cay', vua: 'cay vừa', cay: 'thích cay' }[profile.spicy]}.`,
  ]
  if (weather) {
    const { text } = describeCode(weather.code)
    lines.push(
      `- Thời tiết hiện tại: ${Math.round(weather.temp)}°C (cảm giác ${Math.round(weather.feels)}°C), ${text}, độ ẩm ${Math.round(weather.humidity)}%. Hãy chọn món hợp thời tiết này.`,
    )
  }
  const month = new Date().getMonth() + 1
  lines.push(`- Bây giờ là tháng ${month} — ưu tiên rau củ, hải sản đúng mùa.`)
  if (profile.conditions.length) {
    lines.push(
      `- QUAN TRỌNG — trong nhà có người: ${profile.conditions.map(conditionLabel).join(', ')}. Tránh món/nguyên liệu không hợp, điều chỉnh gia vị cho phù hợp và nói rõ lưu ý khi cần. Không thay thế lời khuyên của bác sĩ.`,
    )
  }
  return `Bối cảnh gia đình người dùng:\n${lines.join('\n')}`
}

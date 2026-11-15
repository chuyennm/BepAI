/**
 * BepAI Assistant — lớp tích hợp AI.
 *
 * - Gọi thẳng từ trình duyệt tới nhà cung cấp (không cần máy chủ riêng), API key
 *   chỉ lưu trong localStorage của thiết bị.
 * - Hỗ trợ Google Gemini (API gốc), DeepSeek và mọi dịch vụ tương thích OpenAI.
 * - Danh sách model được tải trực tiếp từ nhà cung cấp và tự chọn model rẻ, nhanh
 *   mới nhất — không ghi cứng tên model nên không bị lỗi thời.
 * - Trả lời dạng streaming; khi mất mạng hoặc chưa có key thì chuyển sang chế độ
 *   dự phòng dùng kiến thức có sẵn trong app.
 */
import { SEED_RECIPES } from '../data/recipes'
import { getProfile, getWeather, householdContext, suitability } from '../lib/household'
import { fold } from '../lib/recipes'
import { formatAmount, scaleIngredient } from '../lib/scaling'
import { getStored, setStored } from '../lib/storage'
import type { Aisle, Category, DietFlag, Difficulty, Ingredient, Recipe, Region, Step, WeatherMood } from '../types/recipe'

// ───────────────────────── Cấu hình nhà cung cấp ─────────────────────────

export type ProviderId = 'gemini' | 'deepseek' | 'custom'

export interface AISettings {
  provider: ProviderId
  apiKeys: Record<ProviderId, string>
  /** 'auto' = để app tự chọn model rẻ & mới nhất. */
  models: Record<ProviderId, string>
  customBaseUrl: string
}

export const AI_SETTINGS_KEY = 'ai-settings'

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  apiKeys: { gemini: '', deepseek: '', custom: '' },
  models: { gemini: 'auto', deepseek: 'auto', custom: 'auto' },
  customBaseUrl: 'https://openrouter.ai/api/v1',
}

export const PROVIDERS: Record<
  ProviderId,
  { label: string; blurb: string; keyUrl: string; keyHint: string; fallbackModel: string }
> = {
  gemini: {
    label: 'Google Gemini',
    blurb: 'Khuyên dùng: có gói miễn phí, nhanh, tiếng Việt tốt. App tự chọn dòng Flash-Lite rẻ nhất.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    fallbackModel: 'gemini-flash-lite-latest',
  },
  deepseek: {
    label: 'DeepSeek',
    blurb: 'Trả phí theo lượng dùng, giá rất rẻ. App tự chọn model chat thường (không dùng model suy luận đắt hơn).',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
    fallbackModel: 'deepseek-chat',
  },
  custom: {
    label: 'Tương thích OpenAI (OpenRouter, Groq…)',
    blurb: 'Nhập địa chỉ API và key của bất kỳ dịch vụ nào theo chuẩn OpenAI, rồi chọn model trong danh sách.',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-…',
    fallbackModel: '',
  },
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEEPSEEK_BASE = 'https://api.deepseek.com'

export function getAISettings(): AISettings {
  const stored = getStored<Partial<AISettings>>(AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS)
  return {
    ...DEFAULT_AI_SETTINGS,
    ...stored,
    apiKeys: { ...DEFAULT_AI_SETTINGS.apiKeys, ...stored.apiKeys },
    models: { ...DEFAULT_AI_SETTINGS.models, ...stored.models },
  }
}

const activeKey = (s: AISettings) => s.apiKeys[s.provider].trim()

const openAIBase = (s: AISettings) =>
  s.provider === 'deepseek' ? DEEPSEEK_BASE : s.customBaseUrl.trim().replace(/\/+$/, '')

/** Có thể gọi AI thật không (đã có key và đang có mạng)? */
export function isAIReady(settings = getAISettings()): boolean {
  return !!activeKey(settings) && navigator.onLine
}

export class AIError extends Error {}

async function toAIError(response: Response): Promise<AIError> {
  let detail = ''
  try {
    const body = await response.json()
    detail = body?.error?.message ?? body?.message ?? ''
  } catch {
    /* thân phản hồi không phải JSON */
  }
  const status = response.status
  let message: string
  if (status === 401 || status === 403 || (status === 400 && /api.?key/i.test(detail)))
    message = 'API key không hợp lệ hoặc chưa được cấp quyền. Kiểm tra lại trong Cài đặt.'
  else if (status === 402) message = 'Tài khoản AI đã hết số dư. Hãy nạp thêm hoặc đổi nhà cung cấp.'
  else if (status === 404) message = 'Model đang chọn không còn tồn tại. Vào Cài đặt bấm "Tải lại danh sách model".'
  else if (status === 429) message = 'Đã chạm giới hạn lượt gọi của nhà cung cấp AI. Chờ một lát rồi thử lại.'
  else if (status >= 500) message = 'Máy chủ AI đang bận. Thử lại sau ít phút.'
  else message = `AI trả về lỗi ${status}.`
  return new AIError(detail && status !== 401 ? `${message} (${detail.slice(0, 160)})` : message)
}

// ───────────────────────── Danh sách model (tải tự động) ─────────────────────────

interface ModelCache {
  at: number
  base: string
  ids: string[]
}
const MODEL_TTL = 24 * 60 * 60 * 1000
const modelCacheKey = (p: ProviderId) => `models:${p}`

const NOT_CHAT = /embed|image|imagen|tts|audio|live|veo|robotics|computer-use|aqa|whisper|moderation|rerank/i

export async function listModels(settings = getAISettings(), force = false): Promise<string[]> {
  const provider = settings.provider
  const key = activeKey(settings)
  const base = provider === 'gemini' ? GEMINI_BASE : openAIBase(settings)
  const cached = getStored<ModelCache | null>(modelCacheKey(provider), null)
  if (!force && cached && cached.base === base && Date.now() - cached.at < MODEL_TTL) return cached.ids
  if (!key) throw new AIError('Chưa nhập API key.')

  let ids: string[]
  if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })
    if (!res.ok) throw await toAIError(res)
    const body = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[]
    }
    ids = (body.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((id) => id.startsWith('gemini') && !NOT_CHAT.test(id))
  } else {
    if (!base) throw new AIError('Chưa nhập địa chỉ API.')
    const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (!res.ok) throw await toAIError(res)
    const body = (await res.json()) as { data?: { id: string }[] }
    ids = (body.data ?? []).map((m) => m.id).filter((id) => !NOT_CHAT.test(id))
  }
  ids.sort()
  setStored<ModelCache>(modelCacheKey(provider), { at: Date.now(), base, ids })
  return ids
}

/**
 * Chọn model rẻ + đủ tốt cho nấu ăn từ danh sách thật của nhà cung cấp.
 * Gemini: bản Flash-Lite ổn định có số phiên bản cao nhất, rồi mới tới Flash.
 * DeepSeek: model chat thường. Khác: model đầu tiên có chữ lite/mini/flash/haiku.
 */
export function pickAutoModel(provider: ProviderId, ids: string[]): string {
  if (provider === 'gemini') {
    for (const tier of ['flash-lite', 'flash']) {
      const pattern = new RegExp(`^gemini-(\\d+(?:\\.\\d+)?)-${tier}$`)
      const best = ids
        .map((id) => ({ id, version: parseFloat(pattern.exec(id)?.[1] ?? 'NaN') }))
        .filter((m) => !Number.isNaN(m.version))
        .sort((a, b) => b.version - a.version)[0]
      if (best) return best.id
    }
    return ids.find((id) => id === 'gemini-flash-lite-latest') ?? PROVIDERS.gemini.fallbackModel
  }
  if (provider === 'deepseek') {
    return (
      ids.find((id) => id === 'deepseek-chat') ??
      ids.find((id) => !/reason/i.test(id)) ??
      PROVIDERS.deepseek.fallbackModel
    )
  }
  return ids.find((id) => /lite|mini|flash|haiku|small/i.test(id)) ?? ids[0] ?? ''
}

export async function resolveModel(settings = getAISettings()): Promise<string> {
  const chosen = settings.models[settings.provider]
  if (chosen && chosen !== 'auto') return chosen
  try {
    const picked = pickAutoModel(settings.provider, await listModels(settings))
    if (picked) return picked
  } catch (err) {
    if (err instanceof AIError && !PROVIDERS[settings.provider].fallbackModel) throw err
  }
  const fallback = PROVIDERS[settings.provider].fallbackModel
  if (!fallback) throw new AIError('Chưa chọn model. Vào Cài đặt để tải danh sách và chọn model.')
  return fallback
}

// ───────────────────────── Gọi chat dạng streaming ─────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  system: string
  messages: ChatMessage[]
  json?: boolean
  temperature?: number
  signal?: AbortSignal
}

/** Đọc luồng Server-Sent Events, trả về phần dữ liệu của từng dòng `data:`. */
async function* readSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data:')) yield line.slice(5).trim()
    }
  }
  if (buffer.startsWith('data:')) yield buffer.slice(5).trim()
}

async function* streamGemini(model: string, key: string, req: ChatRequest): AsyncGenerator<string> {
  const response = await fetch(`${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    signal: req.signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  })
  if (!response.ok) throw await toAIError(response)
  for await (const data of readSSE(response)) {
    if (!data) continue
    try {
      const chunk = JSON.parse(data) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
      }
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) yield part.text
      }
    } catch {
      /* bỏ qua dòng không phải JSON */
    }
  }
}

async function* streamOpenAI(base: string, model: string, key: string, req: ChatRequest): AsyncGenerator<string> {
  const send = (withJsonMode: boolean) =>
    fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: req.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: req.temperature ?? 0.7,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
        ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
  let response = await send(!!req.json)
  // Một số dịch vụ không hỗ trợ response_format: thử lại không kèm.
  if (response.status === 400 && req.json) response = await send(false)
  if (!response.ok) throw await toAIError(response)
  for await (const data of readSSE(response)) {
    if (!data || data === '[DONE]') continue
    try {
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
      const text = chunk.choices?.[0]?.delta?.content
      if (text) yield text
    } catch {
      /* bỏ qua dòng keep-alive */
    }
  }
}

/** Gọi model đang cấu hình, trả về từng mẩu văn bản ngay khi có. */
export async function* streamChat(req: ChatRequest): AsyncGenerator<string> {
  const settings = getAISettings()
  const key = activeKey(settings)
  if (!key) throw new AIError('Chưa nhập API key.')
  const model = await resolveModel(settings)
  if (settings.provider === 'gemini') yield* streamGemini(model, key, req)
  else yield* streamOpenAI(openAIBase(settings), model, key, req)
}

/** Kiểm tra nhanh key + model: gửi một câu ngắn và trả về tên model đã dùng. */
export async function testConnection(): Promise<string> {
  const model = await resolveModel()
  let reply = ''
  for await (const chunk of streamChat({
    system: 'Trả lời thật ngắn bằng tiếng Việt.',
    messages: [{ role: 'user', content: 'Nói đúng một từ: "Ngon"' }],
    temperature: 0,
  })) {
    reply += chunk
    if (reply.length > 40) break
  }
  if (!reply.trim()) throw new AIError('Model không trả về nội dung. Hãy thử chọn model khác.')
  return model
}

// ───────────────────────── Prompt ─────────────────────────

const SYSTEM_CHEF = `Bạn là BepAI — bếp trưởng kiêm chuyên gia khoa học ẩm thực, am hiểu sâu món Việt ba miền (Bắc, Trung, Nam), món nhậu Việt, món Á (Thái, Hàn, Nhật, Hoa) và món Âu.
Nguyên tắc:
- Trả lời bằng tiếng Việt tự nhiên, gần gũi như người đứng bếp lâu năm; đi thẳng vào việc.
- Định lượng cụ thể (g, ml, muỗng canh, muỗng cà phê, quả, củ…), nhiệt độ và thời gian rõ ràng.
- Tôn trọng kỹ thuật gốc của món; khi thay thế nguyên liệu phải nói rõ hương vị thay đổi thế nào và điều chỉnh tỉ lệ ra sao.
- Luôn nhắc an toàn thực phẩm khi liên quan (thịt gà, hải sản phải chín kỹ; bảo quản; dị ứng).
- Chỉ bàn chuyện nấu nướng, đi chợ, dinh dưỡng, đồ uống. Câu hỏi ngoài lề thì khéo léo kéo về bếp.`

const RECIPE_SCHEMA = `Trả về DUY NHẤT một JSON object hợp lệ, không markdown, không lời dẫn, theo cấu trúc:
{"recipes":[Recipe, ...]}
Recipe = {
 "title": string,
 "description": string (1 câu gợi vị, tối đa 30 từ),
 "emoji": string (đúng 1 emoji món ăn),
 "region": "bac"|"trung"|"nam"|"a"|"au",
 "category": "com-nha"|"mon-nhau"|"an-sang"|"tiec"|"healthy",
 "prepTime": number (phút sơ chế),
 "cookTime": number (phút nấu, gồm cả ướp/chờ),
 "baseServings": number,
 "difficulty": "de"|"vua"|"kho",
 "calories": number (kcal mỗi khẩu phần),
 "ingredients": [{"name": string, "amount": number|null, "unit": string, "aisle": "thit-ca"|"rau-cu"|"gia-vi"|"do-kho"|"sua-trung"|"do-uong"|"khac", "group": "chinh"|"gia-vi", "isOptional": boolean}],
 "steps": [{"stepNumber": number, "instruction": string, "durationSeconds": number|null, "tip": string|null}],
 "secrets": [string] (2-3 bí quyết ngon chuẩn vị),
 "pairing": {"drinks": [string], "sides": [string]},
 "tags": [string],
 "goodFor": mảng con của ["nong","mua","lanh","mat"] (kiểu thời tiết hợp món: nóng / mưa / lạnh / mát),
 "dietFlags": mảng con của ["man","ngot","beo","purin","cay","chua","hai-san","dau-phong","ruou","tai-song"] (đặc điểm cần lưu ý: mặn, nhiều đường, nhiều mỡ/chiên, giàu purin, cay, chua gắt, có hải sản/cá/mắm tôm, có đậu phộng, có rượu, có phần chưa chín kỹ)
}
Quy tắc:
- "amount" là số thập phân (0.5, không viết "1/2"); null nếu "nêm vừa ăn".
- "unit" bằng tiếng Việt: g, ml, muỗng canh, muỗng cà phê, quả, củ, tép, cây, lá, lát…
- "group": "chinh" cho thịt cá, rau củ, tinh bột; "gia-vi" cho gia vị, nước sốt, hành tỏi ớt.
- Trong "instruction", mọi thời lượng viết dạng "15 phút", "30 giây", "2 tiếng" để app tạo nút hẹn giờ.
- "dietFlags" phải khai trung thực để app cảnh báo người bệnh; nếu gia đình có bệnh lý, hãy thiết kế món sao cho KHÔNG phạm các cờ liên quan.
- Mỗi món 4-7 bước, mỗi bước 1-3 câu rõ ràng, có dấu hiệu nhận biết chín.`

export type FridgeStyle = 'com-nha' | 'mon-nhau' | 'a' | 'au'

export const FRIDGE_STYLES: { id: FridgeStyle; label: string; emoji: string }[] = [
  { id: 'com-nha', label: 'Cơm nhà', emoji: '🍚' },
  { id: 'mon-nhau', label: 'Món nhậu', emoji: '🍻' },
  { id: 'a', label: 'Món Á', emoji: '🥢' },
  { id: 'au', label: 'Món Âu', emoji: '🍝' },
]

const STYLE_BRIEF: Record<FridgeStyle, string> = {
  'com-nha': 'bữa cơm gia đình Việt, dễ nấu, đưa cơm, cân bằng dinh dưỡng',
  'mon-nhau': 'món nhậu Việt đậm đà, "bén mồi", hợp ăn chung cả bàn với bia rượu',
  a: 'món Á (Thái, Hàn, Nhật, Hoa) với gia vị dễ mua ở Việt Nam',
  au: 'món Âu (pasta, áp chảo, nướng, salad) làm được bằng bếp gia đình',
}

// ───────────────────────── Chuẩn hoá JSON công thức ─────────────────────────

const REGIONS: Region[] = ['bac', 'trung', 'nam', 'a', 'au']
const CATEGORIES: Category[] = ['com-nha', 'mon-nhau', 'an-sang', 'tiec', 'healthy']
const DIFFICULTIES: Difficulty[] = ['de', 'vua', 'kho']
const MOODS: WeatherMood[] = ['nong', 'mua', 'lanh', 'mat']
const DIET_FLAGS: DietFlag[] = ['man', 'ngot', 'beo', 'purin', 'cay', 'chua', 'hai-san', 'dau-phong', 'ruou', 'tai-song']
const AISLES: Aisle[] = ['thit-ca', 'rau-cu', 'gia-vi', 'do-kho', 'sua-trung', 'do-uong', 'khac']

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback
const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback
const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => text(v)).filter(Boolean) : []

export const slugify = (title: string) =>
  fold(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Ép dữ liệu AI trả về vào đúng interface Recipe; trả null nếu thiếu phần cốt lõi. */
export function normalizeRecipe(raw: unknown, index: number, style: FridgeStyle): Recipe | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const title = text(r.title)
  const rawIngredients = Array.isArray(r.ingredients) ? r.ingredients : []
  const rawSteps = Array.isArray(r.steps) ? r.steps : []
  if (!title || rawIngredients.length < 2 || rawSteps.length < 2) return null

  const ingredients: Ingredient[] = rawIngredients
    .map((item): Ingredient | null => {
      if (!item || typeof item !== 'object') return null
      const i = item as Record<string, unknown>
      const name = text(i.name)
      if (!name) return null
      const amount = i.amount == null ? null : num(i.amount, NaN)
      return {
        name,
        amount: amount == null || Number.isNaN(amount) ? null : amount,
        unit: text(i.unit),
        aisle: oneOf(i.aisle, AISLES, 'khac'),
        group: oneOf(i.group, ['chinh', 'gia-vi'], 'chinh'),
        isOptional: i.isOptional === true,
      }
    })
    .filter((i): i is Ingredient => i !== null)

  const steps: Step[] = rawSteps
    .map((item): Omit<Step, 'stepNumber'> | null => {
      const s = (typeof item === 'string' ? { instruction: item } : item) as Record<string, unknown> | null
      const instruction = text(s?.instruction)
      if (!instruction) return null
      const duration = num(s?.durationSeconds, 0)
      return { instruction, durationSeconds: duration || undefined, tip: text(s?.tip) || undefined }
    })
    .filter((s): s is Omit<Step, 'stepNumber'> => s !== null)
    .map((s, i) => ({ ...s, stepNumber: i + 1 }))

  const pairing = (r.pairing ?? {}) as Record<string, unknown>
  const slug = slugify(title)
  const defaultRegion: Region = style === 'a' || style === 'au' ? style : 'nam'
  const defaultCategory: Category = style === 'mon-nhau' ? 'mon-nhau' : 'com-nha'
  return {
    id: `ai-${Date.now().toString(36)}-${index}-${slug}`.slice(0, 80),
    title,
    slug,
    description: text(r.description, 'Món do BepAI gợi ý từ nguyên liệu bạn đang có.'),
    emoji: text(r.emoji, '🍽️').slice(0, 8),
    region: oneOf(r.region, REGIONS, defaultRegion),
    category: oneOf(r.category, CATEGORIES, defaultCategory),
    prepTime: Math.round(num(r.prepTime, 15)),
    cookTime: Math.round(num(r.cookTime, 20)),
    baseServings: Math.min(Math.round(num(r.baseServings, 2)), 12),
    difficulty: oneOf(r.difficulty, DIFFICULTIES, 'de'),
    calories: Math.round(num(r.calories, 400)),
    ingredients,
    steps,
    secrets: strings(r.secrets),
    pairing: { drinks: strings(pairing.drinks), sides: strings(pairing.sides) },
    tags: strings(r.tags).slice(0, 6),
    goodFor: strings(r.goodFor).filter((m): m is WeatherMood => MOODS.includes(m as WeatherMood)),
    dietFlags: strings(r.dietFlags).filter((d): d is DietFlag => DIET_FLAGS.includes(d as DietFlag)),
    source: 'ai',
  }
}

function parseRecipesJSON(raw: string, style: FridgeStyle): Recipe[] {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new AIError('AI trả về dữ liệu không đúng định dạng. Hãy thử lại.')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    throw new AIError('AI trả về dữ liệu không đúng định dạng. Hãy thử lại.')
  }
  const list = Array.isArray((parsed as { recipes?: unknown }).recipes)
    ? ((parsed as { recipes: unknown[] }).recipes)
    : [parsed]
  const recipes = list
    .map((item, i) => normalizeRecipe(item, i, style))
    .filter((r): r is Recipe => r !== null)
  if (!recipes.length) throw new AIError('AI chưa tạo được công thức hợp lệ. Hãy mô tả nguyên liệu rõ hơn.')
  return recipes
}

// ───────────────────────── Tính năng A: Tủ lạnh có gì nấu nấy ─────────────────────────

export interface FridgeResult {
  recipes: Recipe[]
  /** true = kết quả từ chế độ dự phòng (không gọi AI). */
  mock: boolean
  notice?: string
}

const isNetworkFailure = (err: unknown) => err instanceof TypeError

function mockFridge(input: string, style: FridgeStyle, notice: string): FridgeResult {
  const words = fold(input)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !/^\d+g?$/.test(w) && !['con', 'it', 'nua', 'lon', 'mot', 'va', 'co'].includes(w))
  const profile = getProfile()
  const weather = getWeather()
  const scored = SEED_RECIPES.map((recipe) => {
    const haystack = fold(recipe.ingredients.map((i) => i.name).join(' ') + ' ' + recipe.title)
    let score = words.filter((w) => haystack.includes(w)).length * 2
    if (style === 'mon-nhau' && (recipe.category === 'mon-nhau' || recipe.occasions?.includes('mon-nhau'))) score += 3
    if (style === 'com-nha' && recipe.category === 'com-nha') score += 3
    if ((style === 'a' || style === 'au') && recipe.region === style) score += 3
    score += suitability(recipe, profile, weather)
    return { recipe, score }
  }).sort((a, b) => b.score - a.score)
  return { recipes: scored.slice(0, 2).map((s) => s.recipe), mock: true, notice }
}

export async function generateFromFridge(
  input: string,
  style: FridgeStyle,
  signal?: AbortSignal,
): Promise<FridgeResult> {
  const settings = getAISettings()
  if (!activeKey(settings))
    return mockFridge(
      input,
      style,
      'Chưa có API key nên BepAI gợi ý tạm các món có sẵn gần với nguyên liệu của bạn. Thêm key trong Cài đặt để AI sáng tạo công thức riêng.',
    )
  if (!navigator.onLine)
    return mockFridge(input, style, 'Đang mất mạng nên BepAI gợi ý các món có sẵn gần với nguyên liệu của bạn.')

  try {
    let raw = ''
    for await (const chunk of streamChat({
      system: `${SYSTEM_CHEF}\n\n${householdContext()}\n\n${RECIPE_SCHEMA}`,
      json: true,
      temperature: 0.8,
      signal,
      messages: [
        {
          role: 'user',
          content: input.trim()
            ? `Tủ lạnh nhà tôi đang có: ${input.trim()}
Phong cách mong muốn: ${STYLE_BRIEF[style]}.
Hãy tạo 2 công thức KHÁC NHAU, nấu được thật, tận dụng tối đa nguyên liệu trên, hợp với thời tiết và hoàn cảnh gia đình tôi. Gia vị cơ bản (muối, đường, nước mắm, dầu ăn, tiêu, tỏi, hành) coi như có sẵn; chỉ thêm tối đa 2-3 nguyên liệu phải mua. "baseServings" bằng đúng số người trong gia đình. Trả về JSON đúng cấu trúc đã quy định.`
            : `Hôm nay nhà tôi nên ăn gì? Phong cách mong muốn: ${STYLE_BRIEF[style]}.
Dựa vào thời tiết hiện tại, mùa, vùng miền và tình hình sức khoẻ gia đình tôi, ${
                style === 'com-nha'
                  ? 'hãy lên MỘT MÂM CƠM gồm đúng 3 công thức ăn cùng nhau: 1 món mặn, 1 món canh, 1 món rau'
                  : 'hãy tạo 2 công thức KHÁC NHAU'
              }, nấu được thật, nguyên liệu dễ mua ở chợ gần nhà. Trong "description" nói ngắn gọn vì sao món hợp hôm nay. "baseServings" bằng đúng số người trong gia đình. Trả về JSON đúng cấu trúc đã quy định.`,
        },
      ],
    })) {
      raw += chunk
    }
    return { recipes: parseRecipesJSON(raw, style), mock: false }
  } catch (err) {
    if (isNetworkFailure(err))
      return mockFridge(input, style, 'Không kết nối được tới AI nên BepAI gợi ý các món có sẵn gần với nguyên liệu của bạn.')
    throw err
  }
}

// ───────────────────────── Tính năng B: Trò chuyện theo công thức ─────────────────────────

export function quickPrompts(recipe: Recipe): string[] {
  const main = recipe.ingredients.filter((i) => i.group === 'chinh')
  const seasoning = recipe.ingredients.filter((i) => i.group === 'gia-vi' && !/muối|đường|dầu ăn|tiêu|nước$/i.test(i.name))
  const swap = seasoning[0] ?? main[1] ?? main[0]
  const protein = recipe.ingredients.find((i) => i.aisle === 'thit-ca') ?? main[0]
  const short = (name: string) => name.replace(/\s*\(.*\)/, '').toLowerCase()
  return [
    `Hết ${short(swap.name)} thì thay bằng gì?`,
    `Cách khử mùi tanh / sơ chế nhanh ${short(protein.name)}?`,
    'Điều chỉnh công thức này cho trẻ em / người ăn nhạt',
    recipe.category === 'mon-nhau' ? 'Làm trước được bao lâu, bảo quản thế nào?' : 'Món này bảo quản và hâm lại thế nào cho ngon?',
  ]
}

function recipeContext(recipe: Recipe, servings: number): string {
  const factor = servings / recipe.baseServings
  const ingredients = recipe.ingredients
    .map((i) => {
      const scaled = scaleIngredient(i, factor)
      return `- ${i.name}: ${formatAmount(scaled.amount, scaled.unit)}${i.isOptional ? ' (tuỳ chọn)' : ''}`
    })
    .join('\n')
  const steps = recipe.steps.map((s) => `${s.stepNumber}. ${s.instruction}`).join('\n')
  return `Người dùng đang xem công thức "${recipe.title}" cho ${servings} người.
Nguyên liệu:
${ingredients}
Các bước:
${steps}
Trả lời câu hỏi dựa trên đúng công thức này; ngắn gọn (tối đa khoảng 150 từ), dùng gạch đầu dòng khi liệt kê, không dùng bảng.`
}

const SUBSTITUTES: [RegExp, string][] = [
  [/nước mắm/, 'Nước mắm → nước tương + chút muối (nhạt mùi hơn), hoặc muối + ít nước cốt chanh. Giảm 1/3 lượng rồi nêm dần.'],
  [/mật mía/, 'Mật mía → đường thốt nốt hoặc đường nâu nấu chảy với chút nước; mật ong cũng được nhưng cho vào cuối để khỏi đắng.'],
  [/nước cốt me|(^|\s)me(\s|\?|$)/, 'Me / nước cốt me → nước cốt chanh + ít đường nâu, hoặc giấm gạo pha loãng. Vị chua sẽ gắt hơn, cho ít rồi nếm.'],
  [/mẻ/, 'Mẻ → sữa chua không đường hoặc nước cốt me loãng; giấm bỗng cũng rất hợp món Bắc.'],
  [/mắm tôm/, 'Mắm tôm → mắm ruốc Huế, hoặc nước mắm cốt + chút tôm khô giã. Mùi sẽ nhẹ hơn nhưng vẫn đậm đà.'],
  [/tắc|quất/, 'Tắc (quất) → chanh xanh hoặc chanh vàng, thêm vài lát vỏ cam để có mùi thơm tinh dầu.'],
  [/nước dừa/, 'Nước dừa tươi → nước lọc + nửa muỗng đường, hoặc nước ngọt có ga vị chanh (giảm đường trong công thức).'],
  [/kem tươi|whipping/, 'Kem tươi → sữa tươi không đường + 1 muỗng bơ, đun sánh lâu hơn; hoặc nước cốt dừa nếu chấp nhận vị dừa.'],
  [/rượu vang/, 'Rượu vang đỏ → nước dùng bò + 1 muỗng cà phê giấm balsamic/giấm gạo để có độ chua nhẹ.'],
  [/bơ lạt/, 'Bơ lạt → bơ mặn (giảm muối) hoặc dầu ô liu; mất mùi béo sữa nhưng vẫn áp chảo tốt.'],
  [/đường thốt nốt/, 'Đường thốt nốt → đường nâu hoặc đường vàng, thêm 1 muỗng cà phê mật ong cho hậu vị.'],
  [/(^|\s)sả/, 'Sả → vỏ chanh bào + vài lát gừng. Không giống hẳn nhưng vẫn cho mùi thơm tươi.'],
  [/riềng/, 'Riềng → gừng + chút vỏ chanh; vị sẽ cay ấm hơn và bớt nồng mùi riềng đặc trưng.'],
  [/lá chanh/, 'Lá chanh → vỏ chanh xanh bào sợi, cho vào cuối cùng.'],
  [/dầu hào/, 'Dầu hào → nước tương + chút đường + ít bột năng để tạo độ sánh.'],
  [/cá lóc/, 'Cá lóc → cá basa, cá trê hoặc cá thu cắt khoanh — chọn loại thịt chắc để kho không nát.'],
  [/bắp bò/, 'Bắp bò → nạm hoặc gân bò (kho lâu hơn 20-30 phút), không nên dùng thăn vì sẽ khô.'],
  [/chân giò/, 'Chân giò → ba chỉ có da hoặc sườn sụn; thời gian hầm giảm còn khoảng 25-30 phút.'],
  [/tôm tươi/, 'Tôm tươi → mực cắt khoanh hoặc ức gà thái mỏng; thời gian xào tương đương.'],
]

function mockChatAnswer(recipe: Recipe, question: string, offlineReason: string): string {
  const q = fold(question)
  const lines: string[] = []
  if (/thay|het |khong co|thieu/.test(q)) {
    const original = question.toLowerCase().normalize('NFC')
    const hits = SUBSTITUTES.filter(([pattern]) => pattern.test(original)).map(([, answer]) => answer)
    if (hits.length) lines.push(...[...new Set(hits)].slice(0, 2).map((h) => `• ${h}`))
    else
      lines.push(
        '• Nguyên tắc thay thế: giữ đúng "vai trò" của nguyên liệu — chua thay chua (chanh, me, giấm), ngọt thay ngọt (đường, mật ong), béo thay béo (bơ, dầu, nước cốt dừa).',
        '• Cho 2/3 lượng trước rồi nếm và chỉnh dần.',
      )
  } else if (/tanh|so che|khu mui|hoi/.test(q)) {
    lines.push(
      '• Cá: chà muối hột + giấm hoặc chanh, cạo sạch màng đen trong bụng, rửa lại nước lạnh và thấm khô.',
      '• Thịt heo, chân giò: chần nước sôi 2-3 phút với gừng đập dập và chút muối rồi rửa sạch.',
      '• Gà, chân gà: bóp muối + rượu trắng hoặc gừng giã, rửa lại.',
      '• Thịt bò: không rửa lâu dưới vòi; khử mùi bằng gừng nướng hoặc rượu gừng, thấm khô trước khi nấu.',
      '• Tôm, mực: ngâm nước muối loãng có vài lát gừng 5 phút.',
    )
  } else if (/tre em|an nhat|nhat|be |nguoi gia|it cay|khong cay/.test(q)) {
    lines.push(
      '• Giảm 1/3 đến 1/2 lượng nước mắm, muối; bù vị bằng hành tím phi, nước dùng xương hoặc chút nước dừa.',
      '• Bỏ ớt, tiêu, rượu khi nấu; người lớn tự thêm ở bát của mình.',
      '• Cắt nhỏ hơn và nấu mềm hơn 5-10 phút cho trẻ dễ nhai; lọc kỹ xương, sụn, vỏ.',
      '• Ưu tiên luộc, hấp, kho nhạt thay vì chiên ngập dầu.',
    )
  } else if (/bao quan|ham lai|de duoc|lam truoc|tu lanh/.test(q)) {
    lines.push(
      '• Để nguội hẳn trong vòng 2 tiếng rồi cho vào hộp kín, ngăn mát 2-3 ngày (món kho 4-5 ngày).',
      '• Gỏi, món trộn: để riêng nước trộn và rau thơm, khi ăn mới trộn.',
      '• Hâm món kho, hầm bằng lửa nhỏ, thêm 1-2 muỗng nước; món chiên hâm bằng nồi chiên không dầu 180°C khoảng 4 phút.',
    )
  } else {
    lines.push(
      `• Với "${recipe.title}", hãy bám sát phần Bí quyết ngon chuẩn vị ngay trong công thức.`,
      ...recipe.secrets.slice(0, 2).map((s) => `• ${s}`),
    )
  }
  return `${lines.join('\n')}\n\n_${offlineReason}_`
}

async function* typeOut(textToType: string): AsyncGenerator<string> {
  for (const word of textToType.split(/(?<=\s)/)) {
    await new Promise((resolve) => setTimeout(resolve, 18))
    yield word
  }
}

/**
 * Hỏi đáp trong ngữ cảnh một công thức. `history` kết thúc bằng câu hỏi mới nhất
 * của người dùng. Trả về từng mẩu câu trả lời (streaming).
 */
export async function* recipeChat(
  recipe: Recipe,
  servings: number,
  history: ChatMessage[],
  signal?: AbortSignal,
  stepNumber?: number,
): AsyncGenerator<string> {
  const question = history[history.length - 1]?.content ?? ''
  const settings = getAISettings()
  if (!activeKey(settings)) {
    yield* typeOut(mockChatAnswer(recipe, question, 'Trả lời nhanh từ sổ tay có sẵn. Thêm API key trong Cài đặt để hỏi đáp chi tiết với AI.'))
    return
  }
  if (!navigator.onLine) {
    yield* typeOut(mockChatAnswer(recipe, question, 'Đang mất mạng — đây là câu trả lời từ sổ tay có sẵn.'))
    return
  }
  let produced = false
  try {
    for await (const chunk of streamChat({
      system:
        `${SYSTEM_CHEF}\n\n${householdContext()}\n\n${recipeContext(recipe, servings)}` +
        (stepNumber
          ? `\nNgười dùng đang đứng bếp ở BƯỚC ${stepNumber}; ưu tiên xử lý tình huống ngay tại bước này, trả lời thật ngắn vì họ đang bận tay.`
          : ''),
      messages: history.slice(-10),
      temperature: 0.6,
      signal,
    })) {
      produced = true
      yield chunk
    }
  } catch (err) {
    if (isNetworkFailure(err) && !produced) {
      yield* typeOut(mockChatAnswer(recipe, question, 'Không kết nối được tới AI — đây là câu trả lời từ sổ tay có sẵn.'))
      return
    }
    throw err
  }
}

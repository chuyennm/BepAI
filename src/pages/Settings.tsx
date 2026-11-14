import { Check, Download, ExternalLink, Eye, EyeOff, LoaderCircle, LocateFixed, Minus, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../components/ui'
import { isIOS, isStandalone, toast, useInstallPrompt } from '../lib/app'
import { CITIES, CONDITIONS, HOME_REGION_LABEL, refreshWeather, useProfile, type ConditionId, type HomeRegion } from '../lib/household'
import { useStored } from '../lib/storage'
import {
  AIError,
  AI_SETTINGS_KEY,
  DEFAULT_AI_SETTINGS,
  PROVIDERS,
  getAISettings,
  listModels,
  pickAutoModel,
  testConnection,
  type AISettings,
  type ProviderId,
} from '../services/aiService'

const card = 'rounded-3xl border border-line bg-paper p-4'
const fieldLabel = 'text-xs font-bold tracking-wide text-ink/60 uppercase'
const input = 'h-12 w-full rounded-2xl border border-line bg-cream px-3.5 text-base outline-none focus:border-chili'

function FamilySection() {
  const [profile, setProfile] = useProfile()
  const [locating, setLocating] = useState(false)

  const toggleCondition = (id: ConditionId) =>
    setProfile({
      conditions: profile.conditions.includes(id) ? profile.conditions.filter((c) => c !== id) : [...profile.conditions, id],
    })

  const locate = () => {
    if (!navigator.geolocation) return toast('Thiết bị không hỗ trợ định vị')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // Chọn vùng miền theo thành phố gần nhất trong danh sách.
        const nearest = [...CITIES].sort(
          (a, b) =>
            Math.hypot(a.lat - coords.latitude, a.lon - coords.longitude) -
            Math.hypot(b.lat - coords.latitude, b.lon - coords.longitude),
        )[0]
        const next = {
          cityId: nearest.id,
          coords: { lat: coords.latitude, lon: coords.longitude, label: `Gần ${nearest.name}` },
        }
        setProfile(next)
        void refreshWeather({ ...profile, ...next }, true)
        setLocating(false)
        toast(`Đã lấy vị trí: gần ${nearest.name}`)
      },
      () => {
        setLocating(false)
        toast('Không lấy được vị trí — hãy chọn thành phố bên dưới')
      },
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <section className={card}>
      <h2 className="font-display text-xl font-bold">Gia đình tôi</h2>
      <p className="mt-0.5 text-sm text-ink/70">
        BepAI dùng thông tin này để tính khẩu phần, gợi ý theo thời tiết nơi bạn ở và cảnh báo món không hợp.
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className={fieldLabel}>Nhà có mấy người ăn</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Bớt một người" disabled={profile.familySize <= 1} onClick={() => setProfile({ familySize: profile.familySize - 1 })} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-cream disabled:opacity-40">
            <Minus size={18} />
          </button>
          <output className="w-10 text-center text-2xl font-bold">{profile.familySize}</output>
          <button type="button" aria-label="Thêm một người" disabled={profile.familySize >= 12} onClick={() => setProfile({ familySize: profile.familySize + 1 })} className="flex h-11 w-11 items-center justify-center rounded-full bg-chili text-white disabled:opacity-40">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <label className="mt-4 block">
        <span className={fieldLabel}>Nơi ở (để xem thời tiết & khẩu vị vùng miền)</span>
        <div className="mt-1.5 flex gap-2">
          <select
            value={profile.cityId}
            onChange={(e) => setProfile({ cityId: e.target.value, coords: null })}
            className={input}
          >
            {(['bac', 'trung', 'nam'] as HomeRegion[]).map((region) => (
              <optgroup key={region} label={HOME_REGION_LABEL[region].replace('miền', 'Miền')}>
                {CITIES.filter((c) => c.region === region).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" aria-label="Dùng vị trí hiện tại của tôi" onClick={locate} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-cream">
            {locating ? <LoaderCircle size={20} className="animate-spin" /> : <LocateFixed size={20} />}
          </button>
        </div>
        {profile.coords && <span className="mt-1 block text-xs text-herb">Đang dùng vị trí GPS: {profile.coords.label}</span>}
      </label>

      <fieldset className="mt-4">
        <legend className={fieldLabel}>Ăn cay</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {(
            [
              ['khong', 'Không cay'],
              ['vua', 'Cay vừa'],
              ['cay', 'Thích cay 🌶️'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={profile.spicy === id}
              onClick={() => setProfile({ spicy: id })}
              className={`h-11 rounded-2xl border text-sm font-semibold ${profile.spicy === id ? 'border-ink bg-ink text-white' : 'border-line bg-cream'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className={fieldLabel}>Trong nhà có người…</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CONDITIONS.map((c) => {
            const active = profile.conditions.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCondition(c.id)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold ${
                  active ? 'border-red-600 bg-red-600 text-white' : 'border-line bg-cream'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink/55">
          Cảnh báo dựa trên nguyên tắc dinh dưỡng chung, mang tính tham khảo và không thay cho tư vấn của bác sĩ. Thông tin chỉ
          lưu trên máy này; khi bạn hỏi AI, nó được gửi kèm câu hỏi tới nhà cung cấp AI bạn chọn.
        </p>
      </fieldset>
    </section>
  )
}

function AISection() {
  const [stored, setStored] = useStored<Partial<AISettings>>(AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS)
  const settings = getAISettings()
  void stored
  const provider = settings.provider
  const info = PROVIDERS[provider]
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const update = (patch: Partial<AISettings>) => setStored({ ...settings, ...patch })
  const key = settings.apiKeys[provider]

  const loadModels = async (force: boolean) => {
    if (!settings.apiKeys[provider].trim()) return setModels([])
    setLoadingModels(true)
    try {
      setModels(await listModels(getAISettings(), force))
      if (force) setStatus({ ok: true, text: 'Đã tải danh sách model mới nhất từ nhà cung cấp.' })
    } catch (err) {
      setModels([])
      if (force) setStatus({ ok: false, text: err instanceof AIError ? err.message : 'Không tải được danh sách model (kiểm tra mạng).' })
    } finally {
      setLoadingModels(false)
    }
  }

  // Tự tải danh sách model khi đổi nhà cung cấp hoặc sau khi nhập key (chờ ngừng gõ).
  useEffect(() => {
    setStatus(null)
    const timer = window.setTimeout(() => void loadModels(false), 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, key, settings.customBaseUrl])

  const test = async () => {
    setTesting(true)
    setStatus(null)
    try {
      const model = await testConnection()
      setStatus({ ok: true, text: `Kết nối tốt! Đang dùng model ${model}.` })
    } catch (err) {
      setStatus({ ok: false, text: err instanceof AIError ? err.message : 'Không kết nối được tới AI. Kiểm tra mạng và thử lại.' })
    } finally {
      setTesting(false)
    }
  }

  const auto = pickAutoModel(provider, models)

  return (
    <section className={card}>
      <h2 className="font-display text-xl font-bold">Trợ lý AI</h2>
      <p className="mt-0.5 text-sm text-ink/70">
        Không có key, app vẫn chạy với gợi ý có sẵn. Có key, BepAI tự sáng tạo công thức và trả lời mọi câu hỏi bếp núc.
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className={fieldLabel}>Nhà cung cấp</legend>
        {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => (
          <label
            key={id}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${
              provider === id ? 'border-chili bg-chili/5' : 'border-line bg-cream'
            }`}
          >
            <input type="radio" name="provider" checked={provider === id} onChange={() => update({ provider: id })} className="mt-1 h-4 w-4 accent-chili" />
            <span>
              <span className="block text-base font-bold">
                {PROVIDERS[id].label}
                {id === 'gemini' && <span className="ml-2 rounded-full bg-herb px-2 py-0.5 text-xs text-white">Khuyên dùng</span>}
              </span>
              <span className="block text-sm leading-snug text-ink/70">{PROVIDERS[id].blurb}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {provider === 'custom' && (
        <label className="mt-4 block">
          <span className={fieldLabel}>Địa chỉ API (base URL)</span>
          <input
            type="url"
            value={settings.customBaseUrl}
            onChange={(e) => update({ customBaseUrl: e.target.value })}
            placeholder="https://openrouter.ai/api/v1"
            className={`${input} mt-1.5`}
          />
        </label>
      )}

      <label className="mt-4 block">
        <span className="flex items-center justify-between">
          <span className={fieldLabel}>API key</span>
          <a href={info.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-chili-dark underline">
            Lấy key <ExternalLink size={14} />
          </a>
        </span>
        <span className="mt-1.5 flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => update({ apiKeys: { ...settings.apiKeys, [provider]: e.target.value.trim() } })}
            placeholder={info.keyHint}
            autoComplete="off"
            spellCheck={false}
            className={input}
          />
          <button type="button" aria-label={showKey ? 'Ẩn key' : 'Hiện key'} onClick={() => setShowKey((v) => !v)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-cream">
            {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </span>
        <span className="mt-1 block text-xs text-ink/55">
          Key chỉ lưu trên thiết bị này và chỉ gửi thẳng tới {info.label}. Đừng nhập key trên máy dùng chung.
        </span>
      </label>

      <label className="mt-4 block">
        <span className="flex items-center justify-between">
          <span className={fieldLabel}>Model</span>
          <button type="button" disabled={!key || loadingModels} onClick={() => void loadModels(true)} className="flex items-center gap-1 text-sm font-semibold text-chili-dark disabled:opacity-40">
            <RefreshCw size={14} className={loadingModels ? 'animate-spin' : ''} /> Tải lại danh sách model
          </button>
        </span>
        <select
          value={settings.models[provider]}
          onChange={(e) => update({ models: { ...settings.models, [provider]: e.target.value } })}
          className={`${input} mt-1.5`}
        >
          <option value="auto">
            Tự động chọn model rẻ & mới nhất{auto ? ` (hiện là ${auto})` : info.fallbackModel ? ` (${info.fallbackModel})` : ''}
          </option>
          {settings.models[provider] !== 'auto' && !models.includes(settings.models[provider]) && (
            <option value={settings.models[provider]}>{settings.models[provider]}</option>
          )}
          {models.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-ink/55">
          Danh sách lấy trực tiếp từ nhà cung cấp và tự làm mới mỗi ngày, nên không lo model cũ bị khai tử.
        </span>
      </label>

      <button
        type="button"
        disabled={!key || testing}
        onClick={() => void test()}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-bold text-white disabled:opacity-40"
      >
        {testing ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />} Kiểm tra kết nối
      </button>
      {status && (
        <p role="status" className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${status.ok ? 'bg-herb/10 text-herb' : 'bg-red-50 text-red-700'}`}>
          {status.text}
        </p>
      )}
    </section>
  )
}

function InstallSection() {
  const install = useInstallPrompt()
  const installed = isStandalone()
  return (
    <section className={card}>
      <h2 className="font-display text-xl font-bold">Cài BepAI lên điện thoại</h2>
      {installed ? (
        <p className="mt-1 text-sm font-semibold text-herb">Bạn đang dùng bản đã cài. Công thức và danh sách đi chợ xem được cả khi mất mạng.</p>
      ) : (
        <>
          <p className="mt-0.5 text-sm text-ink/70">Mở như một ứng dụng riêng, toàn màn hình, dùng được khi mất mạng.</p>
          {install ? (
            <button
              type="button"
              onClick={() => void install().then((ok) => ok && toast('Đã cài BepAI'))}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-chili text-base font-bold text-white"
            >
              <Download size={18} /> Cài đặt ứng dụng
            </button>
          ) : (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
              {isIOS() ? (
                <>
                  <li>Mở trang này bằng Safari.</li>
                  <li>Chạm nút Chia sẻ (ô vuông có mũi tên lên).</li>
                  <li>Chọn “Thêm vào Màn hình chính”.</li>
                </>
              ) : (
                <>
                  <li>Mở trang này bằng Chrome trên Android.</li>
                  <li>Chạm menu ⋮ ở góc trên bên phải.</li>
                  <li>Chọn “Thêm vào màn hình chính” hoặc “Cài đặt ứng dụng”.</li>
                </>
              )}
            </ol>
          )}
        </>
      )}
    </section>
  )
}

export default function Settings() {
  const clearAll = () => {
    if (!window.confirm('Xoá toàn bộ dữ liệu BepAI trên máy này (món đã lưu, ghi chú, danh sách đi chợ, hồ sơ gia đình, API key)? Không thể hoàn tác.')) return
    Object.keys(localStorage)
      .filter((k) => k.startsWith('bepai:'))
      .forEach((k) => localStorage.removeItem(k))
    window.location.reload()
  }
  return (
    <>
      <PageHeader title="Cài đặt" />
      <div className="space-y-4 px-4">
        <FamilySection />
        <AISection />
        <InstallSection />
        <section className={card}>
          <h2 className="font-display text-xl font-bold">Dữ liệu & nguồn</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            Mọi dữ liệu nằm trên thiết bị của bạn. Thời tiết lấy từ Open-Meteo (chỉ gửi toạ độ thành phố). Ảnh món ăn từ
            Wikimedia Commons theo giấy phép ghi dưới mỗi công thức.
          </p>
          <button type="button" onClick={clearAll} className="mt-3 text-sm font-semibold text-red-700 underline">
            Xoá toàn bộ dữ liệu trên máy này
          </button>
        </section>
        <p className="pb-2 text-center text-xs text-ink/45">BepAI 1.0 · Hôm nay nấu gì?</p>
      </div>
    </>
  )
}

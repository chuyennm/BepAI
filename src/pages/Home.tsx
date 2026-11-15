import { Heart, Refrigerator, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Chip, EmptyState, RecipeCard } from '../components/ui'
import { navigate } from '../hooks/useHashRoute'
import { profilePlace, suitability, useProfile, useWeather, weatherMood, weatherSummary } from '../lib/household'
import { fold, matchesOccasion, totalTime, useAllRecipes } from '../lib/recipes'
import { rankedMealSets } from '../lib/meals'
import { COURSE_LABEL, DIFFICULTY_LABEL, REGION_LABEL, type Category, type Course, type Difficulty, type Region } from '../types/recipe'

type Occasion = Category | 'nhanh'
type TimeBand = 'lt15' | '15-30' | '30-60' | 'gt60'

interface Filters {
  query: string
  region: Region | null
  occasion: Occasion | null
  difficulty: Difficulty | null
  time: TimeBand | null
  course: Course | null
}

const EMPTY: Filters = { query: '', region: null, occasion: null, difficulty: null, time: null, course: null }

const OCCASIONS: { id: Occasion; label: string; tone?: 'herb' | 'nhau' }[] = [
  { id: 'com-nha', label: '🍚 Cơm gia đình' },
  { id: 'mon-nhau', label: '🍻 Món nhậu bén', tone: 'nhau' },
  { id: 'nhanh', label: '⚡ Nhanh 15–30 phút' },
  { id: 'tiec', label: '🎉 Tiệc cuối tuần' },
  { id: 'healthy', label: '🌿 Healthy / Eat Clean', tone: 'herb' },
]

const TIME_BANDS: { id: TimeBand; label: string; test: (minutes: number) => boolean }[] = [
  { id: 'lt15', label: '< 15 phút', test: (m) => m < 15 },
  { id: '15-30', label: '15–30 phút', test: (m) => m >= 15 && m <= 30 },
  { id: '30-60', label: '30–60 phút', test: (m) => m > 30 && m <= 60 },
  { id: 'gt60', label: '> 1 giờ', test: (m) => m > 60 },
]

// Giữ bộ lọc khi người dùng mở một món rồi quay lại.
let remembered: Filters = EMPTY

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 10) return 'Sáng nay ăn gì?'
  if (hour < 14) return 'Trưa nay nấu gì?'
  if (hour < 21) return 'Tối nay nấu gì?'
  return 'Khuya rồi, làm mồi gì?'
}

export default function Home() {
  const recipes = useAllRecipes()
  const [filters, setFiltersState] = useState<Filters>(remembered)
  const [showMore, setShowMore] = useState(!!(remembered.difficulty || remembered.time || remembered.course))
  const setFilters = (patch: Partial<Filters>) =>
    setFiltersState((prev) => (remembered = { ...prev, ...patch }))
  const toggle = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters({ [key]: filters[key] === value ? null : value } as Partial<Filters>)

  const [profile] = useProfile()
  const weather = useWeather(profile)
  const mood = weather ? weatherMood(weather) : null
  const summary = weather ? weatherSummary(weather) : null
  const conditionKey = profile.conditions.join()

  const results = useMemo(() => {
    const q = fold(filters.query.trim())
    const matched = recipes.filter((r) => {
      if (filters.region && r.region !== filters.region) return false
      if (filters.occasion && !matchesOccasion(r, filters.occasion)) return false
      if (filters.course && r.course !== filters.course) return false
      if (filters.difficulty && r.difficulty !== filters.difficulty) return false
      if (filters.time && !TIME_BANDS.find((b) => b.id === filters.time)!.test(totalTime(r))) return false
      if (!q) return true
      const haystack = fold([r.title, r.description, ...r.tags, ...r.ingredients.map((i) => i.name)].join(' '))
      return q.split(/\s+/).every((word) => haystack.includes(word))
    })
    // Xếp món hợp thời tiết, hợp vùng và an toàn cho người bệnh trong nhà lên trước.
    return matched
      .map((recipe, index) => ({ recipe, index, score: suitability(recipe, profile, weather) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.recipe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, filters, weather, profile.cityId, profile.spicy, conditionKey])

  const activeCount = [filters.region, filters.occasion, filters.difficulty, filters.time, filters.course].filter(Boolean).length
  const todayMeals = rankedMealSets(recipes, profile, weather, 'com').slice(0, 5)
  const isFiltering = activeCount > 0 || filters.query.trim() !== ''

  return (
    <>
      <header className="px-4 pt-safe">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-chili">
            <img src="./icons/icon-192.png" alt="" className="h-7 w-7 rounded-lg" /> BEPAI
          </div>
          <button
            type="button"
            onClick={() => navigate('/saved')}
            className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 text-sm font-semibold"
          >
            <Heart size={16} className="text-chili" /> Đã lưu
          </button>
        </div>
        <h1 className="mt-2 font-display text-4xl leading-tight font-bold">{greeting()}</h1>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-line bg-paper p-3.5 text-left shadow-sm"
        >
          <span className="text-4xl" aria-hidden>
            {summary?.emoji ?? '🏠'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{summary?.headline ?? `Gia đình ở ${profilePlace(profile)}`}</span>
            <span className="block text-sm leading-snug text-ink/70">
              {summary?.advice ?? 'Chưa lấy được thời tiết — gợi ý theo vùng miền và gia đình bạn.'}
            </span>
            <span className="mt-1 block text-xs font-semibold text-chili-dark">
              Nhà {profile.familySize} người
              {profile.conditions.length > 0 ? ` · ${profile.conditions.length} lưu ý sức khoẻ` : ''} · Chỉnh hồ sơ ›
            </span>
          </span>
        </button>
      </header>

      <div className="sticky top-0 z-20 space-y-2.5 bg-cream/95 px-4 pt-3 pb-3 backdrop-blur">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-paper px-3.5 shadow-sm focus-within:border-chili">
            <Search size={20} className="shrink-0 text-ink/50" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => setFilters({ query: e.target.value })}
              placeholder="Tìm món, nguyên liệu… (vd: ba chỉ, kho)"
              className="h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-ink/40"
            />
            {filters.query && (
              <button type="button" aria-label="Xoá từ khoá" onClick={() => setFilters({ query: '' })}>
                <X size={18} className="text-ink/50" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-label="Bộ lọc độ khó và thời gian"
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
              showMore ? 'border-ink bg-ink text-white' : 'border-line bg-paper'
            }`}
          >
            <SlidersHorizontal size={20} />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-chili px-1 text-xs leading-5 font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {(Object.keys(REGION_LABEL) as Region[]).map((region) => (
            <Chip key={region} active={filters.region === region} onClick={() => toggle('region', region)}>
              {REGION_LABEL[region]}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {OCCASIONS.map((o) => (
            <Chip key={o.id} tone={o.tone} active={filters.occasion === o.id} onClick={() => toggle('occasion', o.id)}>
              {o.label}
            </Chip>
          ))}
        </div>
        {showMore && (
          <div className="animate-rise space-y-2.5">
            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
              <span className="shrink-0 text-xs font-bold text-ink/60 uppercase">Loại món</span>
              {(Object.keys(COURSE_LABEL) as Course[]).map((c) => (
                <Chip key={c} active={filters.course === c} onClick={() => toggle('course', c)}>
                  {COURSE_LABEL[c]}
                </Chip>
              ))}
            </div>
            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
              <span className="shrink-0 text-xs font-bold text-ink/60 uppercase">Độ khó</span>
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                <Chip key={d} active={filters.difficulty === d} onClick={() => toggle('difficulty', d)}>
                  {DIFFICULTY_LABEL[d]}
                </Chip>
              ))}
            </div>
            <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
              <span className="shrink-0 text-xs font-bold text-ink/60 uppercase">Thời gian</span>
              {TIME_BANDS.map((b) => (
                <Chip key={b.id} active={filters.time === b.id} onClick={() => toggle('time', b.id)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isFiltering && todayMeals.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between px-4">
            <h2 className="text-sm font-bold text-ink/70">Mâm cơm hợp hôm nay</h2>
            <button type="button" onClick={() => navigate('/mam')} className="text-sm font-semibold text-chili-dark underline underline-offset-2">
              Xem tất cả
            </button>
          </div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
            {todayMeals.map(({ meal, dishes }) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => navigate(`/mam/${meal.id}`)}
                className="w-60 shrink-0 rounded-3xl border border-line bg-paper p-4 text-left shadow-sm"
              >
                <span className="text-3xl">{meal.emoji}</span>
                <span className="mt-1 block font-display text-lg leading-tight font-bold">{meal.title}</span>
                <span className="mt-1 block text-sm leading-snug text-ink/70">{dishes.map((d) => d.title).join(' · ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink/70">
            {isFiltering ? `${results.length} món phù hợp` : 'Gợi ý cho bạn'}
          </h2>
          {isFiltering && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="text-sm font-semibold text-chili-dark underline underline-offset-2"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <EmptyState emoji="🔍" title="Chưa có món nào khớp">
            Thử bỏ bớt bộ lọc, hoặc để{' '}
            <button type="button" onClick={() => navigate('/ai')} className="font-semibold text-chili-dark underline">
              BepAI tạo món mới
            </button>{' '}
            từ nguyên liệu bạn có.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {results.map((recipe, index) => (
              <FragmentWithPromo key={recipe.id} showPromo={!isFiltering && index === 3}>
                <RecipeCard
                  recipe={recipe}
                  featured={index === 0}
                  weatherMatch={!!mood && !!recipe.goodFor?.includes(mood)}
                />
              </FragmentWithPromo>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/** Chèn ô "Tủ lạnh có gì nấu nấy" vào giữa lưới bento. */
function FragmentWithPromo({ showPromo, children }: { showPromo: boolean; children: React.ReactNode }) {
  return (
    <>
      {showPromo && (
        <button
          type="button"
          onClick={() => navigate('/ai')}
          className="col-span-2 flex items-center gap-4 rounded-3xl bg-ink p-5 text-left text-white shadow-sm transition active:scale-[0.99] sm:col-span-3"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-chili">
            <Refrigerator size={28} />
          </span>
          <span>
            <span className="block font-display text-xl font-bold">Tủ lạnh có gì nấu nấy</span>
            <span className="mt-0.5 block text-sm text-white/75">
              Kể cho BepAI nghe nhà còn gì — nhận ngay công thức nấu được.
            </span>
          </span>
        </button>
      )}
      {children}
    </>
  )
}

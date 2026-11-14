import { Clock, Flame, Heart, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { navigate } from '../hooks/useHashRoute'
import { healthWarnings, useProfile } from '../lib/household'
import { SAVED_KEY, totalTime } from '../lib/recipes'
import { useStored } from '../lib/storage'
import { formatMinutes } from '../lib/timeParse'
import { CATEGORY_LABEL, DIFFICULTY_LABEL, REGION_LABEL, type Recipe, type Region } from '../types/recipe'

const REGION_GRADIENT: Record<Region, string> = {
  bac: 'linear-gradient(135deg,#ffedd5,#fdba74)',
  trung: 'linear-gradient(135deg,#fee2e2,#fca5a5)',
  nam: 'linear-gradient(135deg,#dcfce7,#86efac)',
  a: 'linear-gradient(135deg,#fef3c7,#fcd34d)',
  au: 'linear-gradient(135deg,#f1f5f9,#cbd5e1)',
}

/** Bìa món: ảnh thật nếu có (tải lười, lỗi mạng thì rơi về bìa minh hoạ theo vùng miền). */
export function Cover({ recipe, className = '' }: { recipe: Recipe; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: REGION_GRADIENT[recipe.region] }}
    >
      <span aria-hidden className="absolute -right-4 -bottom-6 text-[7rem] opacity-15 select-none">
        {recipe.emoji}
      </span>
      <span aria-hidden className="text-6xl drop-shadow-sm select-none">
        {recipe.emoji}
      </span>
      {recipe.image && !failed && (
        <img
          src={recipe.image.url}
          alt={recipe.title}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  )
}

export function Badges({ recipe }: { recipe: Recipe }) {
  const isNhau = recipe.category === 'mon-nhau'
  const isHealthy = recipe.category === 'healthy' || recipe.occasions?.includes('healthy')
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
        {REGION_LABEL[recipe.region]}
      </span>
      {isNhau && (
        <span className="rounded-full bg-nhau px-2.5 py-0.5 text-xs font-semibold text-white">🍻 Món nhậu</span>
      )}
      {isHealthy && (
        <span className="rounded-full bg-herb px-2.5 py-0.5 text-xs font-semibold text-white">🌿 Healthy</span>
      )}
      {!isNhau && recipe.category !== 'healthy' && (
        <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-semibold">
          {CATEGORY_LABEL[recipe.category]}
        </span>
      )}
      {recipe.source === 'ai' && (
        <span className="rounded-full bg-chili/10 px-2.5 py-0.5 text-xs font-semibold text-chili-dark">✨ AI tạo</span>
      )}
    </div>
  )
}

export function SaveButton({ id, className = '' }: { id: string; className?: string }) {
  const [saved, setSaved] = useStored<string[]>(SAVED_KEY, [])
  const active = saved.includes(id)
  return (
    <button
      type="button"
      aria-label={active ? 'Bỏ lưu món này' : 'Lưu món này'}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 shadow-sm backdrop-blur transition active:scale-90 ${className}`}
    >
      <Heart size={20} className={active ? 'fill-chili text-chili' : 'text-ink'} />
    </button>
  )
}

export function RecipeCard({
  recipe,
  featured = false,
  weatherMatch = false,
}: {
  recipe: Recipe
  featured?: boolean
  weatherMatch?: boolean
}) {
  const [profile] = useProfile()
  const warnings = healthWarnings(recipe, profile.conditions)
  const mustAvoid = warnings.some((w) => w.severity === 'tranh')
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/r/${recipe.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/r/${recipe.id}`)}
      className={`group relative flex cursor-pointer overflow-hidden rounded-3xl border border-line bg-paper shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-chili ${
        featured ? 'col-span-2 flex-col sm:flex-row' : 'flex-col'
      }`}
    >
      <Cover recipe={recipe} className={featured ? 'h-40 sm:h-auto sm:w-2/5' : 'h-28 sm:h-32'} />
      <SaveButton id={recipe.id} className="absolute top-2.5 right-2.5" />
      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <Badges recipe={recipe} />
        <h3 className={`font-display leading-tight font-bold ${featured ? 'text-2xl' : 'text-lg'}`}>{recipe.title}</h3>
        {featured && <p className="text-sm leading-relaxed text-ink/75">{recipe.description}</p>}
        {(weatherMatch || warnings.length > 0) && (
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {weatherMatch && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">Hợp thời tiết hôm nay</span>}
            {warnings.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  mustAvoid ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                }`}
              >
                <TriangleAlert size={12} /> {mustAvoid ? 'Có người cần tránh' : 'Cần điều chỉnh'}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs font-medium text-ink/70">
          <span className="inline-flex items-center gap-1">
            <Clock size={14} /> {formatMinutes(totalTime(recipe))}
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame size={14} /> {recipe.calories} kcal
          </span>
          <span>{DIFFICULTY_LABEL[recipe.difficulty]}</span>
        </div>
      </div>
    </article>
  )
}

export function Chip({
  active,
  onClick,
  children,
  tone = 'chili',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'chili' | 'herb' | 'nhau'
}) {
  const activeClass = { chili: 'bg-chili border-chili', herb: 'bg-herb border-herb', nhau: 'bg-nhau border-nhau' }[tone]
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
        active ? `${activeClass} text-white` : 'border-line bg-paper text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-safe pb-3">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink/70">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-4 rounded-3xl border border-dashed border-line bg-paper px-6 py-10 text-center">
      <div className="text-5xl">{emoji}</div>
      <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
      {children && <div className="mt-2 text-sm leading-relaxed text-ink/70">{children}</div>}
    </div>
  )
}

/** Hiển thị văn bản AI: **đậm**, _nghiêng_ và gạch đầu dòng — không cần thư viện markdown. */
export function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2)
        return (
          <em key={i} className="text-ink/60">
            {part.slice(1, -1)}
          </em>
        )
      return part
    })
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null
        const bullet = /^([*\-•]|\d+[.)])\s+/.exec(trimmed)
        const heading = /^#{1,4}\s+/.exec(trimmed)
        if (heading) return <p key={i} className="font-bold">{inline(trimmed.slice(heading[0].length))}</p>
        if (bullet)
          return (
            <div key={i} className="flex gap-2">
              <span className="font-bold text-chili">{/^\d/.test(bullet[1]) ? bullet[1] : '•'}</span>
              <span>{inline(trimmed.slice(bullet[0].length))}</span>
            </div>
          )
        return <p key={i}>{inline(trimmed)}</p>
      })}
    </div>
  )
}

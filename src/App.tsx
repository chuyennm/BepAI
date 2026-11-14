import { Compass, Heart, Settings as SettingsIcon, ShoppingBasket, Sparkles, WifiOff } from 'lucide-react'
import { useEffect } from 'react'
import { navigate, useHashRoute, type Route } from './hooks/useHashRoute'
import { useOnline, useToast } from './lib/app'
import { SHOPPING_KEY, type ShoppingItem } from './lib/recipes'
import { useStored } from './lib/storage'
import Assistant from './pages/Assistant'
import CookMode from './pages/CookMode'
import Home from './pages/Home'
import RecipeDetail from './pages/RecipeDetail'
import Saved from './pages/Saved'
import Settings from './pages/Settings'
import Shopping from './pages/Shopping'

const TABS: { route: Route['name']; path: string; label: string; icon: typeof Compass }[] = [
  { route: 'home', path: '/', label: 'Khám phá', icon: Compass },
  { route: 'ai', path: '/ai', label: 'BepAI', icon: Sparkles },
  { route: 'shop', path: '/shop', label: 'Đi chợ', icon: ShoppingBasket },
  { route: 'saved', path: '/saved', label: 'Đã lưu', icon: Heart },
  { route: 'settings', path: '/settings', label: 'Cài đặt', icon: SettingsIcon },
]

function BottomNav({ current }: { current: Route['name'] }) {
  const [shopping] = useStored<ShoppingItem[]>(SHOPPING_KEY, [])
  const pending = shopping.filter((i) => !i.checked).length
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-safe backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map(({ route, path, label, icon: Icon }) => {
          const active = current === route
          return (
            <li key={route} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(path)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold ${
                  active ? 'text-chili' : 'text-ink/60'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
                {route === 'shop' && pending > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-chili px-1 text-[10px] leading-4 text-white">
                    {pending}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default function App() {
  const route = useHashRoute()
  const online = useOnline()
  const toastMessage = useToast()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name, 'id' in route ? route.id : ''])

  if (route.name === 'cook') return <CookMode id={route.id} />

  const showNav = route.name !== 'recipe'
  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-xs font-semibold text-white">
          <WifiOff size={14} /> Đang ngoại tuyến — công thức, ghi chú và danh sách đi chợ vẫn dùng bình thường
        </div>
      )}
      <main className={showNav ? 'pb-24' : ''}>
        {route.name === 'home' && <Home />}
        {route.name === 'recipe' && <RecipeDetail key={route.id} id={route.id} />}
        {route.name === 'ai' && <Assistant />}
        {route.name === 'shop' && <Shopping />}
        {route.name === 'saved' && <Saved />}
        {route.name === 'settings' && <Settings />}
      </main>
      {showNav && <BottomNav current={route.name} />}
      {toastMessage && (
        <div
          role="status"
          className="animate-rise fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}

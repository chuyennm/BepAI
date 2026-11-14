import { Trash2 } from 'lucide-react'
import { EmptyState, PageHeader, RecipeCard } from '../components/ui'
import { navigate } from '../hooks/useHashRoute'
import { AI_RECIPES_KEY, SAVED_KEY, useAllRecipes } from '../lib/recipes'
import { useStored } from '../lib/storage'
import type { Recipe } from '../types/recipe'

export default function Saved() {
  const all = useAllRecipes()
  const [saved] = useStored<string[]>(SAVED_KEY, [])
  const [aiRecipes, setAIRecipes] = useStored<Recipe[]>(AI_RECIPES_KEY, [])
  const [notes] = useStored<Record<string, string>>('notes', {})

  const savedRecipes = saved.map((id) => all.find((r) => r.id === id)).filter((r): r is Recipe => !!r)
  const withNotes = all.filter((r) => notes[r.id]?.trim() && !saved.includes(r.id))
  const unsavedAI = aiRecipes.filter((r) => !saved.includes(r.id))

  return (
    <>
      <PageHeader title="Đã lưu" subtitle="Xem được cả khi không có mạng" />
      <div className="space-y-6 px-4">
        {savedRecipes.length === 0 ? (
          <div className="-mx-4">
            <EmptyState emoji="🤍" title="Chưa lưu món nào">
              Chạm biểu tượng trái tim trên món bạn thích để cất vào đây.
              <button type="button" onClick={() => navigate('/')} className="mt-3 block w-full font-semibold text-chili-dark underline">
                Khám phá công thức
              </button>
            </EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {savedRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}

        {withNotes.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold">Món bạn có ghi chú</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {withNotes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </section>
        )}

        {unsavedAI.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Công thức AI đã tạo</h2>
              <button
                type="button"
                onClick={() =>
                  window.confirm('Xoá các công thức AI chưa thả tim?') &&
                  setAIRecipes((list) => list.filter((r) => saved.includes(r.id)))
                }
                className="flex items-center gap-1 text-sm font-semibold text-chili-dark"
              >
                <Trash2 size={15} /> Dọn
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {unsavedAI.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

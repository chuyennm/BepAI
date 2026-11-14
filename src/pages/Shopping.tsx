import { Check, Plus, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, PageHeader } from '../components/ui'
import { navigate } from '../hooks/useHashRoute'
import { toast } from '../lib/app'
import { addToShopping, fold, SHOPPING_KEY, type ShoppingItem } from '../lib/recipes'
import { formatAmount } from '../lib/scaling'
import { useStored } from '../lib/storage'
import { AISLE_LABEL, AISLE_ORDER, type Aisle } from '../types/recipe'

/** Đoán quầy hàng cho món người dùng tự gõ. */
function guessAisle(name: string): Aisle {
  const n = fold(name)
  if (/thit|ga|bo|heo|lon|ca |ca$|tom|muc|cua|suon|gio|xuc xich/.test(n)) return 'thit-ca'
  if (/rau|cu |cu$|qua|trai|hanh|toi|ot|chanh|ca chua|nam|gung|sa$|sa /.test(n)) return 'rau-cu'
  if (/trung|sua|bo lat|pho mai|kem/.test(n)) return 'sua-trung'
  if (/mam|muoi|duong|tieu|dau an|dau hao|tuong|giam|bot ngot|hat nem/.test(n)) return 'gia-vi'
  if (/gao|bun|mi|mien|pho|bot|dau phong|me |banh/.test(n)) return 'do-kho'
  if (/bia|ruou|nuoc|tra|ca phe/.test(n)) return 'do-uong'
  return 'khac'
}

export default function Shopping() {
  const [items, setItems] = useStored<ShoppingItem[]>(SHOPPING_KEY, [])
  const [draft, setDraft] = useState('')

  const pending = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)
  const toggle = (id: string) => setItems((list) => list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)))

  const addManual = () => {
    const name = draft.trim()
    if (!name) return
    addToShopping([{ name, amount: null, unit: '', aisle: guessAisle(name), group: 'chinh' }], '')
    setDraft('')
  }

  const share = async () => {
    const text =
      'Danh sách đi chợ (BepAI)\n' +
      AISLE_ORDER.map((aisle) => {
        const group = pending.filter((i) => i.aisle === aisle)
        if (!group.length) return ''
        return `\n${AISLE_LABEL[aisle]}:\n${group.map((i) => `☐ ${i.name}${i.amount != null ? ` — ${formatAmount(i.amount, i.unit)}` : ''}`).join('\n')}`
      })
        .filter(Boolean)
        .join('\n')
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Đã chép danh sách vào bộ nhớ tạm')
      }
    } catch {
      /* người dùng huỷ chia sẻ */
    }
  }

  const row = (item: ShoppingItem) => (
    <li key={item.id}>
      <label className="flex min-h-13 cursor-pointer items-center gap-3 py-2">
        <input type="checkbox" checked={item.checked} onChange={() => toggle(item.id)} className="peer sr-only" />
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-chili ${
            item.checked ? 'border-herb bg-herb text-white' : 'border-ink/30'
          }`}
        >
          {item.checked && <Check size={18} strokeWidth={3} />}
        </span>
        <span className={`min-w-0 flex-1 ${item.checked ? 'text-ink/45 line-through' : ''}`}>
          <span className="block text-base leading-snug font-medium">{item.name}</span>
          {item.from.length > 0 && <span className="block truncate text-xs text-ink/55">{item.from.join(' · ')}</span>}
        </span>
        {item.amount != null && (
          <span className={`shrink-0 text-base font-bold tabular-nums ${item.checked ? 'text-ink/45' : ''}`}>
            {formatAmount(item.amount, item.unit)}
          </span>
        )}
      </label>
    </li>
  )

  return (
    <>
      <PageHeader
        title="Đi chợ"
        subtitle={items.length ? `${pending.length} món cần mua · ${done.length} đã xong` : 'Danh sách tự gom theo quầy hàng'}
        action={
          pending.length > 0 && (
            <button type="button" aria-label="Chia sẻ danh sách" onClick={() => void share()} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper">
              <Share2 size={20} />
            </button>
          )
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          addManual()
        }}
        className="mx-4 mb-4 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Thêm món cần mua…"
          aria-label="Thêm món cần mua"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-chili"
        />
        <button type="submit" aria-label="Thêm" disabled={!draft.trim()} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chili text-white disabled:opacity-40">
          <Plus size={22} />
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState emoji="🧺" title="Giỏ còn trống">
          Mở một công thức, đánh dấu thứ nhà đã có rồi bấm “Thêm món còn thiếu vào danh sách đi chợ”.
          <button type="button" onClick={() => navigate('/')} className="mt-3 block w-full font-semibold text-chili-dark underline">
            Xem công thức
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-4 px-4">
          {AISLE_ORDER.map((aisle) => {
            const group = pending.filter((i) => i.aisle === aisle)
            if (!group.length) return null
            return (
              <section key={aisle} className="rounded-3xl border border-line bg-paper px-4 py-3">
                <h2 className="text-xs font-bold tracking-wide text-chili-dark uppercase">
                  {AISLE_LABEL[aisle]} · {group.length}
                </h2>
                <ul className="divide-y divide-line">{group.map(row)}</ul>
              </section>
            )
          })}

          {pending.length === 0 && (
            <p className="rounded-3xl bg-herb/10 px-4 py-4 text-center font-semibold text-herb">Đã mua đủ hết rồi. Về bếp thôi!</p>
          )}

          {done.length > 0 && (
            <section className="rounded-3xl border border-line bg-paper px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wide text-ink/60 uppercase">Đã mua · {done.length}</h2>
                <button
                  type="button"
                  onClick={() => setItems((list) => list.filter((i) => !i.checked))}
                  className="flex items-center gap-1 text-sm font-semibold text-chili-dark"
                >
                  <Trash2 size={15} /> Dọn mục đã mua
                </button>
              </div>
              <ul className="divide-y divide-line">{done.map(row)}</ul>
            </section>
          )}

          <button
            type="button"
            onClick={() => window.confirm('Xoá toàn bộ danh sách đi chợ?') && setItems([])}
            className="mx-auto block text-sm font-semibold text-ink/60 underline"
          >
            Xoá toàn bộ danh sách
          </button>
        </div>
      )}
    </>
  )
}

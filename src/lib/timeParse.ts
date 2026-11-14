export type InstructionPart = { text: string; seconds?: number }

const UNIT_SECONDS: Record<string, number> = {
  giây: 1,
  phút: 60,
  tiếng: 3600,
  giờ: 3600,
}

// "20 phút", "2-3 phút", "1,5 tiếng", "30 giây"
const DURATION = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(giây|phút|tiếng|giờ)/gi

const toNumber = (s: string) => parseFloat(s.replace(',', '.'))

/**
 * Tách câu hướng dẫn thành các đoạn; đoạn nào là thời lượng thì kèm số giây
 * để giao diện hiển thị thành nút hẹn giờ. Với khoảng "2-3 phút" lấy mốc dài hơn.
 */
export function splitInstruction(instruction: string): InstructionPart[] {
  const parts: InstructionPart[] = []
  let last = 0
  for (const match of instruction.matchAll(DURATION)) {
    const index = match.index
    const value = toNumber(match[2] ?? match[1])
    const seconds = Math.round(value * UNIT_SECONDS[match[3].toLowerCase()])
    if (!seconds) continue
    if (index > last) parts.push({ text: instruction.slice(last, index) })
    parts.push({ text: match[0], seconds })
    last = index + match[0].length
  }
  if (last < instruction.length) parts.push({ text: instruction.slice(last) })
  return parts
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} giờ ${m}p` : `${h} giờ`
}

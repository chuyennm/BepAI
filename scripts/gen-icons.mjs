// Sinh bộ icon PNG cho PWA (không cần thư viện ngoài): node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const CHILI = [234, 88, 12]
const CREAM = [250, 248, 245]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Trả về [r,g,b,a] tại toạ độ chuẩn hoá (0..1). */
function sample(x, y, { rounded, scale }) {
  // Nền
  let bg = true
  if (rounded) {
    const r = 0.22
    const dx = Math.max(r - x, 0, x - (1 - r))
    const dy = Math.max(r - y, 0, y - (1 - r))
    bg = dx * dx + dy * dy <= r * r
  }
  if (!bg) return [0, 0, 0, 0]
  // Thu nhỏ hình vẽ quanh tâm (vùng an toàn cho icon maskable)
  const u = (x - 0.5) / scale + 0.5
  const v = (y - 0.5) / scale + 0.5 + 0.02
  const inBowl = v >= 0.5 && (u - 0.5) ** 2 + (v - 0.5) ** 2 <= 0.3 ** 2
  const inRim = Math.abs(u - 0.5) <= 0.34 && v >= 0.47 && v <= 0.525
  const inFoot = Math.abs(u - 0.5) <= 0.13 && v >= 0.78 && v <= 0.83
  let inSteam = false
  for (const cx of [0.37, 0.5, 0.63]) {
    if (v >= 0.2 && v <= 0.41) {
      const wave = cx + 0.022 * Math.sin(((v - 0.2) / 0.21) * Math.PI * 2)
      if (Math.abs(u - wave) <= 0.017) inSteam = true
    }
  }
  return inBowl || inRim || inFoot || inSteam ? [...CREAM, 255] : [...CHILI, 255]
}

function render(size, opts) {
  const SS = 3
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let py = 0; py < size; py++) {
    const row = py * (size * 4 + 1)
    raw[row] = 0
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, opts)
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]
        }
      const o = row + 1 + px * 4
      raw[o] = a ? Math.round(r / a) : 0
      raw[o + 1] = a ? Math.round(g / a) : 0
      raw[o + 2] = a ? Math.round(b / a) : 0
      raw[o + 3] = Math.round(a / (SS * SS))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', render(192, { rounded: true, scale: 1 }))
writeFileSync('public/icons/icon-512.png', render(512, { rounded: true, scale: 1 }))
writeFileSync('public/icons/maskable-512.png', render(512, { rounded: false, scale: 0.72 }))
writeFileSync('public/icons/apple-touch-icon.png', render(180, { rounded: false, scale: 0.9 }))
console.log('Đã tạo icon trong public/icons')

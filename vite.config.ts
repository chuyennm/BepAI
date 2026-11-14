import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Sau khi build, chèn danh sách file cần precache + mã phiên bản vào đầu sw.js
 * để Service Worker tải sẵn toàn bộ app shell ngay lần mở đầu tiên.
 */
function swPrecache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'bepai-sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => {
          const p = join(dir, f)
          return statSync(p).isDirectory() ? walk(p) : [p]
        })
      const files = walk(outDir)
        .map((p) => relative(outDir, p).replace(/\\/g, '/'))
        .filter((f) => f !== 'sw.js')
      const swPath = join(outDir, 'sw.js')
      const header =
        `self.__BUILD__=${JSON.stringify(Date.now().toString(36))};` +
        `self.__PRECACHE__=${JSON.stringify(['./', ...files])};\n`
      writeFileSync(swPath, header + readFileSync(swPath, 'utf8'))
    },
  }
}

export default defineConfig({
  // Đường dẫn tương đối để chạy được ở cả GitHub Pages (/BepAI/) lẫn tên miền riêng.
  base: './',
  plugins: [react(), tailwindcss(), swPrecache()],
})

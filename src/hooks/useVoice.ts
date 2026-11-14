import { useEffect, useRef, useState } from 'react'
import { fold } from '../lib/recipes'

export type VoiceCommand = 'next' | 'back' | 'repeat'

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}

const getRecognitionCtor = (): (new () => RecognitionLike) | undefined => {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => RecognitionLike) | undefined
}

export const voiceSupported = () => typeof window !== 'undefined' && !!getRecognitionCtor()
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const COMMANDS: [VoiceCommand, string[]][] = [
  ['repeat', ['doc lai', 'nhac lai', 'lap lai', 'repeat', 'again']],
  ['back', ['quay lai', 'lui lai', 'buoc truoc', 'tro lai', 'back', 'previous']],
  ['next', ['tiep theo', 'tiep tuc', 'ke tiep', 'buoc tiep', 'tiep', 'next']],
]

export function parseCommand(transcript: string): VoiceCommand | null {
  const text = fold(transcript)
  for (const [command, phrases] of COMMANDS) {
    if (phrases.some((p) => text.includes(p))) return command
  }
  return null
}

/** Đọc to một đoạn văn bằng giọng tiếng Việt (nếu máy có). */
export function speak(text: string): void {
  if (!speechSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'vi-VN'
  utterance.rate = 0.95
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('vi'))
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

/**
 * Nghe lệnh giọng nói liên tục khi `enabled`. Tự khởi động lại khi trình duyệt
 * ngắt phiên nghe, và bỏ qua âm thanh trong lúc app đang tự đọc hướng dẫn.
 */
export function useVoiceCommands(enabled: boolean, onCommand: (c: VoiceCommand) => void) {
  const handler = useRef(onCommand)
  handler.current = onCommand
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!enabled || !Ctor) return
    let stopped = false
    let lastFired = 0
    const recognition = new Ctor()
    recognition.lang = 'vi-VN'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      if (speechSupported() && window.speechSynthesis.speaking) return
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const command = parseCommand(event.results[i][0].transcript)
        if (command && Date.now() - lastFired > 1200) {
          lastFired = Date.now()
          handler.current(command)
        }
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopped = true
        setError('Chưa được cấp quyền micro. Hãy cho phép micro trong cài đặt trình duyệt.')
      }
    }
    recognition.onend = () => {
      setListening(false)
      if (!stopped) {
        try {
          recognition.start()
          setListening(true)
        } catch {
          /* đang khởi động lại */
        }
      }
    }

    try {
      recognition.start()
      setListening(true)
      setError(null)
    } catch {
      setError('Không bật được nhận diện giọng nói.')
    }
    return () => {
      stopped = true
      recognition.abort()
      setListening(false)
    }
  }, [enabled])

  return { listening, error }
}

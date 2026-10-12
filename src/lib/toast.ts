import { useSyncExternalStore } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

// 模块级事件总线：toast() 任意位置可调用（含非组件模块），ToastHost 订阅渲染。
let toasts: ToastItem[] = []
const listeners = new Set<() => void>()
let seq = 0
const TOAST_TTL = 3200
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function notify() {
  listeners.forEach((l) => l())
}

function remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  timers.delete(id)
  notify()
}

/**
 * 轻量提示：顶部居中浮层、自动消失、不阻断操作，替代原生 alert。
 * 同内容（message+type 相同）的提示会合并为一条并重置存活时间，
 * 避免正文图片连续压缩等场景刷屏。
 */
export function toast(message: string, type: ToastType = 'info') {
  const existing = toasts.find((t) => t.message === message && t.type === type)
  if (existing) {
    const prev = timers.get(existing.id)
    if (prev) clearTimeout(prev)
    timers.set(existing.id, setTimeout(() => remove(existing.id), TOAST_TTL))
    notify()
    return
  }
  const id = ++seq
  toasts = [...toasts, { id, message, type }]
  notify()
  timers.set(id, setTimeout(() => remove(id), TOAST_TTL))
}

export function subscribeToasts(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getToasts(): ToastItem[] {
  return toasts
}

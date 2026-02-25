import { useEffect, useState } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

let toastId = 0
const listeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

const notifyListeners = () => {
  listeners.forEach((listener) => listener([...toasts]))
}

export const toast = {
  // 【前置逻辑说明】
  // 封装一个通用的 add 方法，在将 toast 推入数组的同时，
  // 启动一个 3 秒的定时器，时间到了自动调用 remove 方法清除对应的 toast。
  add: (message: string, type: Toast['type']) => {
    const id = toastId++
    toasts.push({ id, message, type })
    notifyListeners()

    // 3秒后自动销毁
    setTimeout(() => {
      toast.remove(id)
    }, 3000)
  },
  success: (message: string) => toast.add(message, 'success'),
  error: (message: string) => toast.add(message, 'error'),
  warning: (message: string) => toast.add(message, 'warning'),
  info: (message: string) => toast.add(message, 'info'),

  remove: (id: number) => {
    toasts = toasts.filter((t) => t.id !== id)
    notifyListeners()
  },
}

export default function ToastContainer() {
  const [toastList, setToastList] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToastList(newToasts)
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  const typeStyles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toastList.map((t) => (
        <div
          key={t.id}
          className={`${typeStyles[t.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => toast.remove(t.id)}
            className="text-white hover:text-gray-200"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'

interface CopyButtonProps {
  text: string
  className?: string
  children?: React.ReactNode
}

export default function CopyButton({ text, className = '', children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`${className} transition-colors`}
      title={copied ? '已复制' : '复制'}
    >
      {copied ? '已复制' : children || '复制'}
    </button>
  )
}

export function CopyInput({ value, readOnly = true }: { value: string; readOnly?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        className="input flex-1 font-mono text-sm"
      />
      <button
        onClick={handleCopy}
        className="btn btn-secondary min-w-[5rem]"
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}

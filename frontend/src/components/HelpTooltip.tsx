import { useState } from 'react'

interface HelpTooltipProps {
  content: React.ReactNode
  className?: string
}

export function HelpTooltip({ content, className = '' }: HelpTooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <div className={'relative inline-block ' + className}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      {show && (
        <div className="absolute left-full ml-2 top-0 z-50 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
          {content}
        </div>
      )}
    </div>
  )
}

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function HelpModal({ isOpen, onClose, title, children }: HelpModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 text-sm">
          {children}
        </div>
        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="btn btn-secondary">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

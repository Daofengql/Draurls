import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function RedirectPage() {
  const { code } = useParams<{ code: string }>()
  const [message, setMessage] = useState('正在跳转...')

  useEffect(() => {
    // TODO: 获取目标URL并跳转
    const timer = setTimeout(() => {
      setMessage(`短码 ${code} 不存在`)
    }, 2000)
    return () => clearTimeout(timer)
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card text-center">
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

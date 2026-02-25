import { useState, useEffect } from 'react'
import { configService, type SiteConfig } from '@/services/config'

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    configService.get()
      .then((data) => {
        setConfig(data || {})
        // 设置页面标题
        if (data.site_name) {
          document.title = data.site_name
        }
      })
      .catch(() => {
        // 使用默认值
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { config, loading }
}

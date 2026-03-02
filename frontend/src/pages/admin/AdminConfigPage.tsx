import { useEffect, useState, useMemo } from 'react'
import { configService } from '@/services/admin'
import { toast } from '@/components/Toast'

interface ConfigItem {
  key: string
  value: string
  description: string
  type: 'text' | 'number' | 'boolean' | 'textarea' | 'select'
  options?: string[]
  optionLabels?: string[]
  dependsOn?: string
  dependentValue?: string
}

interface ConfigSection {
  title: string
  icon: string
  configs: ConfigItem[]
}

// 配置项定义（不含值）
const configItemDefinitions: Omit<ConfigItem, 'value'>[] = [
  // 基本设置
  {
    key: 'site_name',
    description: '站点名称',
    type: 'text',
  },
  {
    key: 'logo_url',
    description: 'Logo URL',
    type: 'text',
  },
  // 跳转页面设置
  {
    key: 'redirect_page_enabled',
    description: '启用跳转中间页',
    type: 'boolean',
  },
  {
    key: 'allow_user_template',
    description: '允许用户选择跳转模板',
    type: 'boolean',
    dependsOn: 'redirect_page_enabled',
    dependentValue: 'true',
  },
  // 短链设置
  {
    key: 'max_link_length',
    description: '最大短链长度',
    type: 'number',
  },
  {
    key: 'shortcode_mode',
    description: '短码生成模式',
    type: 'select',
    options: ['random', 'sequence'],
    optionLabels: ['随机字符串', '数据库自增'],
  },
  {
    key: 'allow_custom_shortcode',
    description: '允许普通用户使用自定义短码',
    type: 'boolean',
  },
  // 用户设置
  {
    key: 'enable_signup',
    description: '允许用户注册',
    type: 'boolean',
  },
]

// 分区定义（每个分区包含哪些配置项的key）
const sectionDefinitions: { title: string; icon: string; keys: string[] }[] = [
  {
    title: '基本设置',
    icon: 'basic',
    keys: ['site_name', 'logo_url'],
  },
  {
    title: '跳转页面设置',
    icon: 'redirect',
    keys: ['redirect_page_enabled', 'allow_user_template'],
  },
  {
    title: '短链设置',
    icon: 'link',
    keys: ['max_link_length', 'shortcode_mode', 'allow_custom_shortcode'],
  },
  {
    title: '用户设置',
    icon: 'user',
    keys: ['enable_signup'],
  },
]

// 默认值
const defaultValues: Record<string, string> = {
  site_name: '',
  logo_url: '',
  redirect_page_enabled: 'false',
  allow_user_template: 'false',
  max_link_length: '10',
  shortcode_mode: 'sequence',
  allow_custom_shortcode: 'false',
  enable_signup: 'true',
}

const icons = {
  basic: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 012 2m0 2a2 2 0 012 2m-6 9l2 2 4-4-6 6" />
    </svg>
  ),
  redirect: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5M6 18l5 5m0 0l-5-5" />
    </svg>
  ),
  link: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
}

export default function AdminConfigPage() {
  const [configValues, setConfigValues] = useState<Record<string, string>>(defaultValues)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 根据当前值构建配置项
  const configItems: ConfigItem[] = useMemo(() => {
    return configItemDefinitions.map((def) => ({
      ...def,
      value: configValues[def.key] || defaultValues[def.key] || '',
    }))
  }, [configValues])

  // 根据配置项构建分区
  const configSections: ConfigSection[] = useMemo(() => {
    const configMap = new Map(configItems.map((c) => [c.key, c]))
    return sectionDefinitions.map((section) => ({
      title: section.title,
      icon: section.icon,
      configs: section.keys
        .map((key) => configMap.get(key))
        .filter((c): c is ConfigItem => c !== undefined),
    }))
  }, [configItems])

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = () => {
    setLoading(true)
    configService
      .get()
      .then((data) => {
        const configMap = data || {}
        // 合并默认值和实际值
        const merged = { ...defaultValues }
        Object.keys(defaultValues).forEach((key) => {
          if (configMap[key] !== undefined && configMap[key] !== '') {
            merged[key] = configMap[key]
          }
        })
        setConfigValues(merged)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载配置失败')
      })
      .finally(() => setLoading(false))
  }

  const handleUpdate = async (key: string, value: string) => {
    try {
      await configService.update(key, value)

      // 如果关闭了跳转页，同时关闭用户选择模板
      if (key === 'redirect_page_enabled' && value === 'false') {
        await configService.update('allow_user_template', 'false')
        setConfigValues((prev) => ({
          ...prev,
          [key]: value,
          allow_user_template: 'false',
        }))
        toast.success('配置已更新')
        return
      }

      toast.success('配置已更新')
      loadConfigs()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
      loadConfigs()
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      await configService.batchUpdate(configValues)
      toast.success('所有配置已保存，页面即将刷新')
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err: any) {
      toast.error(err.message || '保存失败')
      setSaving(false)
    }
  }

  // 检查配置是否应该显示
  const isConfigEnabled = (config: ConfigItem): boolean => {
    if (!config.dependsOn) return true

    const dependentValue = configValues[config.dependsOn]
    if (!dependentValue) return false

    return dependentValue === config.dependentValue
  }

  // 检查配置是否应该禁用
  const isConfigDisabled = (config: ConfigItem): boolean => {
    return config.dependsOn ? !isConfigEnabled(config) : false
  }

  const renderInput = (config: ConfigItem) => {
    const handleChange = (value: string) => {
      setConfigValues((prev) => ({ ...prev, [config.key]: value }))
    }

    const disabled = isConfigDisabled(config)

    if (config.type === 'select') {
      return (
        <select
          value={config.value}
          onChange={(e) => {
            const newValue = e.target.value
            handleChange(newValue)
            handleUpdate(config.key, newValue)
          }}
          disabled={disabled}
          className="input w-full sm:max-w-xs text-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {config.options?.map((opt, idx) => (
            <option key={opt} value={opt}>
              {config.optionLabels?.[idx] || opt}
            </option>
          ))}
        </select>
      )
    }

    if (config.type === 'boolean') {
      const isEnabled = config.value === 'true'
      return (
        <button
          type="button"
          onClick={() => {
            const newValue = isEnabled ? 'false' : 'true'
            handleChange(newValue)
            handleUpdate(config.key, newValue)
          }}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      )
    }

    if (config.type === 'number') {
      return (
        <input
          type="number"
          value={config.value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => handleUpdate(config.key, e.target.value)}
          className="input w-full sm:max-w-xs text-sm"
        />
      )
    }

    if (config.type === 'textarea') {
      return (
        <textarea
          value={config.value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => handleUpdate(config.key, e.target.value)}
          className="input w-full text-sm"
          rows={3}
        />
      )
    }

    return (
      <input
        type="text"
        value={config.value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => handleUpdate(config.key, e.target.value)}
        className="input w-full sm:max-w-xs text-sm"
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">站点配置</h2>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="btn btn-primary disabled:bg-gray-300 w-full sm:w-auto"
        >
          {saving ? '保存中...' : '保存所有配置'}
        </button>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {loading ? (
          <div className="card text-center py-8 text-gray-500">加载中...</div>
        ) : (
          configSections.map((section) => (
            <div key={section.title} className="card">
              <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b pb-4">
                <div className="text-blue-600">{icons[section.icon as keyof typeof icons]}</div>
                <h3 className="text-lg font-semibold">{section.title}</h3>
              </div>
              <div className="space-y-4 sm:space-y-5">
                {section.configs.map((config) => {
                  const enabled = isConfigEnabled(config)
                  return (
                    <div
                      key={config.key}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        !enabled ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <label className="font-medium text-gray-700 text-sm sm:text-base">
                          {config.description}
                        </label>
                        {config.dependsOn && !enabled && (
                          <p className="text-xs text-gray-500">
                            需要启用"{configItemDefinitions.find((d) => d.key === config.dependsOn)?.description}"
                          </p>
                        )}
                      </div>
                      {renderInput(config)}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2 text-sm sm:text-base">配置说明</h3>
        <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
          <li>• <strong>跳转页面设置</strong>: 启用跳转页后，用户访问短链接时显示中间跳转页面</li>
          <li>• <strong>模板选择</strong>: 开启后用户可以在创建链接时选择跳转模板</li>
          <li>• <strong>短链设置</strong>: 控制短链长度和生成方式</li>
          <li>• 配置修改后即时生效（部分配置可能需要刷新页面）</li>
        </ul>
      </div>
    </div>
  )
}

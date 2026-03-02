import { useEffect, useState } from 'react'
import { configService } from '@/services/admin'
import { toast } from '@/components/Toast'

interface ConfigItem {
  key: string
  value: string
  description: string
  type: 'text' | 'number' | 'boolean' | 'textarea' | 'select'
  options?: string[]
  optionLabels?: string[]
  dependsOn?: string // 依赖的配置项key
  dependentValue?: string // 依赖项需要满足的值才显示
}

const configDefinitions: ConfigItem[] = [
  {
    key: 'site_name',
    value: '',
    description: '站点名称',
    type: 'text',
  },
  {
    key: 'logo_url',
    value: '',
    description: 'Logo URL',
    type: 'text',
  },
  {
    key: 'redirect_page_enabled',
    value: 'false',
    description: '是否启用跳转中间页',
    type: 'boolean',
  },
  {
    key: 'allow_user_template',
    value: 'false',
    description: '是否允许用户选择跳转模板',
    type: 'boolean',
    dependsOn: 'redirect_page_enabled',
    dependentValue: 'true',
  },
  {
    key: 'max_link_length',
    value: '10',
    description: '最大短链长度',
    type: 'number',
  },
  {
    key: 'enable_signup',
    value: 'true',
    description: '是否允许用户注册',
    type: 'boolean',
  },
  {
    key: 'shortcode_mode',
    value: 'sequence',
    description: '短码生成模式',
    type: 'select',
    options: ['random', 'sequence'],
    optionLabels: ['随机字符串', '数据库自增'],
  },
  {
    key: 'allow_custom_shortcode',
    value: 'false',
    description: '是否允许普通用户使用自定义短码',
    type: 'boolean',
  },
]

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>(configDefinitions)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = () => {
    setLoading(true)
    configService
      .get()
      .then((data) => {
        const configMap = data || {}
        setConfigs(
          configDefinitions.map((def) => ({
            ...def,
            value: (configMap as Record<string, string>)[def.key] || def.value,
          }))
        )
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
        const allowTemplateConfig = configs.find(c => c.key === 'allow_user_template')
        if (allowTemplateConfig) {
          await configService.update('allow_user_template', 'false')
          setConfigs(configs.map(c =>
            c.key === 'allow_user_template'
              ? { ...c, value: 'false' }
              : c.key === key ? { ...c, value }
              : c
          ))
          return
        }
      }

      toast.success('配置已更新')
      loadConfigs()
    } catch (err: any) {
      toast.error(err.message || '更新失败')
      loadConfigs() // 重新加载以恢复原值
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const configMap: Record<string, string> = {}
      configs.forEach((c) => {
        configMap[c.key] = c.value
      })
      await configService.batchUpdate(configMap)
      toast.success('所有配置已保存，页面即将刷新')
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err: any) {
      toast.error(err.message || '保存失败')
      setSaving(false)
    }
  }

  // 检查配置是否应该显示（处理依赖关系）
  const isConfigEnabled = (config: ConfigItem): boolean => {
    if (!config.dependsOn) return true

    const dependentConfig = configs.find(c => c.key === config.dependsOn)
    if (!dependentConfig) return true

    return dependentConfig.value === config.dependentValue
  }

  // 检查配置是否应该禁用（因为依赖条件不满足）
  const isConfigDisabled = (config: ConfigItem): boolean => {
    return config.dependsOn ? !isConfigEnabled(config) : false
  }

  const renderInput = (config: ConfigItem) => {
    const handleChange = (value: string) => {
      setConfigs(configs.map((c) => (c.key === config.key ? { ...c, value } : c)))
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

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {configs.map((config) => {
              const enabled = isConfigEnabled(config)
              return (
                <div
                  key={config.key}
                  className={`flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 pb-4 border-b ${
                    !enabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2 sm:mb-0">
                      <label className="font-medium text-gray-700 text-sm sm:text-base">
                        {config.description}
                      </label>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 w-max">
                        {config.key}
                      </code>
                    </div>
                    {renderInput(config)}
                    {config.dependsOn && !enabled && (
                      <p className="text-xs text-gray-500 mt-1">
                        需要启用 "{configs.find(c => c.key === config.dependsOn)?.description}"
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2 text-sm sm:text-base">配置说明</h3>
        <ul className="text-xs sm:text-sm text-blue-700 space-y-1">
          <li>• <strong>redirect_page_enabled</strong>: 启用后用户访问短链接时显示中间跳转页</li>
          <li>• <strong>allow_user_template</strong>: 允许用户在创建链接时选择跳转模板（需先启用跳转页）</li>
          <li>• <strong>shortcode_mode</strong>: random=随机字符串, sequence=数据库自增</li>
          <li>• <strong>allow_custom_shortcode</strong>: 开启后普通用户可使用自定义短码</li>
          <li>• 配置修改后即时生效（部分配置可能需要刷新页面）</li>
        </ul>
      </div>
    </div>
  )
}

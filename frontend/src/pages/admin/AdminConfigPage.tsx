import { useEffect, useState, useMemo } from 'react'
import { configService } from '@/services/admin'
import { toast } from '@/components/Toast'
import { HelpModal } from '@/components/HelpTooltip'
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Switch,
  Button,
  Card,
  CardContent,
  Stack,
  Paper,
  Chip,
  IconButton,
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import {
  Settings as SettingsIcon,
  ArrowForward as RedirectIcon,
  Link as LinkIcon,
  Person as UserIcon,
  Lock as LockIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Help as HelpIcon,
  Save as SaveIcon,
} from '@mui/icons-material'

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
  icon: React.ReactNode
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
  {
    key: 'icp_number',
    description: 'ICP备案号',
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
const sectionDefinitions: { title: string; icon: React.ReactNode; keys: string[] }[] = [
  {
    title: '基本设置',
    icon: <SettingsIcon color="primary" />,
    keys: ['site_name', 'logo_url', 'icp_number'],
  },
  {
    title: '跳转页面设置',
    icon: <RedirectIcon color="primary" />,
    keys: ['redirect_page_enabled', 'allow_user_template'],
  },
  {
    title: '短链设置',
    icon: <LinkIcon color="primary" />,
    keys: ['max_link_length', 'shortcode_mode', 'allow_custom_shortcode'],
  },
  {
    title: '用户设置',
    icon: <UserIcon color="primary" />,
    keys: ['enable_signup'],
  },
]

// 默认值
const defaultValues: Record<string, string> = {
  site_name: '',
  logo_url: '',
  icp_number: '',
  redirect_page_enabled: 'false',
  allow_user_template: 'false',
  max_link_length: '10',
  shortcode_mode: 'sequence',
  allow_custom_shortcode: 'false',
  enable_signup: 'true',
}

export default function AdminConfigPage() {
  const [configValues, setConfigValues] = useState<Record<string, string>>(defaultValues)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

  // CORS 配置状态
  const [corsOrigins, setCorsOrigins] = useState<string[]>(['http://localhost:3000'])
  const [newOrigin, setNewOrigin] = useState('')
  const [hasWildcard, setHasWildcard] = useState(false)
  const [savingCors, setSavingCors] = useState(false)

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
    loadConfigs(true)
  }, [])

  const loadConfigs = (showLoading = false) => {
    if (showLoading) setLoading(true)
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
      .finally(() => {
        if (showLoading) setLoading(false)
      })
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
      loadConfigs(false) // 静默刷新
    } catch (err: any) {
      toast.error(err.message || '更新失败')
      loadConfigs(false)
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      await configService.batchUpdate(configValues)
      toast.success('所有配置已保存')
      loadConfigs()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // CORS 配置相关函数
  const loadCORSConfig = () => {
    configService
      .getCORS()
      .then((data) => {
        setCorsOrigins(data.origins || [])
        setHasWildcard(data.has_wildcard || false)
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载 CORS 配置失败')
      })
  }

  useEffect(() => {
    loadCORSConfig()
  }, [])

  const handleAddOrigin = () => {
    if (!newOrigin.trim()) return

    // 检查是否已存在
    if (corsOrigins.some(o => o.toLowerCase() === newOrigin.toLowerCase())) {
      toast.error('该 Origin 已存在')
      return
    }

    setCorsOrigins([...corsOrigins, newOrigin.trim()])
    setNewOrigin('')
  }

  const handleRemoveOrigin = (origin: string) => {
    setCorsOrigins(corsOrigins.filter(o => o !== origin))
  }

  const handleSaveCORS = async () => {
    setSavingCors(true)
    try {
      await configService.updateCORS(corsOrigins)
      toast.success('CORS 配置已保存')
      loadCORSConfig()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSavingCors(false)
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
        <Select
          value={config.value}
          onChange={(e) => {
            const newValue = e.target.value
            handleChange(newValue)
            handleUpdate(config.key, newValue)
          }}
          disabled={disabled}
          fullWidth
          size="small"
        >
          {config.options?.map((opt, idx) => (
            <MenuItem key={opt} value={opt}>
              {config.optionLabels?.[idx] || opt}
            </MenuItem>
          ))}
        </Select>
      )
    }

    if (config.type === 'boolean') {
      return (
        <Switch
          checked={config.value === 'true'}
          onChange={(e) => {
            const newValue = e.target.checked ? 'true' : 'false'
            handleChange(newValue)
            handleUpdate(config.key, newValue)
          }}
          disabled={disabled}
        />
      )
    }

    if (config.type === 'number') {
      return (
        <TextField
          type="number"
          value={config.value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => handleUpdate(config.key, e.target.value)}
          size="small"
          fullWidth
          disabled={disabled}
        />
      )
    }

    if (config.type === 'textarea') {
      return (
        <TextField
          multiline
          rows={3}
          value={config.value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => handleUpdate(config.key, e.target.value)}
          size="small"
          fullWidth
          disabled={disabled}
        />
      )
    }

    return (
      <TextField
        type="text"
        value={config.value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => handleUpdate(config.key, e.target.value)}
        size="small"
        fullWidth
        disabled={disabled}
      />
    )
  }

  return (
    <Stack spacing={3}>
      {/* 页面标题 */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h5" fontWeight={600}>
            站点配置
          </Typography>
          <IconButton onClick={() => setShowHelpModal(true)} size="small">
            <HelpIcon color="action" />
          </IconButton>
        </Stack>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveAll}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存所有配置'}
        </Button>
      </Box>

      {/* 配置分区 - 网格卡片布局 */}
      {loading ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">加载中...</Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(2, 1fr)',
            },
            gap: 3,
          }}
        >
          {configSections.map((section) => (
            <Card key={section.title} variant="outlined" sx={{ height: 'fit-content' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  {section.icon}
                  <Typography variant="h6" fontWeight={600}>
                    {section.title}
                  </Typography>
                </Stack>
                <Stack spacing={2}>
                  {section.configs.map((config) => {
                    const enabled = isConfigEnabled(config)
                    return (
                      <Box
                        key={config.key}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'grey.50',
                          opacity: enabled ? 1 : 0.5,
                        }}
                      >
                        <Stack spacing={1}>
                          <Typography variant="body2" fontWeight={500}>
                            {config.description}
                          </Typography>
                          {config.dependsOn && !enabled && (
                            <Typography variant="caption" color="text.secondary">
                              需要启用"{configItemDefinitions.find((d) => d.key === config.dependsOn)?.description}"
                            </Typography>
                          )}
                          <Box sx={{ mt: 0.5 }}>
                            {renderInput(config)}
                          </Box>
                        </Stack>
                      </Box>
                    )
                  })}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* 配置说明 */}
      <Alert severity="info">
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          配置说明
        </Typography>
        <Typography variant="body2" component="ul" sx={{ pl: 2, m: 0 }}>
          <Typography component="li" variant="body2">
            <strong>跳转页面设置</strong>: 启用跳转页后，用户访问短链接时显示中间跳转页面
          </Typography>
          <Typography component="li" variant="body2">
            <strong>模板选择</strong>: 开启后用户可以在创建链接时选择跳转模板
          </Typography>
          <Typography component="li" variant="body2">
            <strong>短链设置</strong>: 控制短链长度和生成方式
          </Typography>
          <Typography component="li" variant="body2">
            配置修改后即时生效（部分配置可能需要刷新页面）
          </Typography>
        </Typography>
      </Alert>

      {/* CORS 配置 */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <LockIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              CORS 跨域配置
            </Typography>
          </Stack>

          <Stack spacing={3}>
            <Alert severity="warning">
              <Typography variant="body2" fontWeight={500}>
                安全提示
              </Typography>
              <Typography variant="body2">
                使用 <Box component="code" sx={{ bgcolor: 'grey.200', px: 0.5, borderRadius: 0.5 }}>*</Box> 通配符时将禁用 Credentials（Cookie/认证），仅适用于不需要身份验证的公开 API。
              </Typography>
            </Alert>

            <Box>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                允许的源 (Origins)
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {corsOrigins.map((origin, index) => (
                  <Stack key={index} direction="row" alignItems="center" spacing={1}>
                    <Paper
                      variant="outlined"
                      sx={{
                        flex: 1,
                        px: 2,
                        py: 1,
                        bgcolor: 'grey.50',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                      }}
                    >
                      {origin}
                    </Paper>
                    {origin !== '*' && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveOrigin(origin)}
                        title="删除"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                    {origin === '*' && (
                      <Chip label="通配符模式" size="small" color="warning" />
                    )}
                  </Stack>
                ))}
                {corsOrigins.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    暂无配置
                  </Typography>
                )}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  type="text"
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddOrigin()}
                  placeholder="例如: https://example.com"
                  size="small"
                  fullWidth
                  disabled={hasWildcard || savingCors}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddOrigin}
                  disabled={!newOrigin.trim() || hasWildcard || savingCors}
                  startIcon={<AddIcon />}
                >
                  添加
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveCORS}
                  disabled={savingCors || corsOrigins.length === 0}
                >
                  {savingCors ? '保存中...' : '保存 CORS'}
                </Button>
              </Stack>

              <FormGroup sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasWildcard}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCorsOrigins(['*'])
                          setNewOrigin('')
                        } else {
                          setCorsOrigins(['http://localhost:3000'])
                        }
                        setHasWildcard(e.target.checked)
                      }}
                      disabled={savingCors}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      允许所有源 (<Box component="code" sx={{ bgcolor: 'grey.200', px: 0.5, borderRadius: 0.5 }}>*</Box>) - 将禁用 Cookie 认证
                    </Typography>
                  }
                />
              </FormGroup>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* 配置帮助文档弹窗 */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="站点配置说明"
      >
        <Stack spacing={3}>
          {/* 基本设置 */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              基本设置
            </Typography>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  站点名称
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  显示在页面标题和导航中的站点名称
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Logo URL
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  站点 Logo 图片地址，支持外链
                </Typography>
              </Paper>
            </Stack>
          </Box>

          {/* 跳转页面设置 */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              跳转页面设置
            </Typography>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  启用跳转中间页
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  开启后，用户访问短链接时会显示一个中间跳转页面，
                  提示用户即将跳转到目标URL。可以增强用户体验，也可以用于广告展示。
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50' }}>
                <Typography variant="body2" fontWeight={500} color="primary.main" gutterBottom>
                  允许用户选择跳转模板
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  开启后，用户在创建短链接时可以选择自己喜欢的跳转页面模板。
                  需要先启用"跳转��间页"才能使用此功能。
                  <br /><br />
                  <strong>模板管理：</strong>请在"模板管理"页面创建和管理跳转模板。
                  不同模板可以有不同的设计风格、动画效果和提示信息。
                </Typography>
              </Paper>
            </Stack>
          </Box>

          {/* 短链设置 */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              短链设置
            </Typography>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  最大短链长度
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  自定义短码的最大长度限制
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  短码生成模式
                </Typography>
                <Typography variant="caption" color="text.secondary" component="ul" sx={{ pl: 2, m: 0 }}>
                  <Typography component="li" variant="caption">
                    <strong>随机字符串</strong>：生成随机字符组成的短码，更安全，适合公开使用
                  </Typography>
                  <Typography component="li" variant="caption">
                    <strong>数据库自增</strong>：使用数字自增ID，短链接更短，按顺序生成
                  </Typography>
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  允许普通用户使用自定义短码
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  开放后，普通用户在创建链接时可以自定义短码。
                  关闭后，只有管理员可以使用自定义短码功能。
                </Typography>
              </Paper>
            </Stack>
          </Box>

          {/* 用户设置 */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              用户设置
            </Typography>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  允许用户注册
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  关闭后，新用户无法注册。已有用户不受影响。
                </Typography>
              </Paper>
            </Stack>
          </Box>

          {/* 使用建议 */}
          <Alert severity="success">
            <Typography variant="body2" fontWeight={600} gutterBottom>
              使用建议
            </Typography>
            <Typography variant="body2" component="ul" sx={{ pl: 2, m: 0 }}>
              <Typography component="li" variant="body2">
                建议先在"模板管理"中创建几个跳转模板
              </Typography>
              <Typography component="li" variant="body2">
                开启"跳转中间页"后，用户才能看到模板效果
              </Typography>
              <Typography component="li" variant="body2">
                开放"允许用户选择模板"可以让用户自由选择风格
              </Typography>
              <Typography component="li" variant="body2">
                配置修改后会立即生效，无需重启服务
              </Typography>
            </Typography>
          </Alert>
        </Stack>
      </HelpModal>
    </Stack>
  )
}

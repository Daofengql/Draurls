/**
 * 验证域名或主机名格式
 * 支持: 域名、域名:端口、localhost、localhost:端口、IP、IP:端口
 */
export function isValidDomainOrHost(input: string): boolean {
  if (!input || input.trim() === '') {
    return false
  }

  const trimmed = input.trim()

  // 分离主机和端口部分
  let host: string
  let port: string

  const colonIndex = trimmed.lastIndexOf(':')
  // 检查是否是 IPv6 地址 (包含多个冒号)
  if (colonIndex > 0 && !trimmed.includes('[')) {
    host = trimmed.substring(0, colonIndex)
    port = trimmed.substring(colonIndex + 1)
  } else {
    host = trimmed
    port = ''
  }

  // 验证端口范围
  if (port) {
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return false
    }
  }

  // 检查是否是有效的 IP 地址
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipPattern.test(host)) {
    // 验证每个八位组在 0-255 范围内
    const octets = host.split('.')
    return octets.every((octet) => {
      const num = parseInt(octet, 10)
      return num >= 0 && num <= 255
    })
  }

  // 检查是否是 localhost 的各种形式
  const lowerHost = host.toLowerCase()
  if (
    lowerHost === 'localhost' ||
    lowerHost === 'localhost.localdomain' ||
    lowerHost === '127.0.0.1'
  ) {
    return true
  }

  // 检查是否是有效的域名
  return isValidDomain(host)
}

/**
 * 验证域名格式
 */
function isValidDomain(domain: string): boolean {
  if (!domain || domain.trim() === '') {
    return false
  }

  domain = domain.toLowerCase().trim()

  // 域名总长度限制
  if (domain.length > 253) {
    return false
  }

  // 域名标签（用点分隔的部分）验证
  const labels = domain.split('.')
  if (labels.length < 2) {
    return false
  }

  // 每个标签的验证
  const labelPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

  for (const label of labels) {
    // 标签长度限制 (1-63)
    if (label.length < 1 || label.length > 63) {
      return false
    }
    // 不能以 - 开头或结尾
    if (label.startsWith('-') || label.endsWith('-')) {
      return false
    }
    // 只能包含字母、数字和连字符
    if (!labelPattern.test(label)) {
      return false
    }
  }

  // TLD（顶级域）不能全是数字
  const lastLabel = labels[labels.length - 1]
  const tldNumPattern = /^\d+$/
  if (tldNumPattern.test(lastLabel)) {
    return false
  }

  return true
}

/**
 * 获取域名验证错误信息
 */
export function getDomainValidationError(input: string): string | null {
  if (!input || input.trim() === '') {
    return '域名不能为空'
  }

  const trimmed = input.trim()

  // 分离主机和端口部分
  let host: string
  let port: string

  const colonIndex = trimmed.lastIndexOf(':')
  if (colonIndex > 0 && !trimmed.includes('[')) {
    host = trimmed.substring(0, colonIndex)
    port = trimmed.substring(colonIndex + 1)
  } else {
    host = trimmed
    port = ''
  }

  // 验证端口
  if (port) {
    const portNum = parseInt(port, 10)
    if (isNaN(portNum)) {
      return '端口格式不正确'
    }
    if (portNum < 1 || portNum > 65535) {
      return '端口必须在 1-65535 之间'
    }
  }

  // 检查是否是有效的 IP 地址
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipPattern.test(host)) {
    const octets = host.split('.')
    for (const octet of octets) {
      const num = parseInt(octet, 10)
      if (num < 0 || num > 255) {
        return 'IP 地址格式不正确'
      }
    }
    return null
  }

  // 检查 localhost
  const lowerHost = host.toLowerCase()
  if (
    lowerHost === 'localhost' ||
    lowerHost === 'localhost.localdomain' ||
    lowerHost === '127.0.0.1'
  ) {
    return null
  }

  // 检查域名格式
  if (!isValidDomain(host)) {
    return '域名格式不正确，应为: example.com 或 example.com:8080'
  }

  return null
}

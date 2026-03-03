package utils

import (
	"net"
	"regexp"
	"strings"
)

// isValidDomainOrHost 验证域名或主机名格式
// 支持: 域名、域名:端口、localhost、localhost:端口、IP、IP:端口
func IsValidDomainOrHost(input string) bool {
	if input == "" {
		return false
	}

	input = strings.TrimSpace(input)

	// 分离主机和端口部分
	host, port, err := net.SplitHostPort(input)
	if err != nil {
		// 没有端口部分，整个输入就是主机
		host = input
		port = ""
	}

	// 验证端口范围
	if port != "" {
		portNum, err := net.LookupPort("tcp", port)
		if err != nil || portNum < 1 || portNum > 65535 {
			return false
		}
	}

	// 检查是否是有效的 IP 地址
	if ip := net.ParseIP(host); ip != nil {
		return true
	}

	// 检查是否是 localhost（支持多种形式）
	if isLocalhost(host) {
		return true
	}

	// 检查是否是有效的域名
	return isValidDomain(host)
}

// isLocalhost 检查是否是 localhost 的各种形式
func isLocalhost(host string) bool {
	lowerHost := strings.ToLower(host)
	return lowerHost == "localhost" ||
		lowerHost == "localhost.localdomain" ||
		lowerHost == "127.0.0.1" ||
		lowerHost == "::1"
}

// isValidDomain 验证域名格式
func isValidDomain(domain string) bool {
	if domain == "" {
		return false
	}

	domain = strings.ToLower(strings.TrimSpace(domain))

	// 域名总长度限制
	if len(domain) > 253 {
		return false
	}

	// 域名标签（用点分隔的部分）长度和格式检查
	labels := strings.Split(domain, ".")
	if len(labels) < 1 {
		return false
	}

	// 每个标签的验证
	labelPattern := regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
	for _, label := range labels {
		// 标签长度限制 (1-63)
		if len(label) < 1 || len(label) > 63 {
			return false
		}
		// 不能以 - 开头或结尾
		if strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return false
		}
		// 只能包含字母、数字和连字符
		if !labelPattern.MatchString(label) {
			return false
		}
	}

	// TLD（顶级域）不能全是数字
	lastLabel := labels[len(labels)-1]
	tldNumPattern := regexp.MustCompile(`^\d+$`)
	if tldNumPattern.MatchString(lastLabel) {
		return false
	}

	return true
}

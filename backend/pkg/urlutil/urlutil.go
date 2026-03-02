package urlutil

import (
	"net/url"
	"strings"
)

// IsInternalURL 检查 URL 是否为内部链接（本系统生成的）
func IsInternalURL(targetURL string, domains []string) bool {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return false
	}

	host := strings.ToLower(parsed.Host)
	for _, domain := range domains {
		domain = strings.ToLower(domain)
		// 精确匹配或子域名匹配（防止 hacker-surls.local 匹配 surls.local）
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}

	return false
}

// NormalizeURL 规范化 URL
func NormalizeURL(rawURL string) (string, error) {
	if rawURL == "" {
		return "", nil
	}

	// 如果没有协议，添加 http://
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "http://" + rawURL
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	// 转小写
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.Scheme = strings.ToLower(parsed.Scheme)

	return parsed.String(), nil
}

// ExtractDomain 从 URL 中提取域名
func ExtractDomain(rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}

	return parsed.Host, nil
}

// IsValidURL 检�� URL 是否有效
func IsValidURL(rawURL string) bool {
	if rawURL == "" {
		return false
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	return parsed.Scheme != "" && parsed.Host != ""
}

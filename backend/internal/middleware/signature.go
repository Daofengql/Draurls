package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math/big"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	signatureHeader     = "X-Signature"
	timestampHeader     = "X-Timestamp"
	nonceHeader         = "X-Nonce"
	apiKeyHeader        = "X-API-Key"
)

const (
	// maxBodySizeForSignature 签名计算时的最大 Body 大小
	// 超过此大小的请求体验证将被拒绝，防止 OOM 攻击
	maxBodySizeForSignature = 2 * 1024 * 1024 // 2MB
)

var (
	ErrMissingSignature = errors.New("missing signature")
	ErrInvalidSignature = errors.New("invalid signature")
	ErrExpiredTimestamp = errors.New("expired timestamp")
	ErrDuplicateNonce   = errors.New("duplicate nonce")
	ErrMissingAPIKey    = errors.New("missing api key")
)

// SignatureConfig 签名配置
type SignatureConfig struct {
	Tolerance      time.Duration // 时间戳容差
	CacheDuration  time.Duration // nonce缓存时间
	MaxBodySize   int64        // 最大 Body 大小（字节）
	secretProvider SecretProvider
}

// SecretProvider 密钥提供者接口
type SecretProvider interface {
	GetSecret(apiKey string) (string, error)
}

// UserInfoProvider 用户信息提供者接口（扩展 SecretProvider）
type UserInfoProvider interface {
	SecretProvider
	GetUserID(apiKey string) (uint, error)
}

// APIAuthMiddleware API签名认证中间件
type APIAuthMiddleware struct {
	config     *SignatureConfig
	nonceCache map[string]time.Time
	cacheMu    sync.RWMutex
	stopChan   chan struct{}
}

// NewAPIAuthMiddleware 创建API认证中间件
func NewAPIAuthMiddleware(provider SecretProvider, tolerance time.Duration) *APIAuthMiddleware {
	m := &APIAuthMiddleware{
		config: &SignatureConfig{
			Tolerance:      tolerance,
			CacheDuration:  15 * time.Minute,
			MaxBodySize:    maxBodySizeForSignature,
			secretProvider: provider,
		},
		nonceCache: make(map[string]time.Time),
		stopChan:   make(chan struct{}),
	}
	// 启动自动清理goroutine
	go m.cleanupLoop()
	return m
}

// Stop 停止中间件（优雅关闭）
func (m *APIAuthMiddleware) Stop() {
	close(m.stopChan)
}

// Authenticate 认证中间件
func (m *APIAuthMiddleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取签名相关头
		signature := c.GetHeader(signatureHeader)
		timestamp := c.GetHeader(timestampHeader)
		nonce := c.GetHeader(nonceHeader)
		apiKey := c.GetHeader(apiKeyHeader)

		// 验证必需头
		if signature == "" || timestamp == "" || nonce == "" || apiKey == "" {
			c.JSON(401, gin.H{"error": ErrMissingSignature.Error()})
			c.Abort()
			return
		}

		// 获取密钥
		secret, err := m.config.secretProvider.GetSecret(apiKey)
		if err != nil {
			c.JSON(401, gin.H{"error": ErrInvalidSignature.Error()})
			c.Abort()
			return
		}

		// 验证时间戳
		ts, err := strconv.ParseInt(timestamp, 10, 64)
		if err != nil {
			c.JSON(401, gin.H{"error": "invalid timestamp format"})
			c.Abort()
			return
		}

		if m.isTimestampExpired(ts) {
			c.JSON(401, gin.H{"error": ErrExpiredTimestamp.Error()})
			c.Abort()
			return
		}

		// 验证nonce（防重放）
		if m.isNonceUsed(nonce) {
			c.JSON(401, gin.H{"error": ErrDuplicateNonce.Error()})
			c.Abort()
			return
		}

		// 读取请求体
		body, err := m.readRequestBody(c)
		if err != nil {
			c.JSON(400, gin.H{"error": "failed to read request body"})
			c.Abort()
			return
		}

		// 计算并验证签名
		expectedSig := m.calculateSignature(secret, timestamp, nonce, string(body), c.Request.URL.Path, c.Request.Method)
		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			c.JSON(401, gin.H{"error": ErrInvalidSignature.Error()})
			c.Abort()
			return
		}

		// 标记nonce已使用
		m.markNonceUsed(nonce)

		// 将apiKey存入上下文供后续使用
		c.Set("api_key", apiKey)

		// 如果提供了 UserInfoProvider，设置用户ID到上下文
		if userInfoProvider, ok := m.config.secretProvider.(UserInfoProvider); ok {
			if userID, err := userInfoProvider.GetUserID(apiKey); err == nil {
				c.Set("user_id", userID)
			}
		}

		c.Next()
	}
}

// isTimestampExpired 检查时间戳是否过期
func (m *APIAuthMiddleware) isTimestampExpired(timestamp int64) bool {
	now := time.Now().Unix()
	diff := now - timestamp
	return diff > int64(m.config.Tolerance.Seconds()) || diff < -int64(m.config.Tolerance.Seconds())
}

// isNonceUsed 检查nonce是否已使用（线程安全）
func (m *APIAuthMiddleware) isNonceUsed(nonce string) bool {
	m.cacheMu.RLock()
	_, exists := m.nonceCache[nonce]
	m.cacheMu.RUnlock()
	return exists
}

// markNonceUsed 标记nonce已使用（线程安全）
func (m *APIAuthMiddleware) markNonceUsed(nonce string) {
	m.cacheMu.Lock()
	m.nonceCache[nonce] = time.Now()
	m.cacheMu.Unlock()
}

// cleanupLoop 定期清理过期nonce
func (m *APIAuthMiddleware) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.CleanupExpiredNonces()
		case <-m.stopChan:
			return
		}
	}
}

// readRequestBody 读取请求体（带大小限制，防止 OOM 攻击）
func (m *APIAuthMiddleware) readRequestBody(c *gin.Context) ([]byte, error) {
	if c.Request.Body == nil {
		return []byte{}, nil
	}

	// 使用 LimitReader 限制最大读取大小
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, m.config.MaxBodySize+1))
	if err != nil {
		return nil, err
	}

	// 检查是否超过限制
	if int64(len(body)) > m.config.MaxBodySize {
		return nil, errors.New("request body too large for signature verification")
	}

	// 重新设置请求体供后续使用
	c.Request.Body = io.NopCloser(bytes.NewReader(body))

	return body, nil
}

// calculateSignature 计算签名
// signature = HMAC-SHA256(secret, timestamp + nonce + body + path + method)
func (m *APIAuthMiddleware) calculateSignature(secret, timestamp, nonce, body, path, method string) string {
	// 构造签名内容
	content := timestamp + nonce + body + path + method

	// 计算HMAC-SHA256
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(content))

	return hex.EncodeToString(h.Sum(nil))
}

// GenerateSignature 生成签名（供客户端使用）
func GenerateSignature(secret, timestamp, nonce, body, path, method string) string {
	content := timestamp + nonce + body + path + method

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(content))

	return hex.EncodeToString(h.Sum(nil))
}

// GenerateTimestamp 生成时间戳
func GenerateTimestamp() string {
	return strconv.FormatInt(time.Now().Unix(), 10)
}

// GenerateNonce 生成随机nonce（使用加密安全的随机数）
func GenerateNonce() string {
	timestamp := time.Now().UnixNano()
	randomStr, err := randomStringSecure(16)
	if err != nil {
		// 降级到时间戳
		return fmt.Sprintf("%d-%x", timestamp, timestamp)
	}
	return fmt.Sprintf("%d-%s", timestamp, randomStr)
}

// randomStringSecure 生成加密安全的随机字符串
func randomStringSecure(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	max := big.NewInt(int64(len(charset)))

	for i := range result {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		result[i] = charset[n.Int64()]
	}
	return string(result), nil
}

// CleanupExpiredNonces 清理过期的nonce（线程安全）
func (m *APIAuthMiddleware) CleanupExpiredNonces() {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()

	now := time.Now()
	for nonce, timestamp := range m.nonceCache {
		if now.Sub(timestamp) > m.config.CacheDuration {
			delete(m.nonceCache, nonce)
		}
	}
}

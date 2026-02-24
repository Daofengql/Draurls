package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	signatureHeader     = "X-Signature"
	timestampHeader     = "X-Timestamp"
	nonceHeader         = "X-Nonce"
	apiKeyHeader        = "X-API-Key"
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
	secretProvider SecretProvider
}

// SecretProvider 密钥提供者接口
type SecretProvider interface {
	GetSecret(apiKey string) (string, error)
}

// APIAuthMiddleware API签名认证中间件
type APIAuthMiddleware struct {
	config *SignatureConfig
	// 使用内存存储nonce，生产环境建议使用Redis
	nonceCache map[string]time.Time
}

// NewAPIAuthMiddleware 创建API认证中间件
func NewAPIAuthMiddleware(provider SecretProvider, tolerance time.Duration) *APIAuthMiddleware {
	return &APIAuthMiddleware{
		config: &SignatureConfig{
			Tolerance:      tolerance,
			CacheDuration:  15 * time.Minute,
			secretProvider: provider,
		},
		nonceCache: make(map[string]time.Time),
	}
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

		c.Next()
	}
}

// isTimestampExpired 检查时间戳是否过期
func (m *APIAuthMiddleware) isTimestampExpired(timestamp int64) bool {
	now := time.Now().Unix()
	diff := now - timestamp
	return diff > int64(m.config.Tolerance.Seconds()) || diff < -int64(m.config.Tolerance.Seconds())
}

// isNonceUsed 检查nonce是否已使用
func (m *APIAuthMiddleware) isNonceUsed(nonce string) bool {
	_, exists := m.nonceCache[nonce]
	return exists
}

// markNonceUsed 标记nonce已使用
func (m *APIAuthMiddleware) markNonceUsed(nonce string) {
	m.nonceCache[nonce] = time.Now()
}

// readRequestBody 读取请求体
func (m *APIAuthMiddleware) readRequestBody(c *gin.Context) ([]byte, error) {
	if c.Request.Body == nil {
		return []byte{}, nil
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
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

// GenerateNonce 生成随机nonce
func GenerateNonce() string {
	return fmt.Sprintf("%d-%s", time.Now().UnixNano(), randomString(16))
}

func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// CleanupExpiredNonces 清理过期的nonce（定期任务）
func (m *APIAuthMiddleware) CleanupExpiredNonces() {
	now := time.Now()
	for nonce, timestamp := range m.nonceCache {
		if now.Sub(timestamp) > m.config.CacheDuration {
			delete(m.nonceCache, nonce)
		}
	}
}

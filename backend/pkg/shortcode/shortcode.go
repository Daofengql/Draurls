package shortcode

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"

	apperrors "github.com/surls/backend/internal/errors"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const (
	// Base62 字符集
	chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	// 默认短码长度
	defaultLength = 6
	// 最大短码长度
	maxLength = 20
)

var (
	ErrInvalidLength = errors.New("invalid length")
	ErrInvalidCode   = errors.New("invalid code")
)

// GeneratorMode 生成器模式
type GeneratorMode int

const (
	// ModeRandom 随机生成模式（兼容原有方式）
	ModeRandom GeneratorMode = iota
	// ModeSequence 序列号模式（使用 Redis INCR，高并发性能更好）
	ModeSequence
)

// Generator 短码生成器
type Generator struct {
	db         *gorm.DB
	redis      *redis.Client
	codeLength int
	mu         sync.RWMutex
	// 黑名单词库
	blacklist map[string]bool
	// 生成模式
	mode         GeneratorMode
	seqGenerator *SequenceGenerator
}

// GeneratorConfig 生成器配置
type GeneratorConfig struct {
	CodeLength int
	Blacklist  []string
	Mode       GeneratorMode
	Redis      *redis.Client
}

// NewGenerator 创建短码生成器
func NewGenerator(db *gorm.DB, cfg *GeneratorConfig) *Generator {
	if cfg == nil {
		cfg = &GeneratorConfig{CodeLength: defaultLength, Mode: ModeRandom}
	}
	if cfg.CodeLength <= 0 || cfg.CodeLength > maxLength {
		cfg.CodeLength = defaultLength
	}

	blacklist := make(map[string]bool)
	for _, word := range cfg.Blacklist {
		blacklist[word] = true
	}

	g := &Generator{
		db:         db,
		redis:      cfg.Redis,
		codeLength: cfg.CodeLength,
		blacklist:  blacklist,
		mode:       cfg.Mode,
	}

	// 如果配置了 Redis 且使用序列号模式，初始化序列生成器
	if g.redis != nil && g.mode == ModeSequence {
		g.seqGenerator = NewSequenceGenerator(g.redis)
	}

	return g
}

// Generate 生成唯一短码
func (g *Generator) Generate(ctx context.Context) (string, error) {
	// 序列号模式：使用 Redis INCR，高并发性能更好
	if g.mode == ModeSequence && g.seqGenerator != nil {
		return g.generateSequence(ctx)
	}

	// 序列号模式：使用 Redis INCR，高并发性能更好
	const maxRetries = 10

	for i := 0; i < maxRetries; i++ {
		code, err := g.generateRandom()
		if err != nil {
			return "", err
		}

		// 检查是否在黑名单中
		if g.isBlacklisted(code) {
			continue
		}

		// 检查是否已存在
		exists, err := g.exists(ctx, code)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}

	return "", apperrors.ErrCodeTaken
}

// generateSequence 使用序列号模式生成短码
// 通过 Redis INCR 获取唯一 ID，然后使用混淆算法生成短码
func (g *Generator) generateSequence(ctx context.Context) (string, error) {
	id, err := g.seqGenerator.NextID(ctx)
	if err != nil {
		return "", err
	}

	// 使用混淆后的短码，使相邻 ID 生成的短码看起来完全不同
	code := GenerateObfuscatedCode(id)

	// 截取或填充到配置的长度
	g.mu.RLock()
	targetLength := g.codeLength
	g.mu.RUnlock()

	if len(code) > targetLength {
		// 如果生成的短码过长，截取后半部分（混淆效果更好）
		code = code[len(code)-targetLength:]
	} else if len(code) < targetLength {
		// 如果太短，前面补 '0'
		padding := strings.Repeat("0", targetLength-len(code))
		code = padding + code
	}

	// 序列号模式生成的短码不会冲突，但仍需检查黑名单
	if g.isBlacklisted(code) {
		// 如果不幸命中黑名单，跳过这个号码（虽然概率极低）
		return g.generateSequence(ctx)
	}

	return code, nil
}

// GenerateCustom 生成自定义短码
func (g *Generator) GenerateCustom(ctx context.Context, customCode string) (string, error) {
	// 验证格式
	if err := Validate(customCode); err != nil {
		return "", err
	}

	// 检查黑名单
	if g.isBlacklisted(customCode) {
		return "", apperrors.ErrInvalidCode
	}

	// 检查是否已存在
	exists, err := g.exists(ctx, customCode)
	if err != nil {
		return "", err
	}
	if exists {
		return "", apperrors.ErrCodeTaken
	}

	return customCode, nil
}

// generateRandom 生成随机短码
func (g *Generator) generateRandom() (string, error) {
	g.mu.RLock()
	length := g.codeLength
	g.mu.RUnlock()

	result := make([]byte, length)
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		result[i] = chars[n.Int64()]
	}

	return string(result), nil
}

// exists 检查短码是否存在
func (g *Generator) exists(ctx context.Context, code string) (bool, error) {
	var count int64
	err := g.db.WithContext(ctx).
		Table("short_links").
		Where("code = ?", code).
		Count(&count).Error
	return count > 0, err
}

// isBlacklisted 检查是否在黑名单中
func (g *Generator) isBlacklisted(code string) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()

	codeLower := strings.ToLower(code)
	if g.blacklist[codeLower] {
		return true
	}

	// 检查黑名单前缀匹配
	for blacklisted := range g.blacklist {
		if strings.HasPrefix(codeLower, blacklisted) {
			return true
		}
	}

	return false
}

// SetLength 设置短码长度
func (g *Generator) SetLength(length int) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if length > 0 && length <= maxLength {
		g.codeLength = length
	}
}

// SetMode 设置生成模式
func (g *Generator) SetMode(mode GeneratorMode) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.mode = mode

	// 初始化或更新序列生成器
	if g.redis != nil && g.mode == ModeSequence {
		if g.seqGenerator == nil {
			g.seqGenerator = NewSequenceGenerator(g.redis)
		}
	} else if g.mode == ModeRandom {
		g.seqGenerator = nil
	}
}

// GetMode 获取当前模式
func (g *Generator) GetMode() GeneratorMode {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.mode
}

// AddBlacklist 添加黑名单词
func (g *Generator) AddBlacklist(words ...string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, word := range words {
		g.blacklist[strings.ToLower(word)] = true
	}
}

// GenerateFromID 从 ID 生成短码（Base62 编码）
// 注意：这种方式的短码是有规律的，可能不适合所有场景
func GenerateFromID(id uint64) string {
	if id == 0 {
		return string(chars[0])
	}

	var result []byte
	base := int64(len(chars))

	for id > 0 {
		remainder := id % uint64(base)
		result = append([]byte{chars[remainder]}, result...)
		id /= uint64(base)
	}

	return string(result)
}

// DecodeID 将短码解码为 ID
func DecodeID(code string) (uint64, error) {
	if code == "" {
		return 0, ErrInvalidCode
	}

	code = strings.ToLower(strings.TrimSpace(code))
	var id uint64
	base := uint64(len(chars))

	for _, char := range code {
		index := strings.IndexByte(chars, byte(char))
		if index == -1 {
			return 0, ErrInvalidCode
		}
		id = id*base + uint64(index)
	}

	return id, nil
}

// Validate 验证短码是否有效
func Validate(code string) error {
	if code == "" {
		return ErrInvalidCode
	}
	if len(code) < 3 || len(code) > maxLength {
		return fmt.Errorf("code length must be between 3 and %d", maxLength)
	}

	// 只允许包含字母数字
	for _, char := range code {
		if !((char >= '0' && char <= '9') ||
			(char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z')) {
			return ErrInvalidCode
		}
	}

	return nil
}

// Sanitize 清理短码（去除特殊字符，转小写）
func Sanitize(code string) string {
	code = strings.TrimSpace(code)
	code = strings.ToLower(code)

	// 移除非字母数字字符
	var result []rune
	for _, char := range code {
		if (char >= '0' && char <= '9') || (char >= 'a' && char <= 'z') {
			result = append(result, char)
		}
	}

	return string(result)
}

// IsCustomCode 检查是否为自定义短码
func IsCustomCode(code string) bool {
	// 自定义短码通常更长或包含特殊模式
	return len(code) > defaultLength
}

package shortcode

import (
	"math/bits"
)

// FeistelNetwork 使用 Feistel 密码网络混淆 ID
// Feistel 网络是一种可逆的混淆算法，相同明文总是生成相同密文，且可以解密
type FeistelNetwork struct {
	prime    uint64
	keys     []uint64
	rounds   int
}

// NewFeistelNetwork 创建新的 Feistel 网络
// prime: 大质数，用于模运算
// rounds: 轮数，建议 4-8 轮
func NewFeistelNetwork(prime uint64, rounds int) *FeistelNetwork {
	// 使用一些常量作为轮密钥（实际应用中应该从配置读取）
	keys := []uint64{
		0x123456789ABCDEF0,
		0xFEDCBA9876543210,
		0x1111111111111111,
		0x2222222222222222,
		0x3333333333333333,
		0x4444444444444444,
		0x5555555555555555,
		0x6666666666666666,
	}

	if rounds > len(keys) {
		rounds = len(keys)
	}

	return &FeistelNetwork{
		prime:  prime,
		keys:   keys[:rounds],
		rounds: rounds,
	}
}

// DefaultFeistel 默认的 Feistel 网络（2^64 范围）
var DefaultFeistel = NewFeistelNetwork(0xFFFFFFFFFFFFFFC5, 4)

// Encrypt 加密 ID（混淆）
func (f *FeistelNetwork) Encrypt(n uint64) uint64 {
	if f == nil {
		return DefaultFeistel.Encrypt(n)
	}

	// 确保输入在有效范围内
	if n >= f.prime {
		n = n % f.prime
	}

	l := uint32((n >> 32) & 0xFFFFFFFF)
	r := uint32(n & 0xFFFFFFFF)

	for i := 0; i < f.rounds; i++ {
		key := f.keys[i]
		// 轮函数 F
		fResult := f.roundFunction(l, key)
		// Feistel 结构
		newL := r
		newR := l ^ fResult
		l = newL
		r = newR
	}

	return (uint64(l) << 32) | uint64(r)
}

// roundFunction 轮函数，使用混合运算
func (f *FeistelNetwork) roundFunction(v uint32, key uint64) uint32 {
	// 将 key 的高 32 位与 v 混合
	mixed := uint64(v) ^ (key >> 32)
	// 乘法混合
	mixed = mixed * (key & 0xFFFFFFFF)
	// 循环移位
	rotated := bits.RotateLeft64(mixed, 17)
	// 再次异或
	return uint32(rotated ^ (mixed >> 32))
}

// ObfuscateID 混淆 ID（使用默认 Feistel 网络）
func ObfuscateID(id uint64) uint64 {
	return DefaultFeistel.Encrypt(id)
}

// GenerateObfuscatedCode 从 ID 生成混淆后的短码
// 这样相邻的 ID 生成的短码看起来完全不同
func GenerateObfuscatedCode(id uint64) string {
	obfuscated := ObfuscateID(id)
	return EncodeBase62(obfuscated)
}

// EncodeBase62 将数字编码为 Base62
func EncodeBase62(n uint64) string {
	if n == 0 {
		return "0"
	}

	const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	var result []byte

	for n > 0 {
		remainder := n % 62
		result = append([]byte{chars[remainder]}, result...)
		n /= 62
	}

	return string(result)
}

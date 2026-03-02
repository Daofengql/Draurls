package cache

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrLocked = errors.New("resource is locked")
)

const (
	// minBackoff 最小退避时间
	minBackoff = 50 * time.Millisecond
	// maxBackoff 最大退避时间
	maxBackoff = 5 * time.Second
	// backoffFactor 退避因子
	backoffFactor = 1.5
)

// DistributedLock 分布式锁
type DistributedLock struct {
	client    *redis.Client
	key       string
	value     string
	ttl       time.Duration
	acquired  bool
}

// NewDistributedLock 创建分布式锁
func NewDistributedLock(client *redis.Client, key string, ttl time.Duration) *DistributedLock {
	// 使用唯一值标识锁持有者
	value := fmt.Sprintf("%d", time.Now().UnixNano())
	return &DistributedLock{
		client:   client,
		key:      fmt.Sprintf("lock:%s", key),
		value:    value,
		ttl:      ttl,
		acquired: false,
	}
}

// TryLock 尝试获取锁
func (l *DistributedLock) TryLock(ctx context.Context) error {
	ok, err := l.client.SetNX(ctx, l.key, l.value, l.ttl).Result()
	if err != nil {
		return err
	}
	if !ok {
		return ErrLocked
	}
	l.acquired = true
	return nil
}

// Lock 获取锁（使用指数退避 + 随机抖动，避免惊群效应）
func (l *DistributedLock) Lock(ctx context.Context) error {
	// 初始退避时间
	backoff := minBackoff
	// 重试次数计数器
	retries := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 尝试获取锁
			err := l.TryLock(ctx)
			if err == nil {
				return nil
			}
			if !errors.Is(err, ErrLocked) {
				return err
			}

			// 计算带随机抖动的退避时间（避免所有节点同时重试）
			jitter := time.Duration(rand.Int63n(int64(backoff) / 10)) // ±10% 抖动
			waitTime := backoff + jitter

			// 等待
			select {
			case <-time.After(waitTime):
			case <-ctx.Done():
				return ctx.Err()
			}

			// 指数退避
			retries++
			if retries < 10 { // 前10次重试使用指数退避
				backoff = time.Duration(float64(backoff) * backoffFactor)
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
			}
		}
	}
}

// Unlock 释放锁
func (l *DistributedLock) Unlock(ctx context.Context) error {
	if !l.acquired {
		return nil
	}

	// 使用 Lua 脚本确保只释放自己持有的锁
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`

	_, err := l.client.Eval(ctx, script, []string{l.key}, l.value).Result()
	if err == nil {
		l.acquired = false
	}
	return err
}

// Extend 延长锁的过期时间
func (l *DistributedLock) Extend(ctx context.Context, ttl time.Duration) error {
	if !l.acquired {
		return ErrLocked
	}

	// 使用 Lua 脚本确保只延长自己持有的锁
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("expire", KEYS[1], ARGV[2])
		else
			return 0
		end
	`

	_, err := l.client.Eval(ctx, script, []string{l.key}, l.value, int(ttl.Seconds())).Result()
	return err
}

// IsLocked 检查是否被锁定
func (l *DistributedLock) IsLocked(ctx context.Context) bool {
	exists, _ := l.client.Exists(ctx, l.key).Result()
	return exists > 0
}

// LockManager 锁管理器
type LockManager struct {
	client *redis.Client
}

// NewLockManager 创建锁管理器
func NewLockManager(client *redis.Client) *LockManager {
	return &LockManager{client: client}
}

// NewLock 创建新的锁实例
func (m *LockManager) NewLock(key string, ttl time.Duration) *DistributedLock {
	return NewDistributedLock(m.client, key, ttl)
}

// WithLock 使用锁执行函数
func (m *LockManager) WithLock(ctx context.Context, key string, ttl time.Duration, fn func() error) error {
	lock := m.NewLock(key, ttl)
	if err := lock.Lock(ctx); err != nil {
		return err
	}
	defer lock.Unlock(ctx)
	return fn()
}

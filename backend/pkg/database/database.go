package database

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// mysqlLogger 自定义MySQL日志记录器，过滤掉驱动的错误日志
type mysqlLogger struct {
	*log.Logger
}

// filterWriter 过滤写入的内容
type filterWriter struct {
	io.Writer
	filterFunc func(string) bool
}

func (w *filterWriter) Write(p []byte) (n int, err error) {
	s := string(p)
	// 过滤掉 packets.go 相关的错误信息
	if strings.Contains(s, "packets.go") || strings.Contains(s, "wsarecv") {
		return len(p), nil // 假装写入成功，但实际不输出
	}
	// 过滤掉 "connection reset by peer" 相关错误
	if strings.Contains(s, "connection reset") || strings.Contains(s, "broken pipe") {
		return len(p), nil
	}
	return w.Writer.Write(p)
}

// newFilterLogger 创建带过滤功能的日志记录器
func newFilterLogger() *log.Logger {
	return log.New(&filterWriter{Writer: os.Stderr, filterFunc: filterMySQLDriverErrors}, "", log.LstdFlags)
}

func filterMySQLDriverErrors(s string) bool {
	// 过滤MySQL驱动层的连接错误日志
	return strings.Contains(s, "packets.go") ||
		strings.Contains(s, "wsarecv") ||
		strings.Contains(s, "connection reset") ||
		strings.Contains(s, "broken pipe")
}

// Config 数据库配置
type Config struct {
	DSN          string
	LogLevel     logger.LogLevel
	MaxIdleConns int
	MaxOpenConns int
	MaxLifetime  time.Duration
	MaxIdleTime  time.Duration
}

// InitDB 初始化数据库连接
func InitDB(cfg *Config) (*gorm.DB, error) {
	if cfg.MaxIdleTime == 0 {
		cfg.MaxIdleTime = 10 * time.Minute
	}

	// 设置自定义日志记录器，过滤MySQL驱动错误
	sqlLogger := newFilterLogger()

	// 配置GORM日志
	gormLogger := logger.New(
		sqlLogger,
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  cfg.LogLevel,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	// 打开数据库连接
	db, err := gorm.Open(mysql.Open(cfg.DSN), &gorm.Config{
		Logger: gormLogger,
		// 禁用外键约束以提高性能
		DisableForeignKeyConstraintWhenMigrating: true,
		// 跳过默认事务（对于只读操作）
		SkipDefaultTransaction: true,
		// 禁用默认的版本号字段
		DisableAutomaticPing: false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// 设置连接池参数
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(cfg.MaxLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.MaxIdleTime)

	return db, nil
}

// SetupConnectionRetry 设置连接重试回调
func SetupConnectionRetry(db *gorm.DB) {
	// 注册连接回调，处理连接错误
	db.Callback().Create().Before("gorm:create").Register("connection_retry", func(db *gorm.DB) {
		if db.Error == nil {
			return
		}
		// 检查是否是连接错误
		if isConnectionError(db.Error) {
			// 尝试重新连接
			if sqlDB, err := db.DB(); err == nil {
				sqlDB.Ping()
			}
		}
	})
}

func isConnectionError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "broken pipe") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "closed network")
}

// TestConnection 测试数据库连接是否正常
func TestConnection(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

// CloseDB 关闭数据库连接
func CloseDB(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// GetStats 获取数据库连接池统计信息
func GetStats(db *gorm.DB) sql.DBStats {
	sqlDB, err := db.DB()
	if err != nil {
		return sql.DBStats{}
	}
	return sqlDB.Stats()
}

package errors

import "errors"

var (
	// 通用错误
	ErrInvalidInput      = errors.New("invalid input")
	ErrNotFound         = errors.New("resource not found")
	ErrAlreadyExists    = errors.New("resource already exists")
	ErrDuplicateResource = errors.New("resource already exists")
	ErrUnauthorized     = errors.New("unauthorized")
	ErrForbidden        = errors.New("forbidden")
	ErrInternalServer   = errors.New("internal server error")
	ErrQuotaExceeded    = errors.New("quota exceeded")
	ErrInvalidSignature = errors.New("invalid signature")
	ErrExpired          = errors.New("resource expired")
	ErrDisabled         = errors.New("resource disabled")

	// 用户相关错误
	ErrUserNotFound     = errors.New("user not found")
	ErrUserDisabled     = errors.New("user is disabled")
	ErrInvalidCredentials = errors.New("invalid credentials")

	// 链接相关错误
	ErrLinkNotFound     = errors.New("link not found")
	ErrLinkExpired      = errors.New("link has expired")
	ErrLinkDisabled     = errors.New("link is disabled")
	ErrInvalidCode      = errors.New("invalid short code")
	ErrCodeTaken        = errors.New("short code already taken")
	ErrCircularLink     = errors.New("circular link detected")

	// API Key 相关错误
	ErrInvalidAPIKey    = errors.New("invalid API key")
	ErrAPIKeyDisabled   = errors.New("API key is disabled")
	ErrAPIKeyExpired    = errors.New("API key has expired")

	// 域名相关错误
	ErrDomainNotFound   = errors.New("domain not found")
	ErrDomainExists     = errors.New("domain already exists")
	ErrDomainInUse      = errors.New("domain is in use")
)

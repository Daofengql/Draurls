package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

// KeycloakConfig Keycloak配置
type KeycloakConfig struct {
	BaseURL   string
	Realm     string
	ClientID  string
	Secret    string
	CallbackURL string
}

// KeycloakAuth Keycloak认证服务
type KeycloakAuth struct {
	config    *KeycloakConfig
	oauth2    *oauth2.Config
	publicKey interface{}
}

// NewKeycloakAuth 创建Keycloak认证服务
func NewKeycloakAuth(config *KeycloakConfig) *KeycloakAuth {
	return &KeycloakAuth{
		config: config,
		oauth2: &oauth2.Config{
			ClientID:     config.ClientID,
			ClientSecret: config.Secret,
			RedirectURL:  config.CallbackURL,
			Endpoint: oauth2.Endpoint{
				AuthURL:  fmt.Sprintf("%s/realms/%s/protocol/openid-connect/auth", config.BaseURL, config.Realm),
				TokenURL: fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", config.BaseURL, config.Realm),
			},
			Scopes: []string{"openid", "profile", "email"},
		},
	}
}

// GetAuthURL 获取授权URL
func (k *KeycloakAuth) GetAuthURL(state string) string {
	return k.oauth2.AuthCodeURL(state)
}

// ExchangeCode 用授权码换取Token
func (k *KeycloakAuth) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	return k.oauth2.Exchange(ctx, code)
}

// RefreshToken 刷新Token
func (k *KeycloakAuth) RefreshToken(ctx context.Context, refreshToken string) (*oauth2.Token, error) {
	ts := k.oauth2.TokenSource(ctx, &oauth2.Token{RefreshToken: refreshToken})
	return ts.Token()
}

// UserInfo 用户信息
type UserInfo struct {
	KeycloakID string `json:"sub"`
	Username   string `json:"preferred_username"`
	Email      string `json:"email"`
	FirstName  string `json:"given_name"`
	LastName   string `json:"family_name"`
	EmailVerified bool `json:"email_verified"`
}

// GetUserInfo 获取用户信息
func (k *KeycloakAuth) GetUserInfo(ctx context.Context, token *oauth2.Token) (*UserInfo, error) {
	client := k.oauth2.Client(ctx, token)
	url := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/userinfo", k.config.BaseURL, k.config.Realm)

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, errors.New("failed to get user info")
	}

	var userInfo UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

// ValidateToken 验证JWT Token
func (k *KeycloakAuth) ValidateToken(tokenString string) (*jwt.Token, *jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			// 临时跳过验证，生产环境需要从Keycloak获取公钥
			return []byte("secret"), nil
		}
		return k.publicKey, nil
	})

	if err != nil {
		return nil, nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return token, &claims, nil
	}

	return nil, nil, errors.New("invalid token")
}

// ExtractUserInfo 从Token中提取用户信息
func (k *KeycloakAuth) ExtractUserInfo(tokenString string) (*UserInfo, error) {
	_, claims, err := k.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	return &UserInfo{
		KeycloakID: (*claims)["sub"].(string),
		Username:   (*claims)["preferred_username"].(string),
		Email:      (*claims)["email"].(string),
	}, nil
}

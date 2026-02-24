const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

interface LoginURLResponse {
  login_url: string
  state: string
}

interface UserInfo {
  id: number
  keycloak_id: string
  username: string
  email: string
  role: 'admin' | 'user'
  quota: number
  quota_used: number
  status: string
}

export class AuthService {
  /**
   * 获取 Keycloak 登录 URL
   */
  async getLoginURL(redirectTo: string = '/dashboard'): Promise<{ loginUrl: string; state: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ redirect_to: redirectTo }),
    })

    if (!response.ok) {
      throw new Error('获取登录 URL 失败')
    }

    const data = await response.json() as { code: number; data: LoginURLResponse }
    return {
      loginUrl: data.data.login_url,
      state: data.data.state,
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      throw new Error('刷新 Token 失败')
    }

    const data = await response.json()
    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
    }
  }

  /**
   * 登出
   */
  async logout(refreshToken: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }

  /**
   * 获取当前用户信息
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('获取用户信息失败')
    }

    const data = await response.json()
    return data.data
  }

  /**
   * 使用弹窗方式登录
   * @returns Promise<boolean> 登录是否成功
   */
  loginWithPopup(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 打开登录窗口
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const loginWindow = window.open(
        '',
        'keycloak-login',
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes`,
      )

      if (!loginWindow) {
        reject(new Error('无法打开登录窗口，请检查弹窗是否被阻止'))
        return
      }

      // 监听来自回调窗口的消息
      const messageHandler = (event: MessageEvent) => {
        // 验证消息来源（生产环境应该更严格地验证）
        const allowedOrigins = [
          'http://localhost:8080',
          'http://localhost:3000',
          'http://localhost:5173',
        ]

        if (!allowedOrigins.includes(event.origin)) {
          return
        }

        const { type, message, redirectTarget } = event.data

        if (type === 'LOGIN_SUCCESS') {
          // 登录成功，延迟关闭监听器以确保 Cookie 已设置
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            resolve(true)
          }, 500)
        } else if (type === 'LOGIN_FAILED') {
          window.removeEventListener('message', messageHandler)
          reject(new Error(message || '登录失败'))
        }
      }

      window.addEventListener('message', messageHandler)

      // 获取登录 URL 并在新窗口中打开
      this.getLoginURL(window.location.pathname).then(({ loginUrl }) => {
        loginWindow!.location.href = loginUrl
      }).catch((err) => {
        loginWindow?.close()
        window.removeEventListener('message', messageHandler)
        reject(err)
      })

      // 检查窗口是否被关闭
      const checkClosed = setInterval(() => {
        if (loginWindow.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          resolve(false) // 用户关闭了窗口，视为取消登录
        }
      }, 1000)
    })
  }
}

export const authService = new AuthService()

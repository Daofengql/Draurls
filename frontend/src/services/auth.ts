// 【前置逻辑说明】
// 统一使用相对路径，与 api.ts 保持一致
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

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
      const height = 850
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const loginWindow = window.open(
        '',
        'keycloak-login',
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes`,
      )

      console.log('Login window opened:', loginWindow)

      if (!loginWindow) {
        reject(new Error('无法打开登录窗口，请检查弹窗是否被阻止'))
        return
      }

      // 用于跟踪是否已收到消息
      let messageReceived = false

      // 监听来自回调窗口的消息
      const messageHandler = async (event: MessageEvent) => {
        console.log('Received postMessage:', event)
        console.log('Event origin:', event.origin)

        // 验证消息来源：只接受来自当前窗口 origin 的消息
        if (event.origin !== window.location.origin) {
          console.log('Origin mismatch:', event.origin, '!=', window.location.origin)
          return
        }

        const { type, message } = event.data
        console.log('Message data:', event.data)

        if (type === 'LOGIN_SUCCESS') {
          console.log('LOGIN_SUCCESS received')
          messageReceived = true
          window.removeEventListener('message', messageHandler)

          // 登录成功，等待 Cookie 设置完成
          // 先尝试获取用户信息来验证
          await new Promise(r => setTimeout(r, 1000))

          try {
            const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
              credentials: 'include',
            })
            if (response.ok) {
              // Cookie 已经有效
              console.log('Cookie verified, resolving login')
              resolve(true)
            } else {
              // Cookie 还没设置好，再等一下
              await new Promise(r => setTimeout(r, 1000))
              console.log('Cookie may not be set yet, but resolving')
              resolve(true)
            }
          } catch (e) {
            console.error('Profile fetch error:', e)
            // 即使获取失败也认为登录成功（可能是网络问题）
            resolve(true)
          }
        } else if (type === 'LOGIN_FAILED') {
          console.log('LOGIN_FAILED received:', message)
          messageReceived = true
          window.removeEventListener('message', messageHandler)
          reject(new Error(message || '登录失败'))
        }
      }

      window.addEventListener('message', messageHandler)

      // 获取登录 URL 并在新窗口中打开
      console.log('Fetching login URL...')
      // 使用前端完整的 URL 作为 redirect_to
      const redirectUrl = window.location.origin + '/dashboard'
      this.getLoginURL(redirectUrl).then(({ loginUrl }) => {
        console.log('Login URL fetched, navigating popup to:', loginUrl)
        loginWindow!.location.href = loginUrl
      }).catch((err) => {
        console.error('Failed to get login URL:', err)
        loginWindow?.close()
        window.removeEventListener('message', messageHandler)
        reject(err)
      })

      // 检查窗口是否被关闭 - 延迟启动以避免在页面加载期间误判
      setTimeout(() => {
        const checkClosed = setInterval(() => {
          if (loginWindow.closed && !messageReceived) {
            console.log('Login window was closed by user')
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            resolve(false) // 用户关闭了窗口，视为取消登录
          }
        }, 500)
      }, 3000) // 3秒后开始检查，给页面跳转和加载留出充足时间
    })
  }
}

export const authService = new AuthService()

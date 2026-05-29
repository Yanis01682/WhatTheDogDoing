/**
 * 认证视图组件（登录/注册二合一）。
 * 用法：由 App 传入状态与回调，组件仅负责表单 UI 和事件触发。
 */
import { useState } from 'react'

function AuthView({
  // 控制当前显示注册表单或登录表单。
  showRegisterForm,
  // 注册提交回调，接收 form submit 事件。
  onRegister,
  // 登录提交回调，接收 form submit 事件。
  onLogin,
  // 切换到注册页面。
  onShowRegister,
  // 从注册返回登录。
  onBackToLogin
}) {
  // 登录表单密码可见性
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  // 注册表单密码可见性
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false)

  if (showRegisterForm) {
    return (
      <div className="im-shell">
        <div className="login-container">
          <div className="register-box">
            <div className="register-header">
              <div className="brand-logo">
                <span className="brand-dot"></span>
                <h1>Aegis</h1>
              </div>
              <p className="register-subtitle">加入守誓通讯</p>
            </div>

            <form className="register-form" onSubmit={onRegister}>
              <div className="form-group">
                <label htmlFor="username">用户名</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="请输入用户名"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">邮箱</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="请输入邮箱地址"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">密码</label>
                <div className="password-input-wrapper">
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    placeholder="请输入密码（至少 6 位）"
                    autoComplete="new-password"
                    minLength="6"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    aria-label={showRegisterPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showRegisterPassword ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">确认密码</label>
                <div className="password-input-wrapper">
                  <input
                    type={showRegisterConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="请再次输入密码"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                    aria-label={showRegisterConfirmPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showRegisterConfirmPassword ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" name="agreementAccepted" value="true" required />
                  <span>我已阅读并同意《用户协议》和《隐私政策》</span>
                </label>
              </div>

              <button type="submit" className="register-btn">
                立即注册
              </button>

              <div className="register-divider">
                <span>已有账号？</span>
              </div>

              <button type="button" className="back-to-login-btn" onClick={onBackToLogin}>
                返回登录
              </button>
            </form>
          </div>

          <div className="login-background">
            <div className="bg-circle bg-circle-1"></div>
            <div className="bg-circle bg-circle-2"></div>
            <div className="bg-circle bg-circle-3"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="im-shell">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <div className="brand-logo">
              <span className="brand-dot"></span>
              <h1>Aegis</h1>
            </div>
            <p className="login-subtitle">Order Messenger</p>
          </div>

          <form className="login-form" onSubmit={onLogin}>
            <div className="form-group">
              <label htmlFor="account">账号</label>
              <input
                type="text"
                id="account"
                name="account"
                placeholder="用户名 / 邮箱"
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">密码</label>
              <div className="password-input-wrapper">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? '隐藏密码' : '显示密码'}
                >
                  {showLoginPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>记住我</span>
              </label>
              <a href="#" className="forgot-link">忘记密码？</a>
            </div>

            <button type="submit" className="login-btn">
              登录
            </button>

            <div className="login-footer">
              <p>还没有账号？<a href="#" onClick={(e) => { e.preventDefault(); onShowRegister() }}>立即注册</a></p>
            </div>
          </form>
        </div>

        <div className="login-background">
          <div className="bg-circle bg-circle-1"></div>
          <div className="bg-circle bg-circle-2"></div>
          <div className="bg-circle bg-circle-3"></div>
        </div>
      </div>
    </div>
  )
}

export default AuthView

/**
 * 认证视图组件（登录/注册二合一）。
 * 用法：由 App 传入状态与回调，组件仅负责表单 UI 和事件触发。
 */
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
  if (showRegisterForm) {
    return (
      <div className="im-shell">
        <div className="login-container">
          <div className="register-box">
            <div className="register-header">
              <div className="brand-logo">
                <span className="brand-dot"></span>
                <h1>WhatTheDogDoing</h1>
              </div>
              <p className="register-subtitle">创建新账号</p>
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
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="请输入密码（至少 6 位）"
                  autoComplete="new-password"
                  minLength="6"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">确认密码</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" required />
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
              <h1>WhatTheDogDoing</h1>
            </div>
            <p className="login-subtitle">即时通讯工具</p>
          </div>

          <form className="login-form" onSubmit={onLogin}>
            <div className="form-group">
              <label htmlFor="account">账号</label>
              <input
                type="text"
                id="account"
                name="account"
                placeholder="邮箱 / 手机号"
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">密码</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="请输入密码"
                autoComplete="current-password"
              />
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

            <div className="login-divider">
              <span>其他登录方式</span>
            </div>

            <div className="social-login">
              <button type="button" className="social-btn wechat">微信</button>
              <button type="button" className="social-btn qq">QQ</button>
            </div>

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

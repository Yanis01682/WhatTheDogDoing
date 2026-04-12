/**
 * 用户协议和隐私政策模态框组件。
 */

import { useEffect, useRef, useState } from 'react'

function LegalModal({ isOpen, onClose, title, children, onReadComplete }) {
  const [isReadComplete, setIsReadComplete] = useState(false)
  const modalBodyRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    
    const handleScroll = () => {
      const body = modalBodyRef.current
      if (!body) return

      const scrollTop = body.scrollTop
      const scrollHeight = body.scrollHeight
      const clientHeight = body.clientHeight
      
      // 当滚动到距离底部 50px 以内时，认为已阅读完成
      if (scrollHeight - scrollTop - clientHeight < 50) {
        setIsReadComplete(true)
        if (onReadComplete) {
          onReadComplete()
        }
      }
    }

    const body = modalBodyRef.current
    if (body) {
      body.addEventListener('scroll', handleScroll)
      // 重置状态
      setIsReadComplete(false)
      
      // 检查初始状态（如果内容很短不需要滚动）
      if (body.scrollHeight <= body.clientHeight) {
        setIsReadComplete(true)
        if (onReadComplete) {
          onReadComplete()
        }
      }
    }

    return () => {
      if (body) {
        body.removeEventListener('scroll', handleScroll)
      }
    }
  }, [isOpen, onReadComplete])

  if (!isOpen) return null

  return (
    <div className="legal-modal-overlay" onClick={onClose}>
      <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="legal-modal-header">
          <h2>{title}</h2>
          <button className="legal-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="legal-modal-body" ref={modalBodyRef}>
          {children}
        </div>
        <div className="legal-modal-footer">
          <button 
            className={`legal-modal-confirm ${isReadComplete ? 'read-complete' : ''}`}
            onClick={() => {
              if (isReadComplete && onReadComplete) {
                onReadComplete()
              }
              onClose()
            }}
            disabled={!isReadComplete}
          >
            {isReadComplete ? '我已阅读并同意' : '请滚动到底部阅读完整内容'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserAgreementModal({ isOpen, onClose, onReadComplete }) {
  return (
    <LegalModal isOpen={isOpen} onClose={onClose} title="用户协议" onReadComplete={onReadComplete}>
      <div className="legal-content">
        <h3>1. 协议的范围</h3>
        <p>本协议是您与 WhatTheDogDoing（以下简称"本平台"）之间关于使用本平台即时通讯服务所订立的协议。您在使用本平台服务前，请仔细阅读并充分理解本协议的全部内容。</p>

        <h3>2. 服务说明</h3>
        <p>本平台提供即时通讯服务，包括但不限于文字聊天、文件传输、群组交流等功能。本平台有权根据业务发展和运营需要，对服务内容进行调整或更新。</p>

        <h3>3. 用户账号</h3>
        <p>3.1 您应提供真实、准确、完整的注册信息，并在信息变更时及时更新。</p>
        <p>3.2 您应妥善保管自己的账号和密码，因您保管不善导致账号被盗用或遭受其他损失的，由您自行承担。</p>
        <p>3.3 您不得将账号转让、出租、出借或以其他方式提供给他人使用。</p>

        <h3>4. 用户行为规范</h3>
        <p>4.1 您在使用本平台服务时，应遵守法律法规，不得利用本平台从事以下行为：</p>
        <ul>
          <li>发布违反国家法律法规的内容</li>
          <li>发布侵犯他人知识产权、肖像权、隐私权的内容</li>
          <li>传播计算机病毒等破坏性程序</li>
          <li>骚扰、诋毁、骂他人</li>
          <li>其他违法违规或不道德的行为</li>
        </ul>
        <p>4.2 本平台有权对您发布的内容进行审核，并对违规行为采取警告、限制功能、封禁账号等措施。</p>

        <h3>5. 知识产权</h3>
        <p>5.1 本平台及其内容（包括但不限于文字、图片、音频、视频、软件、代码等）的知识产权归本平台或相关权利人所有。</p>
        <p>5.2 未经本平台书面许可，您不得擅自使用、复制、修改、传播本平台的内容。</p>

        <h3>6. 隐私保护</h3>
        <p>本平台重视用户隐私保护，有关个人信息收集、使用和保护的规则，请参见本平台《隐私政策》。</p>

        <h3>7. 免责声明</h3>
        <p>7.1 本平台不保证服务不会中断，也不保证服务的及时性、安全性、准确性。</p>
        <p>7.2 对于因网络状况、通讯故障、第三方服务等非本平台原因导致的服务中断或数据丢失，本平台不承担责任。</p>
        <p>7.3 您通过本平台与他人进行交流或交易，相关风险由您自行承担。</p>

        <h3>8. 协议的变更与终止</h3>
        <p>8.1 本平台有权根据需要随时修改本协议内容，修改后的协议将在平台上公布。</p>
        <p>8.2 您继续使用本平台服务即视为接受修改后的协议。如您不同意修改内容，应立即停止使用本平台服务。</p>

        <h3>9. 法律适用与争议解决</h3>
        <p>9.1 本协议的解释、效力及纠纷的解决，适用中华人民共和国法律。</p>
        <p>9.2 因本协议引起的或与本协议有关的任何争议，双方应首先友好协商解决；协商不成的，任何一方均有权向本平台所在地有管辖权的人民法院提起诉讼。</p>

        <h3>10. 其他</h3>
        <p>10.1 本协议构成双方就使用本平台服务达成的完整协议。</p>
        <p>10.2 本协议部分条款无效不影响其他条款的效力。</p>
      </div>
    </LegalModal>
  )
}

export function PrivacyPolicyModal({ isOpen, onClose, onReadComplete }) {
  return (
    <LegalModal isOpen={isOpen} onClose={onClose} title="隐私政策" onReadComplete={onReadComplete}>
      <div className="legal-content">
        <h3>1. 信息收集</h3>
        <p>为了向您提供优质的即时通讯服务，我们可能会收集以下信息：</p>
        <ul>
          <li><strong>账号信息：</strong>用户名、邮箱地址、密码等注册信息</li>
          <li><strong>设备信息：</strong>设备型号、操作系统版本、浏览器类型等</li>
          <li><strong>使用信息：</strong>您使用服务的时间、频率、操作记录等</li>
          <li><strong>通讯内容：</strong>您发送和接收的消息内容（端到端加密）</li>
        </ul>

        <h3>2. 信息使用</h3>
        <p>我们收集的信息将用于以下用途：</p>
        <ul>
          <li>为您提供即时通讯服务</li>
          <li>改进和优化我们的服务</li>
          <li>保障服务安全和用户权益</li>
          <li>发送服务通知（如系统更新、安全提醒等）</li>
        </ul>

        <h3>3. 信息存储与保护</h3>
        <p>3.1 我们将采取合理的安全措施保护您的个人信息，防止信息泄露、丢失或被篡改。</p>
        <p>3.2 您的个人信息将存储在中国境内的服务器上。</p>
        <p>3.3 我们采用端到端加密技术保护您的通讯内容，未经您的授权，我们无法查看您的聊天内容。</p>

        <h3>4. 信息共享与披露</h3>
        <p>4.1 我们不会向第三方出售、出租或分享您的个人信息，以下情况除外：</p>
        <ul>
          <li>获得您的明确同意</li>
          <li>为履行法定义务或配合执法机关调查</li>
          <li>为维护本平台或用户的合法权益</li>
        </ul>
        <p>4.2 我们可能会对数据进行匿名化处理，用于统计分析和产品优化。</p>

        <h3>5. 您的权利</h3>
        <p>您对自己的个人信息享有以下权利：</p>
        <ul>
          <li><strong>查阅权：</strong>您可以随时查阅您的个人信息</li>
          <li><strong>更正权：</strong>您可以更正不准确或不完整的个人信息</li>
          <li><strong>删除权：</strong>在符合法律规定的情况下，您可以要求删除您的个人信息</li>
          <li><strong>注销权：</strong>您可以随时注销账号，注销后我们将删除或匿名化您的个人信息</li>
        </ul>

        <h3>6. Cookie 的使用</h3>
        <p>我们使用 Cookie 和类似技术来提升用户体验，例如记住您的登录状态、偏好设置等。您可以通过浏览器设置管理或禁用 Cookie。</p>

        <h3>7. 未成年人保护</h3>
        <p>我们重视未成年人的隐私保护。如果您是未满 18 周岁的未成年人，请在父母或监护人的指导下阅读本政策，并在取得其同意后使用我们的服务。</p>

        <h3>8. 政策的变更</h3>
        <p>8.1 我们可能会不时更新本隐私政策。政策变更后，我们将在平台上发布更新后的政策。</p>
        <p>8.2 如果您不同意变更后的政策，应停止使用我们的服务。继续使用即视为接受变更。</p>

        <h3>9. 联系我们</h3>
        <p>如果您对本隐私政策有任何疑问、意见或建议，请通过以下方式联系我们：</p>
        <ul>
          <li>邮箱：privacy@whatthedogdoing.com</li>
          <li>反馈渠道：应用内的"意见反馈"功能</li>
        </ul>
        <p>我们将在收到您的反馈后尽快回复。</p>

        <h3>10. 生效日期</h3>
        <p>本隐私政策自发布之日起生效。</p>
      </div>
    </LegalModal>
  )
}

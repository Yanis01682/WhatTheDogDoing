export function normalizeForwardData(forwardData) {
  if (!forwardData) return null

  let parsed = forwardData
  if (typeof forwardData === 'string') {
    try {
      parsed = JSON.parse(forwardData)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) {
    return null
  }

  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : '聊天记录',
    messages: parsed.messages.map((message) => ({
      senderName: message?.senderName || '未知用户',
      text: message?.text || '',
      type: message?.type || 'text',
      time: message?.time || '',
      mediaUrl: message?.mediaUrl || null,
      mediaName: message?.mediaName || null,
      forwardData: normalizeForwardData(message?.forwardData),
    })),
  }
}

export function getForwardMessageLabel(message) {
  if (!message) return ''
  if (message.type === 'image') return '[图片]'
  if (message.type === 'video') return '[视频]'
  if (message.type === 'file') return `[文件]${message.mediaName ? ` ${message.mediaName}` : ''}`
  if (message.type === 'voice') return '[语音]'
  if (message.type === 'forward') return `[聊天记录]${message.forwardData?.title ? ` ${message.forwardData.title}` : ''}`
  return message.text || ''
}


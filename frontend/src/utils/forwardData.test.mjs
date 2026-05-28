import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getForwardMessageLabel, normalizeForwardData } from './forwardData.js'

test('normalizes object forward data', () => {
  const result = normalizeForwardData({
    title: '聊天记录',
    messages: [{ senderName: 'alice', text: 'hello', type: 'text' }],
  })

  assert.equal(result.title, '聊天记录')
  assert.equal(result.messages[0].senderName, 'alice')
  assert.equal(result.messages[0].text, 'hello')
})

test('normalizes json string forward data from realtime notifications', () => {
  const result = normalizeForwardData(JSON.stringify({
    title: '转发记录',
    messages: [{ senderName: 'bob', text: 'ok', type: 'text' }],
  }))

  assert.equal(result.title, '转发记录')
  assert.equal(result.messages[0].senderName, 'bob')
  assert.equal(result.messages[0].text, 'ok')
})

test('rejects invalid forward data without throwing', () => {
  assert.equal(normalizeForwardData('{bad json'), null)
  assert.equal(normalizeForwardData({ title: 'missing messages' }), null)
})

test('labels forwarded media previews', () => {
  assert.equal(getForwardMessageLabel({ type: 'image' }), '[图片]')
  assert.equal(getForwardMessageLabel({ type: 'file', mediaName: 'report.pdf' }), '[文件] report.pdf')
  assert.equal(getForwardMessageLabel({ type: 'forward', forwardData: { title: '聊天记录', messages: [] } }), '[聊天记录] 聊天记录')
})


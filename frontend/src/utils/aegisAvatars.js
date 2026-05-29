export const AEGIS_DEFAULT_USER_AVATAR = '/aegis-avatar-shield.svg'
export const AEGIS_DEFAULT_GROUP_AVATAR = '/aegis-avatar-order.svg'

export const AEGIS_AVATAR_PRESETS = [
  { id: 'shield', label: '守誓盾徽', value: AEGIS_DEFAULT_USER_AVATAR },
  { id: 'sword', label: '银刃骑士', value: '/aegis-avatar-sword.svg' },
  { id: 'templar', label: '圣殿誓约', value: '/aegis-avatar-templar.svg' },
  { id: 'order', label: '翡翠教团', value: AEGIS_DEFAULT_GROUP_AVATAR },
]

export function resolveAegisAvatar(value, fallback = AEGIS_DEFAULT_USER_AVATAR) {
  if (!value || value === '/default-avatar.png') return fallback
  return value
}

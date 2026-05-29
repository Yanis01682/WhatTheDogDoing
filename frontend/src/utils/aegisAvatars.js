export const AEGIS_DEFAULT_USER_AVATAR = '/aegis-avatar-warden-v2.png'
export const AEGIS_DEFAULT_GROUP_AVATAR = '/aegis-avatar-group.png'

export const AEGIS_AVATAR_PRESETS = [
  { id: 'warden', label: '圣殿守卫', value: AEGIS_DEFAULT_USER_AVATAR },
  { id: 'sword', label: '银刃骑士', value: '/aegis-avatar-sword.png' },
  { id: 'templar', label: '圣殿誓约', value: '/aegis-avatar-oath-v2.png' },
  { id: 'ranger', label: '月林游侠', value: '/aegis-avatar-ranger-v2.png' },
]

export function resolveAegisAvatar(value, fallback = AEGIS_DEFAULT_USER_AVATAR) {
  if (
    !value ||
    value === '/default-avatar.png' ||
    value === '/aegis-avatar-shield.svg' ||
    value === '/aegis-avatar-user.png' ||
    value === '/aegis-avatar-ranger.svg'
  ) return fallback
  if (value === '/aegis-avatar-order.svg') return AEGIS_DEFAULT_GROUP_AVATAR
  return value
}

// 初始好友列表：用于 App 首次渲染好友面板，字段会被好友分组、私聊会话创建等逻辑复用。
export const INITIAL_FRIENDS = [
  { id: 101, name: '张三', avatar: '张', status: 'online', signature: '人生若只如初见', group: '常用', remark: '' },
  { id: 102, name: '李四', avatar: '李', status: 'offline', signature: '这个家伙很懒', group: '朋友', remark: '' },
  { id: 103, name: '王五', avatar: '王', status: 'busy', signature: '努力奋斗中...', group: '同事', remark: '' },
  { id: 104, name: '赵六', avatar: '赵', status: 'away', signature: '世界那么大，我想去看看', group: '朋友', remark: '' },
  { id: 105, name: '钱七', avatar: '钱', status: 'invisible', signature: '低调做人，高调做事', group: '同事', remark: '' }
]

// 初始好友分组：SidebarPanel 会按此顺序渲染分组头。
export const INITIAL_CUSTOM_GROUPS = ['常用', '同事', '朋友']

// 群成员映射：key 为会话 id，value 为该群的成员数组（含角色/在线状态）。
// 用于成员管理、聊天头部在线人数统计、聊天详情页角色判断。
export const INITIAL_GROUP_MEMBERS = {
  0: [
    { id: 1, name: '张三', avatar: '张', role: 'owner', online: true },
    { id: 2, name: 'Alice', avatar: 'A', role: 'admin', online: true },
    { id: 3, name: 'Bob', avatar: 'B', role: 'member', online: true },
    { id: 4, name: 'Charlie', avatar: 'C', role: 'member', online: false },
    { id: 5, name: 'David', avatar: 'D', role: 'member', online: true },
    { id: 6, name: 'Eve', avatar: 'E', role: 'member', online: true },
    { id: 7, name: 'Frank', avatar: 'F', role: 'member', online: false },
    { id: 8, name: 'Grace', avatar: 'G', role: 'member', online: true }
  ],
  1: [
    { id: 1, name: '前端 - 李明', avatar: '李', role: 'owner', online: true },
    { id: 2, name: '前端 - 王芳', avatar: '王', role: 'admin', online: true },
    { id: 3, name: '前端 - 赵强', avatar: '赵', role: 'member', online: true },
    { id: 4, name: '前端 - 刘娜', avatar: '刘', role: 'member', online: false },
    { id: 5, name: '前端 - 陈杰', avatar: '陈', role: 'member', online: true },
    { id: 6, name: '前端 - 杨帆', avatar: '杨', role: 'member', online: true },
    { id: 7, name: '前端 - 周敏', avatar: '周', role: 'member', online: true },
    { id: 8, name: '前端 - 吴涛', avatar: '吴', role: 'member', online: false },
    { id: 9, name: '前端 - 郑红', avatar: '郑', role: 'member', online: true },
    { id: 10, name: '前端 - 孙丽', avatar: '孙', role: 'member', online: true },
    { id: 11, name: '前端 - 马超', avatar: '马', role: 'member', online: true },
    { id: 12, name: '前端 - 朱琳', avatar: '朱', role: 'member', online: false }
  ],
  2: [],
  3: [
    { id: 1, name: '爸爸', avatar: '爸', role: 'owner', online: true },
    { id: 2, name: '妈妈', avatar: '妈', role: 'admin', online: true },
    { id: 3, name: '我', avatar: '我', role: 'member', online: true },
    { id: 4, name: '妹妹', avatar: '妹', role: 'member', online: false },
    { id: 5, name: '爷爷', avatar: '爷', role: 'member', online: true }
  ]
}

// 个人资料初始值：在用户首次登录或本地缓存缺失时作为兜底数据。
export const INITIAL_PROFILE_DATA = {
  nickname: '',
  email: '',
  phone: '',
  bio: '',
  gender: 'male'
}

// 初始消息：按会话 id 建立消息索引，聊天主窗体根据 currentChat 读取。
export const INITIAL_MESSAGES = {
  0: [
    { id: 1, text: '你好，欢迎加入产品组讨论群！', sender: 'system', time: '10:00' },
    { id: 2, text: '大家下午好，今天的产品需求已经更新了，请大家查看。', sender: 'other', time: '10:05' },
    { id: 3, text: '好的，谢谢提醒。', sender: 'me', time: '10:10' },
    { id: 4, text: '下午把接口文档同步下。', sender: 'me', time: '14:30' }
  ],
  1: [
    { id: 1, text: '大家好，前端开发群已经建立。', sender: 'system', time: '10:00' },
    { id: 2, text: 'Alice: 新版登录页我已经提 PR', sender: 'other', time: '13:58' }
  ],
  2: [
    { id: 1, text: '17:30 自动提醒填写日报', sender: 'system', time: '12:20' }
  ],
  3: [
    { id: 1, text: '妈妈：今晚回来吃饭吗？', sender: 'other', time: '09:11' }
  ]
}

// 当前用户在不同群中的角色映射，控制群管理相关按钮权限显示。
export const MY_ROLE_MAP = {
  0: 'admin',
  1: 'member',
  2: 'member',
  3: 'member'
}

// 默认会话列表：应用初始时固定会话，动态会话会在运行期插入到该列表前面。
export const DEFAULT_SESSIONS = [
  {
    id: 0,
    title: '产品组讨论',
    avatar: '产',
    lastMessage: '你：下午把接口文档同步下',
    time: '14:32',
    badge: 2,
    online: 8,
    isGroup: true
  },
  {
    id: 1,
    title: '前端开发群',
    avatar: '前',
    lastMessage: 'Alice: 新版登录页我已经提 PR',
    time: '13:58',
    badge: 0,
    online: 12,
    isGroup: true
  },
  {
    id: 2,
    title: '项目日报机器人',
    avatar: '机',
    lastMessage: '17:30 自动提醒填写日报',
    time: '12:20',
    badge: 0,
    online: 0,
    isGroup: false
  },
  {
    id: 3,
    title: '家人群',
    avatar: '家',
    lastMessage: '妈妈：今晚回来吃饭吗？',
    time: '09:11',
    badge: 1,
    online: 5,
    isGroup: true
  }
]

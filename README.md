# Aegis 即时通讯系统

本项目是清华大学 2026 春季学期软件工程课程的大作业小组项目，

小组成员：zzy、zj、mwq、wjq。

## 项目简介

Aegis 是一个前后端分离的 PC Web 即时通讯系统，面向普通用户提供账号注册登录、个人资料维护、好友管理、单聊、群聊、消息收发、群公告、成员权限管理、实时通知等核心能力。在完成课程基础需求的基础上，项目进一步实现了个人笔记、动态广场、消息转译、群聊机器人和井字棋邀请等扩展功能。

项目采用 React + Vite 构建前端单页应用，FastAPI 提供后端 REST API、WebSocket 与长轮询通知能力，SQLAlchemy 负责数据库访问。默认数据库为 SQLite，也可以通过 `DATABASE_URL` 切换到 MySQL。

## 主要功能

- 用户系统：注册、登录、登出、JWT 鉴权、密码修改、资料编辑和账号注销。
- 好友系统：用户搜索、好友申请、申请处理、好友备注、分组和删除。
- 会话与消息：私聊、群聊、文本消息、多媒体消息、回复、撤回、未读统计、置顶和免打扰。
- 群聊管理：创建群聊、邀请成员、入群申请审核、群公告、群昵称、管理员、群主转让、踢人、退出和解散群聊。
- 实时能力：WebSocket 在线推送为主，HTTP 长轮询作为降级通道。
- 扩展体验：动态广场、个人笔记、消息转译、群聊机器人露恩、井字棋小游戏邀请。

## 技术架构

| 层级 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | React、Vite、Axios、Zustand、Ant Design Icons | 负责单页应用、组件化界面、状态管理和 API 调用。 |
| 后端 | FastAPI、Pydantic、SQLAlchemy | 负责业务接口、鉴权、WebSocket、数据校验和 ORM。 |
| 数据库 | SQLite / MySQL | 默认使用 SQLite，本地和部署环境可按需切换。 |
| 部署 | Docker、Nginx | 前端、后端和数据库均提供容器化相关配置。 |
| 测试 | pytest、pytest-cov、ESLint | 覆盖后端业务逻辑、数据库迁移、通知机制和前端静态检查。 |

## 目录结构

```text
backend/                 FastAPI 后端服务
  app/                   应用入口、认证、聊天业务、模型和数据库连接
  tests/                 后端自动化测试
frontend/                React + Vite 前端应用
  src/                   页面、组件、服务封装、样式和工具函数
  public/                Aegis 静态图片与图标资源
database/                数据库容器配置
开发文档.md              需求、架构、接口、数据库和验收说明
```

## 本地运行

后端：

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Windows PowerShell 可使用：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm install
npm run dev
```

如需使用 MySQL，可通过环境变量配置数据库连接；如需使用 AI 转译或群聊机器人能力，请在本机或部署环境中配置对应服务参数。仓库中不包含真实密钥。

常用环境变量：

```text
DATABASE_URL=sqlite:///./whatthedogdoing.db
SECRET_KEY=replace-with-a-random-secret
VITE_BACKEND_TARGET=http://localhost:8000
SILICONFLOW_API_KEY=optional-ai-service-key
```

## 测试与质量保障

推荐在提交前运行：

```bash
pytest backend/tests --cov=backend/app --cov-report=term-missing -q
cd frontend && npm run lint && npm run build
```

后端测试覆盖认证、好友关系、群聊管理、群公告、消息通知、数据库初始化迁移和 AI 网关异常处理等场景；前端通过 lint 与生产构建检查基础质量。

## 项目总结

Aegis 以课程要求的即时通讯系统为核心，围绕真实聊天产品常见流程进行了较完整的工程实现。项目重点关注前后端接口协作、会话数据持久化、实时通知、群聊权限模型和用户交互体验，并在最终版本中将界面品牌统一为 Aegis 的轻骑士视觉风格。后续维护可继续围绕部署稳定性、移动端适配、搜索能力和消息安全策略进行扩展。

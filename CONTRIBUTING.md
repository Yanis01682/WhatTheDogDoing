# WhatTheDogDoing 团队 Git 协作手册

本手册用于统一团队开发流程，目标只有两个：

1. `main` 分支始终保持可运行、可部署。
2. 每个人都知道“什么时候切分支、什么时候同步 main、什么时候提 MR”。

## 1. 第一次加入项目

### 1.1 获取 Secoder Access Token

1. 登录 [Secoder GitLab](https://gitlab.spring26b.secoder.net/)。
2. 点击右上角头像，进入 `Settings` -> `Access Tokens`。
3. 创建 Token：
   `Name` 可以写 `git-access`
   `Scopes` 至少勾选 `api`、`read_repository`、`write_repository`
4. 复制生成的 Token。

### 1.2 克隆仓库

```powershell
git clone https://oauth2:<你的Token>@gitlab.spring26b.secoder.net/WhatTheDogDoing/WhatTheDogDoing.git
cd WhatTheDogDoing
```

## 2. 核心规则

- 不要直接在 `main` 上写代码。
- 开发新功能、修 bug、改文档，都要新建自己的分支。
- 每个分支只做一类事情，方便提 MR 和 Code Review。
- 一个分支合并完成后，不要长期复用，下一次工作从最新 `main` 重新开新分支。

推荐分支命名：

- 新功能：`feat/login-page`
- 修 bug：`fix/homework-bugs-20260409`
- 文档：`docs/contributing-workflow`

推荐 commit message：

- `feat: add login form validation`
- `fix: repair auth session and chat detail interactions`
- `docs: clarify branch and merge workflow`

## 3. 日常标准流程

### 3.1 开始新任务前

每次开始新任务，先回到 `main`，同步最新代码，再开新分支。

```powershell
git switch main
git pull origin main
git switch -c fix/your-branch-name
```

说明：

- `git switch main`：切回主分支
- `git pull origin main`：同步组里最新代码
- `git switch -c ...`：基于最新 `main` 新建你的工作分支

不要这样做：

```powershell
# 不推荐
git checkout main
# 然后直接在 main 上改代码
```

## 4. 开发过程中怎么提交

写代码时一直在你自己的分支上操作，不要切回 `main` 开发。

### 4.1 查看改动

```powershell
git status
```

### 4.2 提交改动

```powershell
git add .
git commit -m "fix: describe what you changed"
```

如果你只想提交部分文件，可以手动指定：

```powershell
git add frontend/src/App.jsx backend/app/auth.py
git commit -m "fix: repair login profile sync"
```

### 4.3 推送到远程分支

第一次推送：

```powershell
git push -u origin fix/your-branch-name
```

后续继续推送同一个分支：

```powershell
git push
```

## 5. 提交 Merge Request

当你完成一个阶段的开发后：

1. 把代码 push 到你自己的分支
2. 去 GitLab 页面发起 Merge Request
3. 目标分支选择 `main`
4. 等待组长或队友 review
5. MR 被批准后再合并

注意：

- MR 没合并前，继续在你当前分支改代码。
- 如果 review 提了修改意见，还是在这个分支继续改，然后再次 `git add`、`git commit`、`git push`。

## 6. MR 合并之后你该怎么做

这是最容易搞混的地方。

### 6.1 你的 MR 还没合并

继续在当前分支开发：

```powershell
git switch fix/your-branch-name
```

也就是说：

- 没合并前，在你自己的分支继续改
- 不要切到 `main` 继续写代码

### 6.2 你的 MR 已经合并到 main

先同步本地 `main`：

```powershell
git switch main
git pull origin main
```

如果你接下来还有新的任务，再从最新 `main` 新建一个新分支：

```powershell
git switch -c fix/next-bug-branch
```

也就是说：

- `main` 只负责同步最新主线代码
- 真正开发仍然在新的功能分支或修复分支上进行

## 7. main 更新了，但我自己的分支还没写完怎么办

如果你正在自己的分支开发，这时队友已经把新代码合并进 `main`，你需要把最新 `main` 同步进你的分支。

推荐做法：

```powershell
git switch main
git pull origin main
git switch fix/your-branch-name
git merge main
```

如果出现冲突：

1. 手动修改冲突文件
2. 确认文件内容正确
3. 执行：

```powershell
git add .
git commit
```

如果你只是想放弃这次 merge：

```powershell
git merge --abort
```

## 8. 常见错误操作

### 8.1 直接在 main 上改代码

不允许。发现后应尽快：

```powershell
git switch -c fix/save-my-work
```

先把改动转移到新分支，再继续处理。

### 8.2 `git pull` 提示有冲突或未完成操作

常见原因：

- 上一次 `merge` 没处理完
- 上一次 `revert` 没处理完
- 工作区里还有未解决冲突

先看状态：

```powershell
git status
```

根据提示处理：

```powershell
git merge --abort
git revert --abort
```

如果你确认本地改动都不要了，再考虑：

```powershell
git reset --hard
```

注意：`git reset --hard` 会直接丢弃本地未提交改动，使用前一定确认。

## 9. 本地运行和测试

### 9.1 后端

进入 `backend` 目录后安装依赖：

```powershell
pip install -r requirements.txt
```

启动后端：

```powershell
uvicorn app.main:app --reload
```

运行后端测试：

```powershell
pytest --cov=app --cov-report=term-missing
```

### 9.2 前端

进入 `frontend` 目录后安装依赖：

```powershell
npm install
```

启动前端：

```powershell
npm run dev
```

打包前端：

```powershell
npm run build
```

## 10. 依赖变更注意事项

- 后端新增依赖后，要更新并提交 `backend/requirements.txt`
- 前端新增依赖后，要提交 `frontend/package.json` 和 `frontend/package-lock.json`

## 11. Secoder 持久化部署说明

如果你们希望“重新部署后账号、好友、消息还在”，一定不要只依赖后端容器里的 SQLite 文件。

当前项目已经调整为：

- 本地开发：默认仍可使用 SQLite
- 部署环境：优先读取 `DATABASE_URL`
- 后端 Docker 默认会连接 `mysql-db`

这意味着：

- 后端重部署时，只要数据库容器和数据卷还在，账号数据就不会丢
- 不要让数据库服务在每次普通前后端改动时都跟着重建

团队协作时请注意：

1. 如果只是改前端或后端业务代码，不要去动 `database/` 目录
2. 只有在数据库镜像或数据库部署配置真的需要调整时，才改 `database/`
3. 如果部署后发现账号全没了，优先检查是不是数据库 dyno 被替换重建了
4. 如果后端连不上数据库，优先检查 `DATABASE_URL` 是否正确，以及 `mysql-db` 服务是否已启动

## 12. 一条最实用的记忆口诀

可以记成这 4 句话：

1. 开始写代码前：先回 `main` 拉最新
2. 写代码时：只在自己的分支写
3. 提交时：push 到自己的分支，提 MR
4. MR 合并后：回 `main` 拉最新，再开下一个新分支

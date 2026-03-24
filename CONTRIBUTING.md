# 🚀 WhatTheDogDoing 团队 Git 协作手册

本手册用于规范团队开发流程，确保代码能正确同步

## 1. 第一次加入项目 (Clone & Token 配置)

如果你是第一次把代码拉到本地，请按以下步骤操作：

### 第一步：获取 Secoder Access Token

1. 登录 [Secoder GitLab](https://gitlab.spring26b.secoder.net/)。
2. 点击右上角头像 -> **Settings** -> **Access Tokens**。
3. 创建 Token：名字选 `git-access`，有效期设长一点，**Scopes 务必勾选 `api`, `read_repository`, `write_repository`**。
4. **复制生成的 Token**（离开页面就看不到了！）。

### 第二步：克隆仓库

打开 PowerShell 或终端，执行：

```
# 将 <你的Token> 换成刚才复制的字符串
git clone https://oauth2:<你的Token>@gitlab.spring26b.secoder.net/WhatTheDogDoing/WhatTheDogDoing.git

# 进入目录
cd WhatTheDogDoing
```

## 2. 日常开发工作流

**核心原则：先拉取 (Pull)，再写代码，最后提交 (Push)。**

### 情况 A：开始写代码前 (同步队友进度)

```
# 1. 先同步一下主仓库最新代码
git pull origin main

# 2. 新建一个属于你自己的分支 (不要在 main 上写！)比如feat-login
git checkout -b feat-login
```

### 情况 B：写完一个功能后 (提交代码)

```
# 1. 查看改了哪些文件
git status

# 2. 把所有改动加到暂存区
git add .

# 3. 写下你干了什么 (遵循规范)
# 格式：feat: 新功能, fix: 修 Bug, docs: 文档修改
git commit -m "feat: 完成了用户注册后端接口"

# 4. 一键推送到 GitLab(注意是推送到自己新建的分支，如feat-login)
git push origin feat-login

# 5. push后，去 GitLab 网页端发起 Merge Request (MR) 给组长。
```

------

## 3. 注意事项 (避坑指南)

- **不要直接在 main 修改已经交付的功能**：根据《过程分细则》，主分支代码必须时刻保持“部署可用”。
- **后端依赖**：如果你用 `pip install` 安装了新包，必须执行： `cd backend; pip freeze > requirements.txt` 并提交。
- **前端依赖**：如果你用 `npm install` 安装了新包，记得提交 `package.json` 和 `package-lock.json`。
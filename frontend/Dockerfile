# Stage 0: build (编译前端代码)
FROM node:20 AS build
ENV FRONTEND=/opt/frontend
WORKDIR $FRONTEND

# 拷贝 package.json 并安装依赖 (利用缓存)
COPY package.json package-lock.json ./
# 使用课程专属 NPM 缓存源
RUN npm config set registry https://npm-cache-sepi.app.spring26a.secoder.net/
RUN npm install

# 拷贝前端全部源码并打包
COPY . .
RUN npm run build

# Stage 1: run (运行 Nginx 提供服务)
FROM nginx:1.22
ENV HOME=/opt/app
WORKDIR $HOME

# 把上一阶段编译出的 dist 文件夹里的产物拷贝过来
COPY --from=build /opt/frontend/dist dist
# 把我们刚才写的 Nginx 配置文件拷贝到 Nginx 的配置目录
COPY nginx /etc/nginx/conf.d

# 暴露给外网的端口
EXPOSE 80
FROM python:3.12

ENV HOME=/opt/app
WORKDIR $HOME

# 先只拷贝依赖清单，利用 Docker 缓存机制加速构建
COPY requirements.txt .

# 使用课程文档提供的专属缓存源，防止下载超时被墙
RUN pip install -i https://pypi-cache-sepi.app.spring26a.secoder.net/simple -r requirements.txt

# 将后端源代码拷贝进镜像
COPY . $HOME

# 完美契合 SECoder 的默认设定，改用 80 端口
EXPOSE 80

# 启动命令也改为 80 端口
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
FROM python:3.12

ENV HOME=/opt/app
WORKDIR $HOME

# 先只拷贝依赖清单，利用 Docker 缓存机制加速构建
COPY requirements.txt .

# 使用课程文档提供的 spring26a 专属缓存源，防止下载超时被墙
RUN pip install -i https://pypi-cache-sepi.app.spring26a.secoder.net/simple -r requirements.txt

# 将后端源代码拷贝进镜像
COPY . $HOME

# 暴露后端运行端口（FastAPI 默认一般是 8000）
EXPOSE 8000

# 启动后端的命令 (注意这里不能用带 reload 的开发模式)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
FROM mysql:8.0

# 既然 UI 不让填，咱们直接写在 Dockerfile 里！
# 这里的 123456 就是你给数据库设置的 root 密码，你可以随便改
ENV MYSQL_ROOT_PASSWORD=123456

# 顺手把数据库也自动建好，省得连进去敲 SQL 了
ENV MYSQL_DATABASE=whatthedogdoing

# 声明数据目录，便于平台或运行时挂载持久卷
VOLUME /var/lib/mysql

# SECoder runtime may not allow MySQL native AIO initialization.
# Force InnoDB to use the compatible non-native AIO path so mysqld can boot.
COPY conf.d/secoder.cnf /etc/mysql/conf.d/secoder.cnf

# 暴露 MySQL 默认端口
EXPOSE 3306

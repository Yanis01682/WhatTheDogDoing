# 换用 5.7 版本，在资源受限平台更稳定不易 Crash
FROM mysql:5.7

# 这里的 123456 是 root 密码
ENV MYSQL_ROOT_PASSWORD=123456
ENV MYSQL_DATABASE=whatthedogdoing

# 解决中文字符集和连接权限的问题
CMD ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci", "--default-authentication-plugin=mysql_native_password"]

EXPOSE 3306
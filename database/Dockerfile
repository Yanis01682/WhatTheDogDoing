# 换用更加轻量级、且与 MySQL 完美兼容的 mariadb
# 彻底解决 Secoder 平台上因内存不足导致的数据库崩溃问题
FROM mariadb:10.6

ENV MYSQL_ROOT_PASSWORD=123456
ENV MYSQL_DATABASE=whatthedogdoing

# 设置字符集以支持中文和 Emoji，防止乱码
CMD ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]

EXPOSE 3306
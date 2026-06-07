FROM mysql:8.0

ENV MYSQL_ROOT_PASSWORD=change-me

ENV MYSQL_DATABASE=whatthedogdoing

VOLUME /var/lib/mysql

EXPOSE 3306

CMD ["mysqld", "--innodb-use-native-aio=0"]

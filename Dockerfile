# Dockerfile to create a Nodejs server for storage
FROM 192.168.1.113/tenxcloud/dev-flow-api-base
MAINTAINER huangxin@tenxcloud.com

ENV DB_HOST localhost
ENV DB_PORT 3306
ENV DB_NAME tenxcloud
ENV DB_USER tenxcloud
ENV DB_PASSWORD tenxcloud
ENV RUNNING_MODE enterprise

ADD . /opt/nodejs/

ENV NODE_ENV production
RUN sh build.sh --clean=all
# set DNS
RUN echo 'nameserver 114.114.114.114' >> /etc/resolv.conf

# Expose the container port
EXPOSE 8090

CMD ["node", "app.js"]

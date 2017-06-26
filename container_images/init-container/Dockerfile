FROM alpine:3.4
MAINTAINER huangxin@tenxcloud.com

## code volume path
VOLUME /app

## install necessary pacakges
RUN apk update \
  && apk add --no-cache git openssh-client subversion nodejs \
  && npm install urllib fs 

RUN mkdir -p /root/.ssh
ADD known_hosts /root/.ssh/

ADD build.sh /
ADD upload.js /

CMD ["/build.sh"]

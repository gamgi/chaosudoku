# syntax=docker/dockerfile:1.2
FROM node:18-alpine
RUN apk --no-cache add curl
RUN mkdir -p /app/node_modules && chown -R node:node /app

ENV SCALESOCKET_VERSION=v0.1.3
RUN curl -SL "https://github.com/scalesocket/scalesocket/releases/download/${SCALESOCKET_VERSION}/scalesocket_${SCALESOCKET_VERSION}_x86_64-unknown-linux-musl.tar.gz" | tar -xzC /usr/local/bin

WORKDIR /app
USER node

COPY --chown=node:node package*.json ./
RUN npm install

COPY public/ /var/www/public/
COPY --chown=node:node sudoku.js .

CMD scalesocket --addr 0.0.0.0:5000 --staticdir /var/www/public/\
    --joinmsg '{"t":"Join","id":#ID}'\
    node -- ./index.js
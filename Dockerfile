FROM node:14-bullseye-slim as builder

RUN  set -x \
  && apt-get update && apt-get install -y \
       curl \
       python \
       make \
       g++ \
       libzmq3-dev

ADD . /var/app

WORKDIR /var/app

RUN  npm ci && npm run build && npm prune --production

# run image
FROM node:14-bullseye-slim

COPY --from=builder /var/app /var/app
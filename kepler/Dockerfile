FROM node:14-slim as builder

RUN  set -x \
  && apt update \
  && apt install -y \
      curl \
      python \
      make \
      g++ \
      libzmq3-dev

ADD . /var/app

WORKDIR /var/app

RUN  npm ci \
  && npm run build \ 
  && npm prune --production \
  && npm dedupe

# run image
FROM node:14-slim

COPY --from=builder /var/app /var/app
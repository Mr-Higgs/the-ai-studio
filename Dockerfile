FROM node:24-bookworm-slim

# util-linux+bsdutils: `script` (the pty wrapper the Devin sign-in relay needs)
# passwd: useradd for STUDIO_ISOLATE=1  ·  procps: ps for ops debugging
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates git util-linux bsdutils procps passwd \
 && rm -rf /var/lib/apt/lists/*

# install.sh ends with `devin setup`, an interactive login that fails docker build
# ("Error: Login canceled") — strip it. The binary lands in ~/.local/share/devin;
# move the versioned tree to /usr/local so every user (incl. studio-<uid>) can run it.
RUN curl -fsSL https://cli.devin.ai/install.sh \
      | sed -E 's/^"\$VERSION_DIR\/bin\/\$COMPILED_BIN_NAME" setup$//' \
      | bash \
 && cp -a /root/.local/share/devin /usr/local/share/devin \
 && ln -sf "$(readlink -f /root/.local/bin/devin | sed 's|^/root/.local/share|/usr/local/share|')" /usr/local/bin/devin \
 && devin --version

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV STUDIO_HOSTED=1 DATA_DIR=/data NODE_ENV=production
EXPOSE 4321
VOLUME ["/data"]
HEALTHCHECK CMD curl -fsS http://127.0.0.1:${PORT:-4321}/api/health || exit 1
CMD ["node", "ui/server.mjs"]

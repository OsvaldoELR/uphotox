# Editor engine for Cloudflare Containers (linux/amd64): Node + sharp +
# ONNX Runtime (CPU) + the MODNet person matting model.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
# ONNX Runtime would download its CUDA (GPU) libraries on linux/x64: unused.
ENV ONNXRUNTIME_NODE_INSTALL=skip

# MODNet portrait matting (Apache-2.0), pinned by its SHA-256.
ADD https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx models/modnet.onnx
RUN echo "07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9  models/modnet.onnx" | sha256sum -c - \
  && chmod 644 models/modnet.onnx

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && find node_modules/onnxruntime-node/bin -mindepth 1 -maxdepth 2 -type d \( -name darwin -o -name win32 \) -exec rm -rf {} + \
  && npm cache clean --force

COPY lib ./lib
COPY server.mjs ./

EXPOSE 8080
USER node
CMD ["node", "server.mjs"]

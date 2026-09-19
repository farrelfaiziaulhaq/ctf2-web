FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js db.js views.js ./
EXPOSE 8080
CMD ["node", "server.js"]

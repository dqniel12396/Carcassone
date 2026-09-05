FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY server/ ./server/
COPY client/ ./client/
RUN mkdir -p data/saves data/replays

# Persistent data directory
VOLUME ["/app/data"]

EXPOSE 3080

ENV NODE_ENV=production
ENV PORT=3080

CMD ["node", "server/index.js"]

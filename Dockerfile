FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
WORKDIR /app
COPY index.html login.html signup.html ./public/
COPY assets ./public/assets
COPY backend ./backend
WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]

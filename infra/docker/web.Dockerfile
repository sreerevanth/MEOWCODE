FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages
RUN npm install

FROM deps AS runner
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

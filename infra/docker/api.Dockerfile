FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
RUN npm install

FROM deps AS runner
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev:api"]

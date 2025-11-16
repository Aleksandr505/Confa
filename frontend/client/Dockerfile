FROM node:18-alpine AS build
WORKDIR /app

ARG VITE_API_BASE
ARG VITE_LIVEKIT_WS_URL
ARG VITE_REFRESH_HEADER

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_LIVEKIT_WS_URL=$VITE_LIVEKIT_WS_URL
ENV VITE_REFRESH_HEADER=$VITE_REFRESH_HEADER

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx","-g","daemon off;"]

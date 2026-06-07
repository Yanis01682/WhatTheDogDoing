FROM node:20 AS build
ENV FRONTEND=/opt/frontend
WORKDIR $FRONTEND

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.22
ENV HOME=/opt/app
WORKDIR $HOME

COPY --from=build /opt/frontend/dist dist
COPY nginx /etc/nginx/conf.d

EXPOSE 80

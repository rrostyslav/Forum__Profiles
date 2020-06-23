FROM node:12
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn --prod && npm i -g pm2
COPY . .
EXPOSE 8080
CMD pm2 startOrRestart ecosystem.json --no-daemon
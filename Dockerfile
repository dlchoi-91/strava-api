FROM node:16-alpine AS build

RUN mkdir /home/node/run-dashboard-api/ && chown -R node:node /home/node/run-dashboard-api
WORKDIR /home/node/run-dashboard-api

COPY package*.json ./

RUN npm install
USER node


COPY --chown=node:node . .
EXPOSE 8080

CMD [ "node", "app.js" ]
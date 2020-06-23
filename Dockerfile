FROM node:lts

COPY [ "app", "/app" ]
COPY [ "start.sh", "/start.sh" ]

RUN cd /app && \
    npm install && \
    npm run build && \
    cp dist/bundle.js /bundle.js && \
    cd / && \
    rm -rf /app && \
    chmod +x /start.sh

CMD "/start.sh"

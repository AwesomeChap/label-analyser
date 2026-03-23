FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
# opencv-python-headless still needs XCB + OpenGL runtime libs on slim Debian.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip \
    libxcb1 libxcb-shm0 libxcb-xfixes0 \
    libglib2.0-0 libgomp1 libsm6 libxext6 libxrender1 \
    libgl1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY web-app/package*.json ./web-app/
COPY web-app/server/package*.json ./web-app/server/
COPY web-app/client/package*.json ./web-app/client/
RUN cd web-app && npm install \
  && cd server && npm install \
  && cd ../client && npm install

# Install Python dependencies
COPY yolo-obb-service/requirements.txt ./yolo-obb-service/
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r yolo-obb-service/requirements.txt \
  && /opt/venv/bin/python -c "import cv2; print('cv2 import ok', cv2.__version__)"

# Copy source
COPY . .

# Build frontend once for static serving by Express
RUN cd web-app/client && npm run build

EXPOSE 10000
COPY docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh
CMD ["/app/docker-start.sh"]

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY schemas.py features.py forecaster.py main.py ./

# Copy model artifacts into image
COPY models/ /models/

ENV PYTHONUNBUFFERED=1
ENV PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

CMD ["python", "main.py"]

FROM python:3.11-slim

RUN pip install --no-cache-dir --timeout 300 --retries 5 \
    mlflow==2.10.0 \
    psycopg2-binary \
    boto3

EXPOSE 5000

CMD ["mlflow", "server", \
     "--host", "0.0.0.0", \
     "--port", "5000", \
     "--default-artifact-root", "s3://mlflow-artifacts/"]

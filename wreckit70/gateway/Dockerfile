FROM python:3.11-slim
WORKDIR /app
COPY gateway.py waf.py ./
EXPOSE 8443
ENV PYTHONUNBUFFERED=1
CMD ["python", "gateway.py"]

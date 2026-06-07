FROM python:3.12

ENV HOME=/opt/app
WORKDIR $HOME

# Copy dependencies first to make Docker layer caching effective.
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . $HOME

EXPOSE 80

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]

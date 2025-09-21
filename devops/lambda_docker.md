📁 Cấu trúc dự án
```text
project/
├─ src/
│  ├─ app/
│  │  ├─ __init__.py
│  │  └─ handler.py
│  └─ requirements.txt
└─ Dockerfile
```
⸻

📄 src/requirements.txt
```text
psycopg[binary]==3.2.1
boto3==1.34.162           # đã có sẵn trên Lambda runtime, nhưng pin version để local test
```

psycopg[binary] mang sẵn libpq → tiện cho Lambda container. (Nếu bạn muốn SQLAlchemy: sqlalchemy[postgresql_psycopg]==2.0.*)

⸻

🐍 src/app/handler.py
```python
import os
import json
import logging
import time
from psycopg_pool import ConnectionPool  # có trong psycopg v3

log = logging.getLogger()
log.setLevel(logging.INFO)

# ====== ENV VARS ======
DB_HOST = os.environ.get("DB_HOST")              # ví dụ: mydb.abc123.ap-southeast-1.rds.amazonaws.com
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "appdb")
DB_USER = os.environ.get("DB_USER", "appuser")
DB_PASSWORD = os.environ.get("DB_PASSWORD")      # khuyên dùng Secrets Manager/RDS Proxy
SSL_MODE = os.environ.get("DB_SSLMODE", "require")  # require/reject/verify-full...

# Kết nối an toàn: dùng RDS Proxy (+ IAM auth nếu muốn), hoặc Secrets Manager để lấy password.

# ====== GLOBAL POOL (tái sử dụng giữa invocations) ======
conninfo = (
    f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} "
    f"user={DB_USER} password={DB_PASSWORD} sslmode={SSL_MODE}"
)

pool = ConnectionPool(
    conninfo=conninfo,
    min_size=1,     # pool nhỏ cho Lambda
    max_size=5,
    timeout=10,     # giây chờ lấy connection
    open=True       # mở pool ngay tại init
)

def ensure_schema():
    """Tạo bảng mẫu nếu chưa có (id serial, ts timestamp)."""
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS demo_events (
                    id BIGSERIAL PRIMARY KEY,
                    message TEXT NOT NULL,
                    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)
            conn.commit()

# Gọi 1 lần khi container warm
try:
    ensure_schema()
except Exception as e:
    log.exception("Ensure schema failed: %s", e)

def lambda_handler(event, context):
    start = time.time()
    msg = (event or {}).get("message", "hello from lambda + postgres")

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # insert một record
                cur.execute(
                    "INSERT INTO demo_events(message) VALUES (%s) RETURNING id;",
                    (msg,)
                )
                new_id = cur.fetchone()[0]
                # đếm tổng record
                cur.execute("SELECT COUNT(*) FROM demo_events;")
                total = cur.fetchone()[0]
                conn.commit()

        elapsed = round((time.time() - start) * 1000, 2)
        body = {
            "inserted_id": new_id,
            "total_records": total,
            "elapsed_ms": elapsed
        }
        return {"statusCode": 200, "body": json.dumps(body)}

    except Exception as e:
        log.exception("DB error")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
```

Gợi ý bảo mật: thay DB_USER/DB_PASSWORD bằng IAM Auth + RDS Proxy hoặc AWS Secrets Manager (lấy secret ở init, cache lại).

⸻

🐳 Dockerfile (x86_64; đổi sang -arm64 nếu chọn arm)
```text
# Build + runtime dựa trên Lambda base image
FROM public.ecr.aws/lambda/python:3.11

# Cài deps vào /opt/python (được tự động thêm vào sys.path)
WORKDIR /var/task
COPY src/requirements.txt .
RUN python -m pip install --upgrade pip && \
pip install --no-cache-dir -r requirements.txt --target /opt/python

# Copy source
COPY src/app ./app

# Chỉ định handler
CMD ["app.handler.lambda_handler"]
```

Build & Push (trên Mac M-series nhớ ép kiến trúc phù hợp)

```shell
docker buildx build --platform linux/amd64 -t my-pg-lambda:latest .

aws ecr create-repository --repository-name my-pg-lambda || true
aws ecr get-login-password --region ap-southeast-1 \
| docker login --username AWS --password-stdin <acct>.dkr.ecr.ap-southeast-1.amazonaws.com

docker tag my-pg-lambda:latest <acct>.dkr.ecr.ap-southeast-1.amazonaws.com/my-pg-lambda:latest
docker push <acct>.dkr.ecr.ap-southeast-1.amazonaws.com/my-pg-lambda:latest

Tạo/Update Lambda

aws lambda create-function \
--function-name pg-demo-lambda \
--package-type Image \
--code ImageUri=<acct>.dkr.ecr.ap-southeast-1.amazonaws.com/my-pg-lambda:latest \
--role arn:aws:iam::<acct>:role/LambdaExecutionRole \
--timeout 30 --memory-size 1024 \
--architectures x86_64 \
--environment "Variables={DB_HOST=<rds-or-proxy-endpoint>,DB_PORT=5432,DB_NAME=appdb,DB_USER=appuser,DB_PASSWORD=<secret>,DB_SSLMODE=require}"

```
# Nếu target Lambda x86_64

(Nếu function đã tồn tại: aws lambda update-function-code --image-uri ...)

⸻

🔐 Dùng AWS Secrets Manager (tùy chọn)

Thay vì set DB_USER/DB_PASSWORD trực tiếp:
•	Tạo secret JSON:
{"username":"appuser","password":"...","host":"...","port":5432,"dbname":"appdb"}
•	Cấp quyền secretsmanager:GetSecretValue cho IAM role của Lambda.
•	Trong handler.py (phần init), lấy secret và build conninfo. (Có thể mình viết sẵn đoạn code khi bạn cần.)

⸻

⚙️ Best practices nhanh
•	RDS Proxy để pool connection chuẩn serverless, giảm số connection vào Postgres.
•	arm64 (Graviton) nếu thư viện tương thích → tiết kiệm chi phí & cold start tốt hơn.
•	Tăng Ephemeral storage nếu cần ghi file tạm lớn: --ephemeral-storage SizeInMB=4096.
•	Tách logic DB ra module riêng, viết unit test với testcontainer/pytest.
•	Bật VPC cho Lambda nếu RDS ở private subnet; thêm VPC endpoints (Secrets Manager/CloudWatch) để giảm NAT.

# DeepSeekX MLflow 可观测性集成

## 目标

DeepSeekX 可以把 OpenTelemetry trace 导出到本地 MLflow 服务，用于
分析一次任务中的调用链、用户输入、耗时、错误和部分提示词事件。
该方案用于诊断 DeepSeekX 运行行为，不替代本地 rollout trace。

需要审计最终发给 DeepSeek 的完整 Chat Completions `messages[]`、
`tools`、`response_format` 和推理参数时，应优先使用
`CODEX_ROLLOUT_TRACE_ROOT`。MLflow 更适合作为长期可观测性服务
（observability service），用于聚合、检索和对比多次运行。

## 边界

- MLflow 3.6 及以上版本支持接收 OpenTelemetry OTLP/HTTP trace。
- MLflow 接收端点为 `/v1/traces`。
- MLflow 需要 `x-mlflow-experiment-id` header 来确定 trace 写入的
  experiment。
- MLflow 当前不应假设可直接接收 OTLP/gRPC。DeepSeekX 配置应使用
  `otlp-http`。
- `otel.log_user_prompt = true` 会记录用户输入，调试完成后应关闭或只在
  本地隔离环境使用。

## 推荐目录

以下示例使用占位符，项目文档不得假设本机已经存在某个固定目录。

```text
<MLFLOW_HOME>/
  docker-compose.yml
  Dockerfile
  .env.example
  .gitignore
  artifacts/
  db/
  deepseekx/
    config-otel-mlflow.toml
  scripts/
    create_experiment.py
    send_test_trace.py
  docs/
    deepseekx-mlflow-otel.md
```

`<MLFLOW_HOME>` 是 MLflow 服务配置、数据和辅助脚本的根目录。该路径由
部署者选择，项目文档和脚本模板不应硬编码具体本机路径。

## Docker Compose

以下 compose 面向本地单机诊断。安全加固包括只绑定
`127.0.0.1`、非 root 用户、只读 root filesystem、drop capabilities、
禁止提权、限制日志大小、健康检查、显式数据卷和临时目录。

```yaml
services:
  mlflow:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: local-mlflow
    command:
      - mlflow
      - server
      - --host
      - 0.0.0.0
      - --port
      - "5000"
      - --backend-store-uri
      - sqlite:////mlflow/db/mlflow.db
      - --default-artifact-root
      - /mlflow/artifacts
      - --allowed-hosts
      - 127.0.0.1,localhost
      - --cors-allowed-origins
      - http://127.0.0.1:5000,http://localhost:5000
    ports:
      - "127.0.0.1:5000:5000"
    volumes:
      - ./db:/mlflow/db
      - ./artifacts:/mlflow/artifacts
    tmpfs:
      - /tmp:size=256m,mode=1777
    read_only: true
    user: "1000:1000"
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    environment:
      MLFLOW_ENABLE_ASYNC_TRACE_LOGGING: "false"
      PYTHONUNBUFFERED: "1"
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health')"
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

`read_only: true` 要求所有运行期写入都落在挂载目录或 `tmpfs`。如果宿主机
用户 ID 不是 `1000:1000`，应把 `user` 改成当前用户 ID：

```bash
id -u
id -g
```

## Dockerfile

```dockerfile
FROM python:3.11-slim

ARG MLFLOW_VERSION=3.12.0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN python -m pip install --upgrade pip \
    && python -m pip install "mlflow[genai]==${MLFLOW_VERSION}"

WORKDIR /mlflow
```

## `.gitignore`

```gitignore
artifacts/
db/
.venv/
*.log
*.tmp
.DS_Store
```

## 创建实验

在 `<MLFLOW_HOME>/scripts/create_experiment.py` 放置：

```python
import os

import mlflow


tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000")
experiment_name = os.environ.get("MLFLOW_EXPERIMENT_NAME", "deepseekx-local")

mlflow.set_tracking_uri(tracking_uri)
experiment = mlflow.get_experiment_by_name(experiment_name)
if experiment is None:
    experiment_id = mlflow.create_experiment(experiment_name)
else:
    experiment_id = experiment.experiment_id

print(experiment_id)
```

启动服务并创建实验：

```bash
cd <MLFLOW_HOME>
docker compose up -d --build
curl -fsS http://127.0.0.1:5000/health

python3 -m venv .venv
. .venv/bin/activate
python -m pip install 'mlflow[genai]==3.12.0' opentelemetry-exporter-otlp
python scripts/create_experiment.py
```

记录输出的 experiment ID。后续示例用 `<MLFLOW_EXPERIMENT_ID>` 表示。

## DeepSeekX OTEL 配置

可以把以下片段写入
`<MLFLOW_HOME>/deepseekx/config-otel-mlflow.toml`，再合并到
`~/.deepseekx/config.toml`：

```toml
[otel]
environment = "dev"
log_user_prompt = true

[otel.trace_exporter.otlp-http]
endpoint = "http://127.0.0.1:5000/v1/traces"
protocol = "binary"

[otel.trace_exporter.otlp-http.headers]
x-mlflow-experiment-id = "<MLFLOW_EXPERIMENT_ID>"

[otel.span_attributes]
"service.name" = "deepseekx"
"service.namespace" = "local"
"deployment.environment.name" = "dev"
```

临时命令行配置：

```bash
OTEL_TRACE_EXPORTER='otel.trace_exporter={otlp-http={'\
'endpoint="http://127.0.0.1:5000/v1/traces",'\
'protocol="binary",'\
'headers={x-mlflow-experiment-id="<MLFLOW_EXPERIMENT_ID>"}}}'

deepseekx exec \
  -c 'otel.environment="dev"' \
  -c 'otel.log_user_prompt=true' \
  -c "$OTEL_TRACE_EXPORTER" \
  '简单回答：hello'
```

更推荐把 OTEL 配置写入 `~/.deepseekx/config.toml`，避免 shell 引号和
长行造成误配置。

## Smoke Trace

可以先用 Python 向 MLflow 发送一条最小 OTLP trace，验证 MLflow 端点和
experiment ID 正确：

```python
import os
import time

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


endpoint = os.environ.get(
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    "http://127.0.0.1:5000/v1/traces",
)
experiment_id = os.environ["MLFLOW_EXPERIMENT_ID"]

resource = Resource.create(
    {
        "service.name": "deepseekx-smoke",
        "service.namespace": "local",
        "deployment.environment.name": "dev",
    }
)
provider = TracerProvider(resource=resource)
exporter = OTLPSpanExporter(
    endpoint=endpoint,
    headers={"x-mlflow-experiment-id": experiment_id},
)
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("deepseekx-smoke")
with tracer.start_as_current_span("deepseekx.mlflow.smoke") as span:
    span.set_attribute("gen_ai.system", "deepseek")
    span.set_attribute("gen_ai.request.model", "deepseek-v4-pro")
    span.add_event("prompt.preview", {"prompt": "local smoke trace"})

provider.force_flush(timeout_millis=10_000)
provider.shutdown()
time.sleep(0.2)
print("sent")
```

运行：

```bash
cd <MLFLOW_HOME>
. .venv/bin/activate
MLFLOW_EXPERIMENT_ID=<MLFLOW_EXPERIMENT_ID> python scripts/send_test_trace.py
```

## 查询验证

```python
import mlflow

mlflow.set_tracking_uri("http://127.0.0.1:5000")
traces = mlflow.search_traces(
    experiment_ids=["<MLFLOW_EXPERIMENT_ID>"],
    max_results=10,
)

for _, row in traces.iterrows():
    names = [span.get("name") for span in row["spans"]]
    print(row["trace_id"], row["state"], names[:5])
```

## 分析 DeepSeekX 提示词

MLflow 可用于查看：

- `codex.exec`、`turn/start`、`session_task.turn` 等运行 span。
- 用户输入事件，前提是 `otel.log_user_prompt = true`。
- 工具链路、错误、耗时和 span 属性。
- 多次运行之间的对比与筛选。

MLflow 不保证直接展示最终 DeepSeek HTTP 请求体。要审计最终
Chat Completions `messages[]`，应启用本地 rollout trace：

```bash
trace_root="$(mktemp -d /tmp/deepseekx-trace.XXXXXX)"

CODEX_ROLLOUT_TRACE_ROOT="$trace_root" \
deepseekx exec \
  -c model_provider=deepseek \
  -m deepseek-v4-pro \
  '简单回答：hello'

bundle="$(find "$trace_root" -maxdepth 1 -type d -name 'trace-*' | head -1)"
deepseekx debug trace-reduce "$bundle"

req="$(jq -r '.raw_payloads | to_entries[]
  | select(.value.kind.type=="inference_request")
  | .value.path' "$bundle/state.json" | head -1)"

jq '{model, messages, tools, response_format, thinking, reasoning_effort}' \
  "$bundle/$req"
```

推荐诊断流程：

1. 用 MLflow 判断哪次运行异常、哪个 span 慢、是否有用户输入或工具错误。
2. 用对应时间窗口和 session 信息定位 DeepSeekX 本地 rollout trace。
3. 在 rollout trace 中读取最终 provider request，审计完整 `messages[]`。
4. 只在本地短期开启 `otel.log_user_prompt = true` 和 rollout trace。

## 安全注意事项

- MLflow UI 和 OTLP 入口默认只绑定 `127.0.0.1`。
- 不要把 MLflow 服务暴露到公网。
- `artifacts/`、`db/`、rollout trace 和 OTEL payload 可能包含 prompt、
  文件路径、工具输入输出和敏感业务上下文。
- 不要提交 `.env`、数据库、artifact、trace bundle 或本地 venv。
- 如果必须跨机器访问，应增加反向代理认证、TLS、访问控制和网络隔离。
- DeepSeekX 的完整系统提示词和工具 schema 更适合保存在本地 trace，
  不应默认上传到第三方可观测性服务。

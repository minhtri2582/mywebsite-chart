# ELK Stack & Observability – Kiến thức toàn diện dành cho DevOps/SRE

ELK Stack không chỉ là hệ thống thu thập và tìm kiếm log. Khi kết hợp với Elastic Observability, nó có thể trở thành nền tảng giám sát **Infrastructure, Kubernetes, Applications, Microservices, Database và Network**.

Bốn cấp độ cần nắm:

1. **Logging:** Thu thập, lưu trữ, tìm kiếm và phân tích log.
2. **Monitoring:** Theo dõi tình trạng hệ thống, tài nguyên và ứng dụng.
3. **Observability:** Kết hợp Logs, Metrics, Traces để xác định nguyên nhân sự cố.
4. **SRE & AIOps:** SLI/SLO, alerting, incident response, anomaly detection và reliability.

## 1. Kiến trúc ELK Stack

```text
Applications          Kubernetes          Infrastructure
      \                   |                   /
       +------------------+------------------+
                          |
          Elastic Agent / Beats / OTel Collector
                   Logs · Metrics · Traces
                          |
             Logstash / Ingest Pipelines
             Parse · Enrich · Transform
                          |
                    Elasticsearch
              Index · Store · Search
                          |
               Kibana / Observability
           Explore · Dashboard · Correlate
                          |
              Alerting · Incident · SLO
```

> Logstash là tùy chọn. Dữ liệu có thể đi trực tiếp tới Elasticsearch qua ingest pipelines.

| Thành phần | Vai trò |
|---|---|
| Elasticsearch | Distributed search, storage, indexing, aggregation |
| Logstash | Processing, parsing, enrichment, routing |
| Kibana | Visualization, Discover, dashboards, alerting |
| Elastic Agent | Unified logs, metrics và telemetry collection |
| Filebeat | Thu thập và forward file/container logs |
| Metricbeat | Thu thập OS/service metrics |
| Heartbeat | Uptime checks (legacy approach) |
| APM | Application Performance Monitoring |
| OpenTelemetry | Instrumentation và telemetry standard |
| Fleet | Centralized Elastic Agent management |

**Lưu ý:** ELK nguyên bản là Elasticsearch, Logstash, Kibana; Elastic Stack hiện đại rộng hơn.

## 2. Ba trụ cột Observability

| Pillar | Câu hỏi | Ví dụ |
|---|---|---|
| **Logs** | What happened? | Errors, events, audit |
| **Metrics** | How much? | CPU, RPS, latency |
| **Traces** | Where and why? | Request flow, spans |

Ví dụ API Kubernetes chậm:

- **Metrics:** p95 latency tăng từ 200 ms lên 2 giây.
- **Traces:** 1,7 giây nằm ở PostgreSQL.
- **Logs:** `connection pool exhausted`.

Ngoài ba trụ cột còn có profiling, dependency mapping, real user monitoring và change correlation.

## 3. Chức năng Elastic Observability

| Nhóm | Chức năng | Ứng dụng |
|---|---|---|
| Log Management | Search, filter, live tail, structured logs | Debug |
| Infrastructure Monitoring | CPU, RAM, disk, network, host | EC2, VM, Linux |
| Kubernetes Monitoring | Pods, nodes, deployments, containers | EKS, GKE, AKS |
| APM | Latency, throughput, errors, transactions | Java, PHP, Node.js |
| Distributed Tracing | Trace/span correlation | Microservices |
| Service Map | Service dependencies | Root cause analysis |
| Uptime/Synthetics | HTTP checks, browser journeys | API, website |
| RUM | Browser performance, page load | Frontend |
| Universal Profiling | CPU profiling, hotspots | Performance tuning |
| Alerting | Threshold and rule-based detection | Operations |
| SLO Management | Availability, latency, error budget | SRE |
| ML/Anomaly Detection | Abnormal behavior | AIOps |
| Incident Investigation | Timeline, correlation, triage | Incident response |
| Dashboard | KPI, Lens, visualization | NOC/SRE |
| Data Management | ILM, data streams, retention | Storage control |

Một số tính năng tùy phiên bản, license và mô hình Elastic Cloud/self-managed.

## 4. Observability cho Kubernetes / EKS

| Layer | Metrics quan trọng |
|---|---|
| Cluster | Node Ready, capacity, resource usage |
| Node | CPU, memory, disk, network |
| Pod | Restart count, status, OOMKilled |
| Container | CPU throttling, memory working set |
| Deployment | Desired vs available replicas |
| Ingress | Request rate, 4xx/5xx, latency |
| Application | RPS, error rate, p95/p99 |
| Database | Connections, query duration, locks |
| JVM | Heap, GC pauses, thread count |
| Network | TCP errors, retransmissions, packet drops |

**Ví dụ dashboard (dữ liệu minh họa, không phải cluster thực):**

| KPI | Value |
|---|---:|
| Request rate | 1.25k req/s |
| Error rate (5xx) | 1.8% |
| p95 latency | 420 ms |
| Pods ready | 47/48 |

HTTP request rate theo status code:

| Time | 2xx | 4xx | 5xx |
|---|---:|---:|---:|
| 10:00 | 1020 | 45 | 9 |
| 10:05 | 1100 | 51 | 11 |
| 10:10 | 980 | 48 | 12 |
| 10:15 | 1190 | 55 | 18 |
| 10:20 | 1150 | 62 | 43 |
| 10:25 | 1230 | 58 | 21 |

p95 service latency:

| Service | p95 (ms) |
|---|---:|
| Auth | 180 |
| Payment | 420 |
| Order | 260 |
| Customer | 310 |

Metrics HTTP cần instrumentation tại ingress/application; agent trên node không tự động cung cấp mọi chỉ số.

## 5. Logging – Kiến thức cần nắm

Vòng đời: **Generate → Collect → Parse → Enrich → Index → Search → Retain/Delete**.

Ví dụ structured log:

```json
{
  "@timestamp": "2026-10-13T14:00:00Z",
  "log.level": "ERROR",
  "service.name": "payment-api",
  "service.environment": "production",
  "kubernetes.pod.name": "payment-api-7d9f",
  "trace.id": "abc123",
  "transaction.id": "xyz456",
  "http.response.status_code": 500,
  "message": "Database connection timeout"
}
```

Đây là ví dụ minh họa; nên chuẩn hóa field theo **Elastic Common Schema (ECS)**.

Các query language:

- **KQL:** Filter/search trong Kibana.
- **Lucene query syntax:** Text queries và điều kiện.
- **Query DSL:** Elasticsearch JSON queries.
- **ES|QL:** Pipeline-based querying, filtering, aggregation.

```esql
FROM logs-*
| WHERE http.response.status_code >= 500
| STATS errors = COUNT(*) BY service.name
| SORT errors DESC
```

Cần hiểu thêm: inverted index, mapping, analyzer, shard, replica, data stream, index template, rollover, ILM, snapshot và cluster health.

## 6. Distributed Tracing và APM

Ví dụ một request (dữ liệu minh họa):

```text
API Gateway       800 ms
  ├─ Auth          90 ms
  └─ Payment      650 ms
       └─ PostgreSQL query 590 ms
```

Span có thể lồng nhau, vì vậy không cộng tất cả durations.

- **Trace:** Hành trình của request.
- **Span:** Một thao tác trong trace.
- **Trace ID:** Định danh xuyên suốt request.
- **Span ID:** Định danh từng thao tác.
- **Context propagation:** Truyền context giữa services.
- **Sampling:** Chọn traces cần thu thập.
- **Service dependency:** Quan hệ giữa các services.

Có thể instrument JBoss/Java, Spring Boot, Node.js, PHP Laravel bằng OpenTelemetry hoặc Elastic APM Agent, tùy hỗ trợ runtime/framework.

## 7. OpenTelemetry và Elastic Agent

OpenTelemetry là chuẩn mở để instrument, collect và export telemetry; không phải storage/dashboard.

```text
Java / PHP / Node.js Applications
             |
       OpenTelemetry SDK
             |
            OTLP
             |
    OTel Collector Gateway
             |
     Elastic OTLP Ingestion
             |
        Elasticsearch
             |
           Kibana
```

Với self-managed, kiểm tra kiến trúc Elastic OTel ingestion và Elastic Agent Gateway phù hợp phiên bản. Elastic Cloud có thể cung cấp managed OTLP endpoint.

| Công cụ | Vai trò |
|---|---|
| Filebeat | File log shipping |
| Metricbeat | Metrics collection |
| Elastic Agent | Unified collection, Fleet |
| Fluent Bit | Lightweight log collection |
| Logstash | Complex ETL, parsing, routing |
| OTel Collector | Vendor-neutral telemetry pipelines |
| Grafana Alloy | OTel-based collection, Prometheus/Grafana ecosystem |

Có thể giữ Logstash cho logs và bổ sung OTel cho metrics/traces.

## 8. SRE: SLI, SLO, SLA và Error Budget

| Khái niệm | Ý nghĩa | Ví dụ |
|---|---|---|
| SLI | Chỉ số đo thực tế | 99,95% request thành công |
| SLO | Mục tiêu nội bộ | Availability ≥ 99,9% |
| SLA | Cam kết dịch vụ | 99,5% uptime theo hợp đồng |
| Error Budget | Phần lỗi được phép | 0,1% nếu SLO 99,9% |

Ví dụ SLO availability 99,9% trong 30 ngày: **43,2 phút** error budget nếu đo theo thời gian uptime. Với request-based SLO, tính theo tỷ lệ request không đạt.

Bổ sung burn-rate alerting, multi-window alerts, incident severity, MTTR và postmortem.

## 9. ELK so với các nền tảng khác

| Nền tảng | Điểm mạnh |
|---|---|
| Elastic Observability | Unified search, logs, metrics, traces, analytics |
| Prometheus | Time-series metrics, PromQL, Kubernetes |
| Grafana | Visualization, multi-data-source dashboard |
| Splunk | Log analytics, operational investigation, SIEM |
| AppDynamics | Enterprise APM, business transactions, diagnostics |

Có thể kết hợp Prometheus + Grafana cho metrics và Elastic cho logs/traces; cần thiết kế correlation và alert ownership.

## 10. Security, HA và ELK Production

- **Security:** TLS HTTP/transport, TLS/mTLS log shipping, RBAC, API keys, secret management, network segmentation, audit logging.
- **Availability:** Node roles, quorum, shard allocation, replicas, rolling upgrades, snapshots và restore tests.
- **Performance:** JVM heap, indexing throughput, search latency, disk watermarks, shard sizing, high-cardinality fields.
- **Storage:** ILM, hot/warm/cold/frozen tiers khi hỗ trợ, searchable snapshots, retention và cost.
- **Pipeline reliability:** Logstash persistent queues, backpressure, dead-letter queues, retry, ingestion lag.
- **Data governance:** Redact passwords/tokens/PII, access control, retention, audit trails.

## 11. Lộ trình học 6 tuần

| Tuần | Chủ đề | Nội dung |
|---|---|---|
| 1 | ELK Fundamentals | Elasticsearch, Logstash, Kibana, indices, shards, mappings, KQL |
| 2 | Centralized Logging | Docker logs, Filebeat/Agent, pipelines, ECS, ILM |
| 3 | Infrastructure & Kubernetes | EKS metrics, kube-state-metrics, ingress, dashboards |
| 4 | APM & OpenTelemetry | Java/PHP instrumentation, OTLP, traces, service maps |
| 5 | SRE & Alerting | Golden Signals, RED/USE, SLI/SLO, burn rate, incident response |
| 6 | Production Architecture | TLS, RBAC, HA, snapshots, capacity planning, costs |

## 12. Đề xuất triển khai thực tế

1. **Logging:** Giữ Docker ELK hiện tại; chuẩn hóa JSON logs, trace ID, TLS và retention.
2. **Kubernetes Metrics:** Thu thập node/pod/container metrics, ingress RPS, 4xx/5xx, p95/p99.
3. **Distributed Tracing:** Instrument Java/PHP với OpenTelemetry; kết nối logs và traces.
4. **SRE:** SLO dashboard, alerting, error budget và incident response.

## Tài liệu tham khảo

- [Elastic Observability Documentation](https://www.elastic.co/docs/solutions/observability)
- [Fleet & Elastic Agent](https://www.elastic.co/docs/reference/fleet)
- [Elasticsearch Documentation](https://www.elastic.co/docs/reference/elasticsearch)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

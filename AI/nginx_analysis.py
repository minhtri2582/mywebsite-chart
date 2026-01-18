import os
import json
from datetime import datetime, timedelta
from opensearchpy import OpenSearch
import urllib3

# Tắt cảnh báo SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Cấu hình kết nối
OPENSEARCH_URL = "https://localhost:9200"
OPENSEARCH_USERNAME = "admin"
OPENSEARCH_PASSWORD = "O0cpR65ml6eDQAah"

client = OpenSearch(
    hosts=[OPENSEARCH_URL],
    http_auth=(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD),
    use_ssl=True,
    verify_certs=False,
    ssl_show_warn=False
)

def analyze_nginx_logs():
    print("--- Phân tích Nginx Logs (1 tháng qua) ---")
    
    # 1. Tìm index liên quan đến nginx
    try:
        indices = client.cat.indices(format="json")
        nginx_indices = [i['index'] for i in indices if 'nginx' in i['index'].lower()]
        
        if not nginx_indices:
            print("Không tìm thấy index nào chứa 'nginx'. Các index hiện có:")
            for i in indices:
                print(f"- {i['index']}")
            return

        target_index = nginx_indices[0] # Lấy cái đầu tiên làm ví dụ
        print(f"Đang phân tích index: {target_index}")

        # 2. Lấy mapping để xác định field thời gian
        mapping = client.indices.get_mapping(index=target_index)
        # Giả định field thời gian là @timestamp (thường gặp trong ELK/OpenSearch)
        time_field = "@timestamp"
        
        # 3. Tính toán thời gian (1 tháng qua)
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=30)
        
        # 4. Truy vấn thống kê lỗi (status code 4xx, 5xx)
        query = {
            "size": 0,
            "query": {
                "range": {
                    time_field: {
                        "gte": start_time.isoformat(),
                        "lte": end_time.isoformat()
                    }
                }
            },
            "aggs": {
                "status_codes": {
                    "terms": {
                        "field": "status.keyword" if "status.keyword" in str(mapping) else "status"
                    }
                },
                "error_over_time": {
                    "date_histogram": {
                        "field": time_field,
                        "calendar_interval": "day"
                    }
                },
                "top_ips": {
                    "terms": {
                        "field": "remote_ip.keyword" if "remote_ip.keyword" in str(mapping) else "clientip.keyword",
                        "size": 10
                    }
                }
            }
        }
        
        response = client.search(index=target_index, body=query)
        
        # 5. Tạo báo cáo
        report = {
            "total_logs": response['hits']['total']['value'],
            "status_distribution": response['aggregations']['status_codes']['buckets'],
            "top_clients": response['aggregations']['top_ips']['buckets'],
            "anomalies": []
        }
        
        # Kiểm tra bất thường (ví dụ: tỷ lệ lỗi > 10%)
        total = report['total_logs']
        if total > 0:
            error_count = sum(b['doc_count'] for b in report['status_distribution'] if str(b['key']).startswith(('4', '5')))
            error_rate = (error_count / total) * 100
            if error_rate > 10:
                report['anomalies'].append(f"Tỷ lệ lỗi cao: {error_rate:.2f}%")
        
        with open("/Users/tridlm/DevOps/nginx_report_v2.json", "w") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print("Báo cáo đã được ghi vào nginx_report_v2.json")

    except Exception as e:
        print(f"Lỗi khi thực hiện phân tích: {str(e)}")

if __name__ == "__main__":
    analyze_nginx_logs()

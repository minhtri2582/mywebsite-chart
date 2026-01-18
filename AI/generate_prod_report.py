import os
import json
from datetime import datetime, timedelta
from opensearchpy import OpenSearch
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Config
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

def run_report():
    index_pattern = "nginx-access-prod-*"
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=30)
    
    query = {
        "size": 0,
        "query": {
            "range": {
                "@timestamp": {
                    "gte": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "lte": end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
            }
        },
        "aggs": {
            "top_ips": { "terms": { "field": "remote_ip.keyword", "size": 5 } },
            "top_requests": { "terms": { "field": "request.keyword", "size": 5 } },
            "status_codes": { "terms": { "field": "status.keyword", "size": 5 } }
        }
    }

    report_lines = [f"# Nginx Top Traffic Report - {index_pattern}", f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ""]
    
    try:
        res = client.search(index=index_pattern, body=query)
        total = res['hits']['total']['value']
        report_lines.append(f"**Total Logs:** {total}")
        report_lines.append("")
        
        if total > 0:
            report_lines.append("## Top 5 IPs")
            for b in res['aggregations']['top_ips']['buckets']:
                report_lines.append(f"- {b['key']}: {b['doc_count']}")
            report_lines.append("")
            
            report_lines.append("## Top 5 Requests")
            for b in res['aggregations']['top_requests']['buckets']:
                report_lines.append(f"- {b['key']}: {b['doc_count']}")
            report_lines.append("")
            
            report_lines.append("## Status Codes")
            for b in res['aggregations']['status_codes']['buckets']:
                report_lines.append(f"- {b['key']}: {b['doc_count']}")
        else:
            report_lines.append("No logs found for this index pattern in the last 30 days.")
            
            # Check if any indices exist at all
            indices = client.cat.indices(format="json")
            report_lines.append("")
            report_lines.append("## Available Indices in OpenSearch:")
            for i in indices:
                report_lines.append(f"- {i['index']} ({i['docs.count']} docs)")

    except Exception as e:
        report_lines.append(f"## Error during analysis")
        report_lines.append(f"```\n{str(e)}\n```")

    with open("/Users/tridlm/DevOps/nginx_prod_report.md", "w") as f:
        f.write("\n".join(report_lines))

if __name__ == "__main__":
    run_report()

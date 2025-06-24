Dưới đây là bản dịch tiếng Anh của hướng dẫn trên:

⸻

✅ Step 1: List matching log streams

aws logs describe-log-streams \
--log-group-name "/app/cia/prod" \
--query "logStreams[?starts_with(logStreamName, '/2025/06/') && contains(logStreamName, 'jboss/cashinsight-log')].logStreamName" \
--output text

This command will return a list of log stream names like:

/2025/06/01/14/xyz/jboss/cashinsight-log
/2025/06/02/12/abc/jboss/cashinsight-log
...


⸻

✅ Step 2: Use filter-log-events for each log stream

Example:

aws logs filter-log-events \
--log-group-name "/app/cia/prod" \
--log-stream-names "/2025/06/01/14/xyz/jboss/cashinsight-log" "/2025/06/02/12/abc/jboss/cashinsight-log" \
--output text > logs.txt

You can automate this using a shell loop:

aws logs describe-log-streams \
--log-group-name "/app/cia/prod" \
--query "logStreams[?starts_with(logStreamName, '/2025/06/') && contains(logStreamName, 'jboss/cashinsight-log')].logStreamName" \
--output text > streams.txt

# Loop and fetch logs
for stream in $(cat streams.txt); do
aws logs filter-log-events \
--log-group-name "/app/cia/prod" \
--log-stream-names "$stream" \
--output text >> logs.txt
done


⸻

🔎 If you want to filter logs by content:

Add a --filter-pattern, for example:

--filter-pattern '"ERROR"'  # filters lines containing the word ERROR


⸻

✅ Skip date filters (start-time, end-time)

If you want to retrieve all available logs, just omit --start-time and --end-time:

aws logs filter-log-events \
--log-group-name "/app/cia/prod" \
--log-stream-names "/2025/06/01/14/xyz/jboss/cashinsight-log" \
--output text


⸻

```bash
#!/bin/bash

LOG_GROUP="/app/cia/prod"
OUTPUT_FILE="logs.txt"

# Clear old output
> "$OUTPUT_FILE"

echo "Fetching matching log streams from $LOG_GROUP..."

# Step 1: Get matching log stream names
LOG_STREAMS=$(aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --query "logStreams[?starts_with(logStreamName, '/2025/06/') && contains(logStreamName, 'jboss/cashinsight-log')].logStreamName" \
  --output text)

if [[ -z "$LOG_STREAMS" ]]; then
  echo "No matching log streams found."
  exit 1
fi

# Step 2: Fetch logs for each stream
for STREAM in $LOG_STREAMS; do
  echo "Fetching logs from stream: $STREAM"
  aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-names "$STREAM" \
    --output text >> "$OUTPUT_FILE"
done

echo "Logs saved to $OUTPUT_FILE"
```
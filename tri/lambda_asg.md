Dưới đây là một AWS Lambda function bằng Python để thay đổi số lượng mong muốn (desired capacity) của Auto Scaling Group (ASG) thành 1 và xóa trạng thái tạm dừng (suspended state).

⸻

📌 Yêu Cầu
	•	IAM Role cho Lambda cần có quyền:
	•	autoscaling:UpdateAutoScalingGroup
	•	autoscaling:ResumeProcesses
	•	autoscaling:DescribeAutoScalingGroups
	•	Boto3 (thư viện AWS SDK) để tương tác với ASG

⸻

🔹 Lambda Function

import boto3
import os

# Khởi tạo client Auto Scaling
autoscaling_client = boto3.client("autoscaling")

# Lấy tên ASG từ biến môi trường (hoặc sửa cứng)
ASG_NAME = os.getenv("ASG_NAME", "my-auto-scaling-group")

def lambda_handler(event, context):
    try:
        # Cập nhật số lượng mong muốn của ASG thành 1
        autoscaling_client.update_auto_scaling_group(
            AutoScalingGroupName=ASG_NAME,
            DesiredCapacity=1
        )
        print(f"Updated desired capacity of {ASG_NAME} to 1")

        # Xóa trạng thái tạm dừng của ASG
        autoscaling_client.resume_processes(AutoScalingGroupName=ASG_NAME)
        print(f"Resumed all processes for {ASG_NAME}")

        return {
            "statusCode": 200,
            "body": f"Successfully updated {ASG_NAME} to desired capacity 1 and resumed processes."
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "body": f"Failed to update {ASG_NAME}: {str(e)}"
        }



⸻

🔹 Hướng Dẫn Cấu Hình

1️⃣ Tạo Lambda Function
	•	Mở AWS Lambda Console → Create Function
	•	Chọn Runtime: Python 3.x
	•	Chọn Execution Role: Tạo role mới với quyền AutoScalingFullAccess

2️⃣ Thêm Biến Môi Trường
	•	Vào tab Configuration → Environment Variables
	•	Thêm biến:

Key: ASG_NAME
Value: <Tên Auto Scaling Group của bạn>



3️⃣ Kiểm Tra
	•	Test Lambda bằng cách nhấn “Test”
	•	Kiểm tra AWS Auto Scaling Console để xác nhận thay đổi

⸻

🚀 Tổng Kết

✅ Cập nhật desired instance = 1
✅ Clear suspend state
✅ Tương thích với AWS Lambda


Bạn có thể sử dụng Amazon EventBridge (trước đây là CloudWatch Events) để tự động kích hoạt AWS Lambda vào lúc 8:00 AM từ thứ Hai đến thứ Sáu.

⸻

🔹 Các Bước Thực Hiện

1️⃣ Tạo AWS Lambda function (hoặc sử dụng Lambda đã có)
2️⃣ Tạo EventBridge Rule để chạy mỗi ngày lúc 8:00 AM (Mon-Fri)
3️⃣ Gắn Lambda vào EventBridge Rule

⸻

📌 1. Tạo EventBridge Rule

Bạn có thể thực hiện qua AWS Console hoặc AWS CLI.

👉 Cách 1: Dùng AWS Console
	1.	Mở AWS EventBridge → Chọn Rules → Create Rule
	2.	Đặt tên rule, ví dụ: TriggerLambdaAt8AM
	3.	Chọn Rule Type → Chọn Schedule
	4.	Đặt Cron Expression:

0 8 ? * MON-FRI *

🔹 Ý nghĩa cron:
	•	0 8 → Chạy vào 8:00 AM UTC
	•	? → Bỏ qua ngày trong tháng
	•	* → Chạy mọi tháng
	•	MON-FRI → Chạy từ Thứ Hai đến Thứ Sáu

	5.	Chọn Target → Lambda Function → Chọn Lambda cần chạy
	6.	Tạo Rule

⸻

👉 Cách 2: Dùng AWS CLI

Chạy lệnh sau để tạo EventBridge Rule:

aws events put-rule --name "TriggerLambdaAt8AM" \
    --schedule-expression "cron(0 8 ? * MON-FRI *)" \
    --state ENABLED

Gắn Rule vào Lambda:

aws lambda add-permission \
    --function-name "YourLambdaFunction" \
    --statement-id "EventBridgeInvoke" \
    --action "lambda:InvokeFunction" \
    --principal "events.amazonaws.com" \
    --source-arn "arn:aws:events:your-region:your-account-id:rule/TriggerLambdaAt8AM"

Gắn Lambda làm Target của Rule:

aws events put-targets --rule "TriggerLambdaAt8AM" \
    --targets "Id"="1","Arn"="arn:aws:lambda:your-region:your-account-id:function:YourLambdaFunction"



⸻

📌 2. Kiểm Tra Lại
	•	Kiểm tra danh sách rules:

aws events list-rules


	•	Xem targets của rule:

aws events list-targets-by-rule --rule "TriggerLambdaAt8AM"


	•	Kiểm tra log trong CloudWatch Logs để đảm bảo Lambda chạy đúng lịch trình.

⸻

🚀 Tổng Kết

✅ Tự động chạy Lambda vào 8:00 AM từ Thứ Hai đến Thứ Sáu
✅ Cấu hình qua AWS Console hoặc CLI
✅ Có thể kiểm tra log trong CloudWatch


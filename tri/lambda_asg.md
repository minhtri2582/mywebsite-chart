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

Bạn thử deploy và kiểm tra xem chạy đúng chưa nhé! 🚀

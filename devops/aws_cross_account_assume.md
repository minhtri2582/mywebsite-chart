Để cho phép một EC2 instance profile (IAM role) từ AWS Account A (AWS 1) assume một IAM role ở AWS Account B (AWS 2), bạn cần cấu hình trust relationship phù hợp trong role ở Account B. Dưới đây là hướng dẫn từng bước:

⸻

✅ Ví dụ:
	•	Account A (AWS 1): Nơi EC2 instance đang chạy.
	•	IAM Role: EC2InstanceRole
	•	Account B (AWS 2): Nơi chứa role đích cần assume.
	•	IAM Role: CrossAccountRole

⸻

Bước 1: Cấu hình trust relationship trong Account B (AWS 2)

Trong role CrossAccountRole ở Account B, chỉnh sửa phần Trust relationship như sau:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<AccountA_ID>:role/EC2InstanceRole"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}

🔑 Thay <AccountA_ID> bằng AWS Account ID của Account A và EC2InstanceRole là tên role EC2 đang gắn với instance.

⸻

Bước 2: Gắn quyền cho EC2InstanceRole (Account A)

Trong role EC2InstanceRole ở Account A, bạn cần cấp quyền để được assume role ở Account B:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::<AccountB_ID>:role/CrossAccountRole"
    }
  ]
}

🔁 <AccountB_ID> là AWS Account ID của Account B, CrossAccountRole là tên role cần assume.

⸻

Bước 3: Gọi lệnh AssumeRole từ EC2 instance

Trên EC2 instance (đã gắn với EC2InstanceRole), bạn có thể dùng AWS CLI hoặc SDK để assume role:

aws sts assume-role \
  --role-arn arn:aws:iam::<AccountB_ID>:role/CrossAccountRole \
  --role-session-name crossacct-session

Sau đó bạn sẽ nhận được temporary credentials (AccessKeyId, SecretAccessKey, SessionToken) có thể sử dụng để gọi các API của Account B.

⸻

Gợi ý sử dụng temporary credential

Bạn có thể export credential tạm thời để sử dụng ngay:

export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...



⸻

Nếu bạn cần ví dụ cụ thể hơn hoặc Terraform/CloudFormation để triển khai tự động, mình có thể hỗ trợ thêm.

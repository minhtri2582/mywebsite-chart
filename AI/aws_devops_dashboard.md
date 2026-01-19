# Unified AWS DevOps & SRE Observability Dashboard Prompt

**Role:** You are an expert Full-stack Cloud Engineer and UI/UX Designer specialized in DevOps tools.

**Objective:** Build a single-page, full-width "Unified AWS Observability Dashboard" using **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **AWS SDK v3**. The dashboard must provide a high-level overview of infrastructure health, costs, and logs in real-time.

---

## 1. Architecture & Tech Stack

- **Framework:** Next.js 15+ (App Router).
- **Styling:** Tailwind CSS (Dark Mode by default, Slate/Blue professional theme).
- **Icons:** Lucide-react.
- **Charts:** Recharts for billing/metrics.
- **Backend:** Next.js API Routes using:
    - `@aws-sdk/client-s3`
    - `@aws-sdk/client-ec2`
    - `@aws-sdk/client-rds`
    - `@aws-sdk/client-cloudwatch`
    - `@aws-sdk/client-cloudwatch-logs`
    - `@aws-sdk/client-eks`
    - `@aws-sdk/client-cloudtrail`
    - `@aws-sdk/client-cost-explorer`

---

## 2. Core Features & UI Layout (Single Page - No Sidebar)

- **Header:** Full-width header showing "AWS Central Dashboard", account identity (STS), and a prominent "Sync Infrastructure" refresh button.
- **Key Metrics Row:** 4 Stats cards:
    - **Account Status:** IAM identity & region health.
    - **Billing:** Current month's estimated cost from Cost Explorer.
    - **Compute:** Total count of EC2 instances.
    - **Database:** Total count of RDS instances/clusters.
- **Main Content Grid (2-column layout - 8:4 ratio):**
    - **Left Column (8/12):**
        - **Live Resources:** A unified list of EC2 and RDS instances. Include: Name, Type, State (Running/Available), and a real-time CPU Utilization sparkline/progress bar (fetched from CloudWatch metrics for the last 1 hour).
        - **Audit Trail:** A table of the latest 10 CloudTrail "Write" events (EventName, Username, ResourceName, Timestamp).
    - **Right Column (4/12):**
        - **EKS Health:** List EKS clusters with operational status and a summary of recent Control Plane system logs (API Server, Authenticator errors).
        - **Incident Log Feed:** An expandable feed of CloudWatch Log Groups.
            - **Logic:** Filter logs for keywords: `ERROR`, `CRITICAL`, `FAIL`, `WARNING`.
            - **Priority:** Sort logs by Severity (`Critical` > `Error` > `Warning`).
            - **UI:** Use color-coded badges (Red for Critical, Orange for Error, Yellow for Warning).

---

## 3. Advanced Logic Requirements

- **Log Categorization:** Implement a function to analyze log strings and assign severity levels (Critical/Error/Warning) based on keywords.
- **Security:** Ensure AWS credentials are loaded via environment variables.
- **UX:** Use Framer Motion for smooth transitions, Tailwind for a clean "glassmorphism" look, and implement "Skeleton Loading" states for all data fetching.
- **Observability:** Ensure all errors (API failures) are handled gracefully with UI notifications.

---

## 4. Design Specifications

- **Theme:** Deep Slate (`slate-950`) background, Blue primary accents, Emerald for success, Red for critical.
- **Layout:** Max-width 1600px, centered, clean borders (`slate-800`), and heavy use of mono-space fonts for resource IDs and logs.

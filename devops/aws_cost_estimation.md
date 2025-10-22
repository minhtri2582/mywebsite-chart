import pypandoc

markdown_text = """
# 💬 AWS Cost Estimation — Full Q&A Discussion Template

## 🟢 1. Overview & Objectives

**Q:** What’s the purpose of this AWS cost estimation?  
**A:** The goal is to estimate monthly and annual AWS costs for our project, covering compute, storage, networking, and supporting services. It helps us plan the cloud budget, optimize design decisions, and justify scaling strategies.

## 🟢 2. Scope Definition

**Q:** What resources or workloads are included in this estimate?  
**A:** We include all major components:  
- Compute (EC2, Lambda, ECS/EKS, Fargate)  
- Storage (EBS, S3, EFS, RDS snapshots)  
- Database (RDS, DynamoDB, Aurora)  
- Networking (ALB/NLB, NAT Gateway, CloudFront, data transfer)  
- Supporting services (CloudWatch, Route53, Secrets Manager, etc.)  

## 🟢 3. Assumptions

**Q:** What assumptions are we making for this estimate?  
**A:**  
- Environment size: 3 tiers (Dev, Staging, Production)  
- Uptime: 24x7 for production, 8x5 for dev/test  
- Regions: ap-southeast-1 (Singapore) and ap-southeast-2 (Sydney)  
- Data transfer: 2TB/month outbound  
- Compute type: t3.medium (dev), m6i.large (prod)  
- Reserved instances for 1 year (production only)  
- S3 lifecycle policies enabled for infrequent access and Glacier tiers  

## 🟢 4. Tools Used

**Q:** Which tools do we use for cost estimation?  
**A:**  
- **AWS Pricing Calculator** ([calculator.aws](https://calculator.aws))  
- **Cost Explorer** for historical usage patterns  
- **Trusted Advisor** for optimization insights  
- **AWS Budgets** for ongoing monitoring  
- Optionally: **Infracost** for IaC cost estimation (Terraform integration)

## 🟢 5. Service-by-Service Breakdown

| Service | Description | Estimated Monthly Cost (USD) |
|----------|--------------|-------------------------------|
| EC2 (4 instances) | 2× Prod, 2× Dev/Staging | $180 |
| RDS (PostgreSQL) | 1× db.t3.medium (multi-AZ) | $120 |
| S3 | 500 GB storage + lifecycle policies | $20 |
| CloudFront | CDN for static assets | $30 |
| ALB + NAT Gateway | Load balancing + egress | $40 |
| CloudWatch | Logs + metrics | $15 |
| Backup/Snapshots | Daily RDS + EBS backups | $25 |
| **Total (est.)** |  | **$430/month** |

## 🟢 6. Optimization Opportunities

**Q:** How can we reduce costs?  
**A:**  
- Use **spot instances** for non-critical workloads.  
- Apply **instance scheduling** for dev/test.  
- Enable **S3 Intelligent-Tiering**.  
- Implement **reserved or savings plans** for steady workloads.  
- Consolidate **CloudWatch logs** and apply retention policies.  
- Move static files to **CloudFront + S3** to reduce EC2 load.  

## 🟢 7. Scaling Considerations

**Q:** How will costs change if traffic doubles?  
**A:** Compute and network costs scale linearly, while storage grows based on data volume. If traffic doubles, total cost may increase by ~1.6–1.8× depending on caching efficiency and database load.

## 🟢 8. Monitoring & Forecasting

**Q:** How do we monitor actual costs after go-live?  
**A:**  
- Enable **AWS Budgets** with alerts at 80% and 100%.  
- Set up **Cost Explorer daily reports**.  
- Enable **resource tagging** (`env`, `project`, `owner`) for granular tracking.  
- Review **monthly with Finance** and adjust resource sizes.

## 🟢 9. Reporting & Approval

**Q:** Who approves the cost estimate and budget?  
**A:** Usually, Cloud/DevOps lead prepares the estimate → validated by Solution Architect → approved by Finance or Project Manager.

## 🟢 10. Sample Summary (Executive View)

> **Estimated Monthly AWS Cost:** ~$430 USD  
> **Annual Estimate:** ~$5,160 USD  
> **Optimization Potential:** 20–25%  
> **Key Risks:** Data transfer spikes, CloudWatch log growth, NAT Gateway egress charges  
> **Next Steps:** Validate assumptions → run AWS Pricing Calculator → finalize budget proposal.
"""

output_path = "/mnt/data/AWS_Cost_Estimation_QA.docx"
pypandoc.convert_text(markdown_text, 'docx', format='md', outputfile=output_path, extra_args=['--standalone'])
output_path

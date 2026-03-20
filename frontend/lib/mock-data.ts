// NAYAM Mock Data

export interface Citizen {
  id: string
  name: string
  contact: string
  ward: string
  activeIssues: number
  riskLevel: "low" | "medium" | "high" | "critical"
}

export interface Issue {
  id: string
  citizenName: string
  department: string
  status: "open" | "in-progress" | "resolved" | "escalated"
  priority: "low" | "medium" | "high" | "critical"
  ward: string
  riskScore: number
  createdDate: string
  description: string
}

export interface Document {
  id: string
  title: string
  uploadedBy: string
  date: string
  aiSummary: string
  riskRelevance: "low" | "medium" | "high"
}

export interface Approval {
  id: string
  action: string
  aiConfidence: number
  linkedIssue: string
  linkedDocument?: string
  timestamp: string
  summary: string
  status: "pending" | "approved" | "rejected"
}

export interface AuditLog {
  id: string
  action: string
  user: string
  timestamp: string
  details: string
  type: "access" | "modification" | "approval" | "system"
}

export interface AIInsight {
  id: string
  title: string
  description: string
  confidence: number
  type: "recommendation" | "alert" | "prediction"
  timestamp: string
}

export const citizens: Citizen[] = [
  { id: "CIT-001", name: "Rajesh Kumar", contact: "+91 98765 43210", ward: "Tilak Nagar", activeIssues: 3, riskLevel: "high" },
  { id: "CIT-002", name: "Priya Sharma", contact: "+91 87654 32109", ward: "Saket", activeIssues: 1, riskLevel: "low" },
  { id: "CIT-003", name: "Amit Patel", contact: "+91 76543 21098", ward: "Mayur Vihar", activeIssues: 2, riskLevel: "medium" },
  { id: "CIT-004", name: "Sunita Devi", contact: "+91 65432 10987", ward: "Karol Bagh", activeIssues: 4, riskLevel: "critical" },
  { id: "CIT-005", name: "Vikram Singh", contact: "+91 54321 09876", ward: "Greater Kailash", activeIssues: 0, riskLevel: "low" },
  { id: "CIT-006", name: "Anjali Gupta", contact: "+91 43210 98765", ward: "Pitampura", activeIssues: 1, riskLevel: "medium" },
  { id: "CIT-007", name: "Deepak Verma", contact: "+91 32109 87654", ward: "Tilak Nagar", activeIssues: 2, riskLevel: "high" },
  { id: "CIT-008", name: "Meena Joshi", contact: "+91 21098 76543", ward: "Dwarka", activeIssues: 0, riskLevel: "low" },
]

export const issues: Issue[] = [
  { id: "ISS-001", citizenName: "Rajesh Kumar", department: "Water Supply", status: "open", priority: "high", ward: "Tilak Nagar", riskScore: 78, createdDate: "2026-02-15", description: "Persistent water supply disruption affecting 200+ households in Tilak Nagar. Multiple complaints received over 2 weeks." },
  { id: "ISS-002", citizenName: "Priya Sharma", department: "Roads", status: "in-progress", priority: "medium", ward: "Saket", riskScore: 45, createdDate: "2026-02-18", description: "Pothole cluster on main arterial road causing traffic congestion and minor accidents." },
  { id: "ISS-003", citizenName: "Sunita Devi", department: "Sanitation", status: "escalated", priority: "critical", ward: "Karol Bagh", riskScore: 92, createdDate: "2026-02-10", description: "Open sewage overflow near primary school. Health hazard requiring immediate intervention." },
  { id: "ISS-004", citizenName: "Amit Patel", department: "Electricity", status: "open", priority: "high", ward: "Mayur Vihar", riskScore: 67, createdDate: "2026-02-20", description: "Frequent power outages lasting 4-6 hours daily. Affecting small businesses and healthcare facilities." },
  { id: "ISS-005", citizenName: "Vikram Singh", department: "Education", status: "resolved", priority: "low", ward: "Greater Kailash", riskScore: 15, createdDate: "2026-01-28", description: "Request for additional teaching staff at ward community center." },
  { id: "ISS-006", citizenName: "Deepak Verma", department: "Water Supply", status: "in-progress", priority: "high", ward: "Tilak Nagar", riskScore: 72, createdDate: "2026-02-22", description: "Contaminated water samples reported. Testing underway." },
  { id: "ISS-007", citizenName: "Anjali Gupta", department: "Healthcare", status: "open", priority: "medium", ward: "Pitampura", riskScore: 55, createdDate: "2026-02-24", description: "PHC staffing shortage reported. Only one doctor available for 5000+ population." },
  { id: "ISS-008", citizenName: "Sunita Devi", department: "Housing", status: "open", priority: "critical", ward: "Karol Bagh", riskScore: 88, createdDate: "2026-02-25", description: "Structural damage to government housing block post-monsoon. 12 families at risk." },
]

export const documents: Document[] = [
  { id: "DOC-001", title: "Tilak Nagar Water Audit Report", uploadedBy: "Dr. A. Mehta", date: "2026-02-20", aiSummary: "Critical infrastructure gaps identified in water distribution network. 3 pump stations operating below capacity.", riskRelevance: "high" },
  { id: "DOC-002", title: "Q4 Sanitation Review", uploadedBy: "R. Krishnan", date: "2026-02-18", aiSummary: "Overall improvement in waste management. Karol Bagh remains a concern with 40% non-compliance rate.", riskRelevance: "medium" },
  { id: "DOC-003", title: "Budget Allocation FY2026", uploadedBy: "Finance Dept", date: "2026-02-15", aiSummary: "12% increase in infrastructure spending. Healthcare allocation below recommended threshold.", riskRelevance: "low" },
  { id: "DOC-004", title: "Monsoon Preparedness Plan", uploadedBy: "Disaster Mgmt Cell", date: "2026-02-12", aiSummary: "Early warning systems upgraded. 5 wards still lacking adequate drainage infrastructure.", riskRelevance: "high" },
  { id: "DOC-005", title: "Healthcare Access Report", uploadedBy: "Health Officer", date: "2026-02-10", aiSummary: "PHC utilization at 78%. Specialist availability gap in 8 out of 15 wards.", riskRelevance: "medium" },
]

export const approvals: Approval[] = [
  { id: "APR-001", action: "Emergency Water Supply Deployment", aiConfidence: 94, linkedIssue: "ISS-001", timestamp: "2026-02-26 09:30", summary: "Deploy tanker service to Tilak Nagar for 200+ affected households. Estimated cost: 2.4L", status: "pending" },
  { id: "APR-002", action: "Sewage Cleanup Authorization", aiConfidence: 97, linkedIssue: "ISS-003", timestamp: "2026-02-26 08:15", summary: "Immediate cleanup and diversion near primary school. Health department co-ordination required.", status: "pending" },
  { id: "APR-003", action: "Road Repair Budget Release", aiConfidence: 82, linkedIssue: "ISS-002", linkedDocument: "DOC-003", timestamp: "2026-02-25 16:45", summary: "Release 1.8L for pothole repair on arterial road. Contractor pre-approved.", status: "pending" },
  { id: "APR-004", action: "PHC Staff Requisition", aiConfidence: 76, linkedIssue: "ISS-007", linkedDocument: "DOC-005", timestamp: "2026-02-25 14:20", summary: "Request 2 additional doctors for Pitampura PHC. Transfer from surplus wards.", status: "pending" },
  { id: "APR-005", action: "Structural Assessment Order", aiConfidence: 91, linkedIssue: "ISS-008", timestamp: "2026-02-25 11:00", summary: "Commission urgent structural assessment of housing block. Temporary relocation plan needed.", status: "approved" },
]

export const auditLogs: AuditLog[] = [
  { id: "AUD-001", action: "Document Accessed", user: "Dr. A. Mehta", timestamp: "2026-02-26 10:15", details: "Accessed Tilak Nagar Water Audit Report", type: "access" },
  { id: "AUD-002", action: "Issue Escalated", user: "System AI", timestamp: "2026-02-26 09:45", details: "ISS-003 auto-escalated due to risk score exceeding threshold", type: "system" },
  { id: "AUD-003", action: "Approval Granted", user: "Commissioner S. Rao", timestamp: "2026-02-25 17:30", details: "APR-005 structural assessment approved", type: "approval" },
  { id: "AUD-004", action: "Citizen Record Modified", user: "Data Officer K. Nair", timestamp: "2026-02-25 15:20", details: "Updated contact information for CIT-004", type: "modification" },
  { id: "AUD-005", action: "Report Generated", user: "System AI", timestamp: "2026-02-25 12:00", details: "Weekly risk assessment report generated for all wards", type: "system" },
  { id: "AUD-006", action: "Login Detected", user: "Admin R. Gupta", timestamp: "2026-02-25 09:00", details: "Secure login from authorized terminal", type: "access" },
  { id: "AUD-007", action: "Data Export", user: "Analyst P. Roy", timestamp: "2026-02-24 16:45", details: "Exported Q4 compliance data for review", type: "access" },
  { id: "AUD-008", action: "Policy Updated", user: "Commissioner S. Rao", timestamp: "2026-02-24 14:30", details: "Updated escalation threshold from 80 to 75", type: "modification" },
]

export const aiInsights: AIInsight[] = [
  { id: "INS-001", title: "Karol Bagh Risk Escalation Predicted", description: "Based on current issue density and resolution timeline, Karol Bagh risk score projected to reach 95+ within 48 hours. Recommend pre-emptive resource allocation.", confidence: 89, type: "prediction", timestamp: "2026-02-26 10:00" },
  { id: "INS-002", title: "Water Infrastructure Correlation", description: "Analysis reveals 73% of Tilak Nagar water complaints correlate with pump station 3 downtime. Targeted maintenance could resolve 80% of active issues.", confidence: 92, type: "recommendation", timestamp: "2026-02-26 09:30" },
  { id: "INS-003", title: "Seasonal Pattern Alert", description: "Historical data indicates 40% spike in drainage complaints expected within 2 weeks. 5 wards currently unprepared.", confidence: 85, type: "alert", timestamp: "2026-02-26 08:45" },
  { id: "INS-004", title: "Budget Optimization Opportunity", description: "Reallocation of 15% from underutilized education fund to healthcare could address PHC staffing gap across 8 wards.", confidence: 78, type: "recommendation", timestamp: "2026-02-25 16:00" },
]

export const wardRiskData = [
  { ward: "Dwarka", risk: 22, issues: 3, trend: "stable" },
  { ward: "Rohini", risk: 35, issues: 5, trend: "rising" },
  { ward: "Karol Bagh", risk: 92, issues: 12, trend: "rising" },
  { ward: "Lajpat Nagar", risk: 18, issues: 2, trend: "falling" },
  { ward: "Saket", risk: 45, issues: 6, trend: "stable" },
  { ward: "Pitampura", risk: 55, issues: 7, trend: "rising" },
  { ward: "Mayur Vihar", risk: 67, issues: 8, trend: "stable" },
  { ward: "Vikaspuri", risk: 30, issues: 4, trend: "falling" },
  { ward: "Tilak Nagar", risk: 78, issues: 11, trend: "rising" },
  { ward: "Greater Kailash", risk: 15, issues: 1, trend: "falling" },
]

export const issueTrendData = [
  { month: "Sep", open: 24, resolved: 18, escalated: 3 },
  { month: "Oct", open: 28, resolved: 22, escalated: 4 },
  { month: "Nov", open: 32, resolved: 25, escalated: 5 },
  { month: "Dec", open: 27, resolved: 30, escalated: 3 },
  { month: "Jan", open: 35, resolved: 28, escalated: 6 },
  { month: "Feb", open: 42, resolved: 31, escalated: 8 },
]

export const forecastData = [
  { week: "W1 Mar", actual: null, predicted: 45, lowerBound: 38, upperBound: 52 },
  { week: "W2 Mar", actual: null, predicted: 48, lowerBound: 40, upperBound: 56 },
  { week: "W3 Mar", actual: null, predicted: 52, lowerBound: 43, upperBound: 61 },
  { week: "W4 Mar", actual: null, predicted: 47, lowerBound: 39, upperBound: 55 },
]

export const syncActivity = [
  { id: 1, action: "Data synced to central server", timestamp: "2026-02-26 10:15", status: "success" },
  { id: 2, action: "Offline cache updated", timestamp: "2026-02-26 09:45", status: "success" },
  { id: 3, action: "Geo data layer refreshed", timestamp: "2026-02-26 08:30", status: "success" },
  { id: 4, action: "AI model predictions updated", timestamp: "2026-02-26 07:00", status: "success" },
  { id: 5, action: "Compliance check completed", timestamp: "2026-02-25 23:00", status: "warning" },
]

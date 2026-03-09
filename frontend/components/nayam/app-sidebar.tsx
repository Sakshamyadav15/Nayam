"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  AlertCircle,
  FileText,
  Brain,
  MapPin,
  TrendingUp,
  CheckSquare,
  Shield,
  Activity,
  Settings,
  ChevronLeft,
  CalendarDays,
  PenTool,
} from "lucide-react"

// Bhashini icon — uses dedicated logo from /public
const BhashiniIcon = ({ className }: { className?: string }) => (
  <img src="/bhashini-logo.svg" alt="" className={className} />
)
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"

const mainNav = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Citizens", href: "/citizens", icon: Users },
  { title: "Issues", href: "/issues", icon: AlertCircle },
  { title: "Documents", href: "/documents", icon: FileText },
]

const intelligenceNav = [
  { title: "Intelligence", href: "/intelligence", icon: Brain },
  { title: "Bhashini", href: "/bhashini", icon: BhashiniIcon },
  { title: "Drafts", href: "/drafts", icon: PenTool },
  { title: "Geo Analytics", href: "/geo-analytics", icon: MapPin },
  { title: "Predictive Insights", href: "/predictive", icon: TrendingUp },
]

const operationsNav = [
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Approvals", href: "/approvals", icon: CheckSquare },
  { title: "Compliance & Audit", href: "/compliance", icon: Shield },
  { title: "Monitoring", href: "/monitoring", icon: Activity },
]

const systemNav = [
  { title: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { toggleSidebar, state } = useSidebar()

  return (
    <Sidebar collapsible="icon" className="border-r-3 border-foreground">
      <SidebarHeader className="border-b-2 border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/Logo.png"
            alt="NAYAM"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-black tracking-wider text-sidebar-foreground">
              NAYAM
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
              Gov Intelligence
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/40">
            Core
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/40">
            Intelligence
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {intelligenceNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/40">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t-2 border-sidebar-border p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center p-2 text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
        >
          <ChevronLeft
            className="h-4 w-4 transition-transform group-data-[collapsible=icon]:rotate-180"
          />
          <span className="ml-2 text-xs font-semibold group-data-[collapsible=icon]:hidden">
            Collapse
          </span>
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}

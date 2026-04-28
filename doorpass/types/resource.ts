import type { ElementType } from "react"
import { Link, FileText, ImageIcon, File as FileIcon, PenLine } from "lucide-react"

export type ResourceType = "link" | "file" | "image" | "document" | "text"

export interface ResourceItem {
  id: number
  title: string
  description?: string
  resource_type: ResourceType
  url?: string
  author: string
  created_at: string
}

export interface ResourceTypeConfig {
  label: string
  Icon: ElementType
  color: string
  bg: string
}

export const RESOURCE_TYPE_CONFIG: Record<ResourceType, ResourceTypeConfig> = {
  link:     { label: "링크",   Icon: Link,      color: "text-blue-400",   bg: "bg-blue-500/10" },
  file:     { label: "파일",   Icon: FileIcon,  color: "text-orange-400", bg: "bg-orange-500/10" },
  image:    { label: "이미지", Icon: ImageIcon, color: "text-green-400",  bg: "bg-green-500/10" },
  document: { label: "문서",   Icon: FileText,  color: "text-purple-400", bg: "bg-purple-500/10" },
  text:     { label: "글",     Icon: PenLine,   color: "text-cyan-400",   bg: "bg-cyan-500/10" },
}

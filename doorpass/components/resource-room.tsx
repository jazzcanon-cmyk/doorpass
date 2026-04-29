"use client"

import { useState } from "react"
import { Plus, Loader2, AlertCircle, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useResources } from "@/hooks/useResources"
import { useIsAdmin } from "@/hooks/useIsAdmin"
import { ResourceForm } from "@/components/resources/ResourceForm"
import { ResourceCard } from "@/components/resources/ResourceCard"
import type { BoardCurrentUser } from "@/types/board"
import type { ResourceItem } from "@/types/resource"
import { EditResourceModal } from "@/components/EditResourceModal"

export function ResourceRoom({ currentUser }: { currentUser?: BoardCurrentUser }) {
  const { isAdmin } = useIsAdmin()
  const { resources, loading, error, fetchResources, deleteResource } = useResources()
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editResource, setEditResource] = useState<ResourceItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">자료실</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" />자료 등록
          </Button>
        )}
      </div>

      {isAdmin && showForm && (
        <ResourceForm
          onCancel={() => setShowForm(false)}
          onSubmitted={fetchResources}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm py-4">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      {resources.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">등록된 자료가 없습니다.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {resources.map((res) => (
            <ResourceCard
              key={res.id}
              res={res}
              expanded={expandedId === res.id}
              canDelete={isAdmin}
              canEdit={isAdmin || (!!currentUser?.userName && currentUser.userName === res.author)}
              onToggleExpand={() => setExpandedId(expandedId === res.id ? null : res.id)}
              onDelete={() => deleteResource(res.id)}
              onEdit={() => {
                setEditResource(res)
                setEditOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <EditResourceModal
        isOpen={editOpen}
        resource={editResource}
        onClose={() => setEditOpen(false)}
        onSuccess={fetchResources}
      />
    </div>
  )
}

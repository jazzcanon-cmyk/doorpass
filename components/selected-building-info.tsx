"use client"

import { useState } from "react"
import { X, Pencil, Check, Navigation } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Building {
  id: string
  name: string
  address: string
  password: string
  latitude: number
  longitude: number
  distance?: number
  memo?: string
}

interface SelectedBuildingInfoProps {
  building: Building
  onClose: () => void
  onPasswordUpdate?: (buildingId: string, newPassword: string) => void
}

export function SelectedBuildingInfo({ building, onClose, onPasswordUpdate }: SelectedBuildingInfoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editPassword, setEditPassword] = useState(building.password)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
    setEditPassword(building.password)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditPassword(building.password)
  }

  const handleSave = async () => {
    if (editPassword === building.password) {
      setIsEditing(false)
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch("/api/buildings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId: building.id,
          password: editPassword,
        }),
      })

      if (response.ok) {
        onPasswordUpdate?.(building.id, editPassword)
        setIsEditing(false)
      } else {
        alert("비밀번호 업데이트에 실패했습니다.")
      }
    } catch (error) {
      console.error("Update error:", error)
      alert("비밀번호 업데이트에 실패했습니다.")
    } finally {
      setIsUpdating(false)
    }
  }

  const openNavigation = () => {
    const url = `https://maps.google.com/maps?daddr=${building.latitude},${building.longitude}`
    window.open(url, "_blank")
  }

  return (
    <Card className="mt-3 border-primary/50 bg-card animate-in slide-in-from-bottom-2 duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm text-foreground">
                  <span className="font-bold">{building.name}</span>
                  <span className="text-muted-foreground"> - </span>
                  <span className="text-muted-foreground">{building.address}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {isEditing ? (
                <>
                  <Input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="flex-1 h-10 text-sm bg-secondary border-primary/50"
                    autoFocus
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="h-10 w-10 shrink-0"
                  >
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className="h-10 w-10 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-mono text-lg font-bold text-yellow-400">
                    {building.password}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleEdit}
                    className="h-10 w-10 shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={openNavigation}
                    className="h-10 w-10 shrink-0"
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

import "server-only"
import { supabaseAdmin } from "@/lib/supabase-admin"

export interface DeliveryRating {
  id: string
  rated_email: string
  rater_email: string
  delivery_id: number | null
  rating: number
  comment: string | null
  created_at: string
}

export async function createRating(params: {
  ratedEmail: string
  raterEmail: string
  deliveryRequestId?: number | null
  rating: number
  comment?: string | null
}): Promise<DeliveryRating> {
  if (params.rating < 1 || params.rating > 5) {
    throw new Error("평점은 1~5 사이여야 합니다.")
  }
  const { data, error } = await supabaseAdmin
    .from("delivery_ratings")
    .insert({
      rated_email: params.ratedEmail,
      rater_email: params.raterEmail,
      delivery_id: params.deliveryRequestId ?? null,
      rating: params.rating,
      comment: params.comment?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as DeliveryRating
}

export async function getRatingsByEmail(email: string): Promise<DeliveryRating[]> {
  const { data, error } = await supabaseAdmin
    .from("delivery_ratings")
    .select("*")
    .eq("rated_email", email)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as DeliveryRating[]
}

export async function getAverageRating(email: string): Promise<{ average: number; count: number }> {
  const { data, error } = await supabaseAdmin
    .from("delivery_ratings")
    .select("rating")
    .eq("rated_email", email)
  if (error) throw error
  const rows = (data ?? []) as { rating: number }[]
  if (rows.length === 0) return { average: 0, count: 0 }
  const sum = rows.reduce((acc, r) => acc + r.rating, 0)
  return {
    average: Math.round((sum / rows.length) * 10) / 10,
    count: rows.length,
  }
}

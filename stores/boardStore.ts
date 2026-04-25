import { create } from "zustand"

interface Post {
  id: number
  title: string
  author: string
  created_at: string
  view_count: number
  image_url?: string
}
interface Comment {
  id: number
  content: string
  author: string
  created_at: string
}
export interface PostDetail extends Post {
  content: string
  comments: Comment[]
}
export type BoardView = "list" | "detail" | "write" | "edit"

interface BoardState {
  view: BoardView
  postId: number | null
  editPost: PostDetail | null
  listKey: number

  goToDetail: (id: number) => void
  goToList: () => void
  goToWrite: () => void
  goToEdit: (post: PostDetail) => void
  afterWrite: () => void
  afterDelete: () => void
  afterEdit: () => void
}

export const useBoardStore = create<BoardState>((set) => ({
  view: "list",
  postId: null,
  editPost: null,
  listKey: 0,

  goToDetail: (id) => {
    if (!id || isNaN(id)) return
    set({ postId: id, view: "detail" })
  },
  goToList: () => set({ postId: null, editPost: null, view: "list" }),
  goToWrite: () => set({ view: "write" }),
  goToEdit: (post) => set({ editPost: post, view: "edit" }),
  afterWrite: () => set((s) => ({ listKey: s.listKey + 1, view: "list", postId: null })),
  afterDelete: () => set((s) => ({ listKey: s.listKey + 1, view: "list", postId: null })),
  afterEdit: () => set((s) => ({ listKey: s.listKey + 1, view: "detail" })),
}))

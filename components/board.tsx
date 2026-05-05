"use client"

import { useState, useRef } from "react"
import { ArrowLeft, Megaphone, FolderOpen } from "lucide-react"
import { useBoardStore } from "@/stores/boardStore"
import { NoticeBoard } from "@/components/notice-board"
import { ResourceRoom } from "@/components/resource-room"
import { SearchBar } from "@/components/board/SearchBar"
import { SearchableNoticeList } from "@/components/board/SearchableNoticeList"
import { SearchableResourceList } from "@/components/board/SearchableResourceList"
import { SearchAllResults } from "@/components/board/SearchAllResults"
import { PostList } from "@/components/board/PostList"
import { PostDetail } from "@/components/board/PostDetail"
import { PostWrite } from "@/components/board/PostWrite"
import { PostEdit } from "@/components/board/PostEdit"
import type { BoardTab, BoardCurrentUser } from "@/types/board"

export function Board({ currentUser }: { currentUser?: BoardCurrentUser }) {
  const { view, postId, editPost, listKey, goToList } = useBoardStore()
  const [boardTab, setBoardTab] = useState<BoardTab>("posts")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value.trim()), 500)
  }

  const clearSearch = () => {
    setSearchQuery("")
    setDebouncedQuery("")
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  const isSearching = debouncedQuery.length >= 2

  const handleTabChange = (tab: BoardTab) => {
    setBoardTab(tab)
    if (tab !== "posts") goToList()
  }

  return (
    <div>
      {boardTab === "notices" && (
        <div>
          <button onClick={() => handleTabChange("posts")} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />게시판으로
          </button>
          <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} onClear={clearSearch} />
          {isSearching ? <SearchableNoticeList query={debouncedQuery} /> : <NoticeBoard />}
        </div>
      )}

      {boardTab === "resources" && (
        <div>
          <button onClick={() => handleTabChange("posts")} className="flex items-center gap-2 text-muted-foreground mb-4 text-sm hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />게시판으로
          </button>
          <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} onClear={clearSearch} />
          {isSearching ? <SearchableResourceList query={debouncedQuery} /> : <ResourceRoom currentUser={currentUser} />}
        </div>
      )}

      {boardTab === "posts" && (
        <>
          {view === "list" && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => handleTabChange("notices")}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-all text-left"
                >
                  <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
                    <Megaphone className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">공지사항</span>
                </button>
                <button
                  onClick={() => handleTabChange("resources")}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-all text-left"
                >
                  <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">자료실</span>
                </button>
              </div>
              <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} onClear={clearSearch} />
              {isSearching ? (
                <SearchAllResults query={debouncedQuery} clearSearch={clearSearch} />
              ) : (
                <PostList listKey={listKey} debouncedQuery="" clearSearch={clearSearch} />
              )}
            </>
          )}
          {view === "detail" && postId !== null && <PostDetail postId={postId} defaultAuthor={currentUser?.userName} />}
          {view === "write" && <PostWrite defaultAuthor={currentUser?.userName} />}
          {view === "edit" && editPost && <PostEdit post={editPost} />}
        </>
      )}
    </div>
  )
}

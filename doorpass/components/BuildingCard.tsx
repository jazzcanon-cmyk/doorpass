// components/BuildingCard.tsx
// ============================================
// 암호화된 비밀번호 표시 컴포넌트
// ============================================

'use client';

import { useState } from 'react';
import { Eye, EyeOff, Edit2, Save, X } from 'lucide-react';

interface Building {
  id: string;
  building_name: string;
  address: string;
  password: string;  // 복호화된 평문
  password_updated_at?: string;
  distance?: number;
}

export function BuildingCard({
  building,
  onPasswordUpdate,
}: {
  building: Building;
  onPasswordUpdate?: (buildingId: string, newPassword: string) => Promise<void>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPassword, setEditPassword] = useState(building.password);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSavePassword = async () => {
    if (!onPasswordUpdate) return;

    if (editPassword.trim() === '') {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onPasswordUpdate(building.id, editPassword);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || '비밀번호 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditPassword(building.password);
    setIsEditing(false);
    setError(null);
  };

  const formatTime = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('ko-KR');
  };

  return (
    <div className="border border-muted-foreground rounded-lg p-4 mb-3 bg-secondary/50 hover:bg-secondary transition">
      {/* 헤더: 건물명 + 거리 */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-sm">{building.building_name}</h3>
          <p className="text-xs text-muted-foreground">{building.address}</p>
          {building.distance && (
            <p className="text-xs text-muted-foreground mt-1">
              📍 {building.distance.toFixed(1)}m
            </p>
          )}
        </div>
      </div>

      {/* 비밀번호 섹션 */}
      {!isEditing ? (
        <div className="bg-background/80 p-3 rounded mt-3 border border-muted">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-muted-foreground">🔑 비밀번호:</span>
              <span className={`font-mono font-bold ${showPassword ? 'text-base' : 'text-lg'}`}>
                {showPassword ? building.password : '•'.repeat(building.password.length || 4)}
              </span>
            </div>
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 hover:bg-muted rounded transition"
              title={showPassword ? '숨기기' : '보기'}
            >
              {showPassword ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>

          {/* 업데이트 시간 */}
          {building.password_updated_at && (
            <p className="text-xs text-muted-foreground mt-2">
              📅 수정됨: {formatTime(building.password_updated_at)}
            </p>
          )}

          {/* 수정 버튼 */}
          {onPasswordUpdate && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs py-2 rounded hover:bg-primary/90 transition"
            >
              <Edit2 size={14} />
              수정하기
            </button>
          )}
        </div>
      ) : (
        /* 수정 모드 */
        <div className="bg-background/80 p-3 rounded mt-3 border border-muted">
          <input
            type="text"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            className="w-full px-2 py-2 border border-muted-foreground rounded text-sm font-mono bg-input"
            placeholder="새 비밀번호"
            autoFocus
          />

          {error && (
            <p className="text-xs text-destructive mt-2">❌ {error}</p>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSavePassword}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white text-xs py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              <Save size={14} />
              {isSaving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground text-xs py-2 rounded hover:bg-muted/80 transition disabled:opacity-50"
            >
              <X size={14} />
              취소
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            💡 팁: 현장에서 확인한 정확한 비밀번호를 입력해주세요.
          </p>
        </div>
      )}
    </div>
  );
}

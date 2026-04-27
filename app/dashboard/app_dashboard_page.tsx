// app/dashboard/page.tsx
// ============================================
// 지점장 대시보드 - 감시 로그 조회
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Filter, Download, RefreshCw, TrendingUp } from 'lucide-react';

interface AuditLog {
  id: number;
  building_id: number;
  building_name?: string;
  editor_id: string;
  editor_name: string;
  edited_at: string;
  editor_ip: string;
  change_reason?: string;
}

interface Statistics {
  totalChanges: number;
  todayChanges: number;
  topEditor: { name: string; count: number } | null;
  topBuilding: { name: string; count: number } | null;
}

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Statistics>({
    totalChanges: 0,
    todayChanges: 0,
    topEditor: null,
    topBuilding: null,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    days: 7, // 최근 7일
    editorName: '', // 기사명 필터
  });
  const [searchTerm, setSearchTerm] = useState('');

  // 감시 로그 조회
  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      // 기본 쿼리: 최근 감시 로그
      const { data: logsData, error: logsError } = await supabase
        .from('password_edit_history')
        .select(
          `
          *,
          buildings:building_id (building_name, address)
        `
        )
        .order('edited_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // 데이터 정제 및 필터링
      let processedLogs = (logsData || []).map((log: any) => ({
        id: log.id,
        building_id: log.building_id,
        building_name: log.buildings?.building_name || '미확인',
        editor_id: log.editor_id,
        editor_name: log.editor_name || 'Unknown',
        edited_at: log.edited_at,
        editor_ip: log.editor_ip || 'N/A',
        change_reason: log.change_reason,
      }));

      // 필터 적용
      if (filter.editorName) {
        processedLogs = processedLogs.filter((log) =>
          log.editor_name
            .toLowerCase()
            .includes(filter.editorName.toLowerCase())
        );
      }

      if (searchTerm) {
        processedLogs = processedLogs.filter(
          (log) =>
            log.building_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.editor_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setLogs(processedLogs);

      // 통계 계산
      calculateStats(processedLogs);
    } catch (error) {
      console.error('로그 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 통계 계산
  const calculateStats = (data: AuditLog[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 오늘 변경 건수
    const todayChanges = data.filter((log) => {
      const logDate = new Date(log.edited_at);
      const logDay = new Date(
        logDate.getFullYear(),
        logDate.getMonth(),
        logDate.getDate()
      );
      return logDay.getTime() === today.getTime();
    }).length;

    // 기사별 변경 건수 (상위 1명)
    const editorStats: { [key: string]: number } = {};
    data.forEach((log) => {
      editorStats[log.editor_name] = (editorStats[log.editor_name] || 0) + 1;
    });
    const topEditor =
      Object.entries(editorStats).length > 0
        ? {
            name: Object.entries(editorStats).sort(([, a], [, b]) => b - a)[0][0],
            count: Math.max(...Object.values(editorStats)),
          }
        : null;

    // 건물별 변경 건수 (상위 1개)
    const buildingStats: { [key: string]: number } = {};
    data.forEach((log) => {
      buildingStats[log.building_name] =
        (buildingStats[log.building_name] || 0) + 1;
    });
    const topBuilding =
      Object.entries(buildingStats).length > 0
        ? {
            name: Object.entries(buildingStats).sort(([, a], [, b]) => b - a)[0][
              0
            ],
            count: Math.max(...Object.values(buildingStats)),
          }
        : null;

    setStats({
      totalChanges: data.length,
      todayChanges,
      topEditor,
      topBuilding,
    });
  };

  // 초기 로드
  useEffect(() => {
    fetchAuditLogs();
  }, [filter, searchTerm]);

  // 시간 포맷
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // CSV 다운로드
  const downloadCSV = () => {
    const headers = ['날짜', '기사명', '건물명', 'IP주소', '사유'];
    const csvContent = [
      headers.join(','),
      ...logs.map((log) =>
        [
          formatTime(log.edited_at),
          log.editor_name,
          log.building_name,
          log.editor_ip,
          log.change_reason || '-',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `audit_log_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.click();
  };

  return (
    <main className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">📊 지점장 대시보드</h1>
          <p className="text-sm text-muted-foreground mt-2">
            비밀번호 변경 이력 및 통계
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* 총 변경 건수 */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">전체 변경 건수</p>
              <TrendingUp size={16} className="text-blue-500" />
            </div>
            <p className="text-3xl font-bold">{stats.totalChanges}</p>
            <p className="text-xs text-muted-foreground mt-2">누적</p>
          </div>

          {/* 오늘 변경 건수 */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">오늘 변경</p>
              <TrendingUp size={16} className="text-green-500" />
            </div>
            <p className="text-3xl font-bold">{stats.todayChanges}</p>
            <p className="text-xs text-muted-foreground mt-2">건</p>
          </div>

          {/* 상위 기사 */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">상위 기사</p>
              <TrendingUp size={16} className="text-amber-500" />
            </div>
            <p className="text-lg font-bold truncate">
              {stats.topEditor?.name || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.topEditor?.count || 0}회
            </p>
          </div>

          {/* 상위 건물 */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">상위 건물</p>
              <TrendingUp size={16} className="text-red-500" />
            </div>
            <p className="text-lg font-bold truncate">
              {stats.topBuilding?.name || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.topBuilding?.count || 0}회
            </p>
          </div>
        </div>

        {/* 필터 및 컨트롤 */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* 검색 */}
            <input
              type="text"
              placeholder="건물명 또는 기사명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-sm"
            />

            {/* 기사명 필터 */}
            <input
              type="text"
              placeholder="기사명 필터..."
              value={filter.editorName}
              onChange={(e) =>
                setFilter({ ...filter, editorName: e.target.value })
              }
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-sm"
            />

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={fetchAuditLogs}
                className="p-2 hover:bg-muted rounded-lg transition"
                title="새로고침"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={downloadCSV}
                className="p-2 hover:bg-muted rounded-lg transition"
                title="CSV 다운로드"
              >
                <Download size={18} />
              </button>
            </div>
          </div>

          {/* 결과 설명 */}
          <p className="text-xs text-muted-foreground">
            총 {logs.length}개의 변경 기록
          </p>
        </div>

        {/* 감시 로그 테이블 */}
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground">로그를 불러오는 중...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground">변경 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-card border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">날짜</th>
                  <th className="px-4 py-3 text-left font-semibold">기사명</th>
                  <th className="px-4 py-3 text-left font-semibold">건물명</th>
                  <th className="px-4 py-3 text-left font-semibold">IP주소</th>
                  <th className="px-4 py-3 text-left font-semibold">사유</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="px-4 py-3 text-xs font-mono">
                      {formatTime(log.edited_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold">{log.editor_name}</td>
                    <td className="px-4 py-3">{log.building_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {log.editor_ip}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.change_reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 하단 정보 */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border text-xs text-muted-foreground">
          <p>💡 팁: CSV 다운로드로 엑셀에서 데이터를 분석할 수 있습니다.</p>
          <p className="mt-1">
            📊 상위 기사/건물은 가장 많이 변경한 순서입니다. 재교육이 필요할 수 있습니다.
          </p>
        </div>
      </div>
    </main>
  );
}

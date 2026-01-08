'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronRight, History, Search, RotateCcw } from 'lucide-react'

interface ChangeLog {
  log_id: number
  table_name: string
  record_id: number
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_by: string
  changed_at: string
  dept_info: {
    univ_name: string
    dept_name: string
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Filters {
  table_name: string
  action: string
  changed_by: string
  from: string
  to: string
}

const TABLE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'formula_configs', label: '계산공식' },
  { value: 'departments', label: '학과정보' },
  { value: 'practical_score_tables', label: '실기배점' },
]

const ACTION_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'INSERT', label: '추가' },
  { value: 'UPDATE', label: '수정' },
  { value: 'DELETE', label: '삭제' },
]

export default function HistoryPage() {
  const [logs, setLogs] = useState<ChangeLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState<Filters>({
    table_name: 'all',
    action: 'all',
    changed_by: '',
    from: '',
    to: '',
  })
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (filters.table_name !== 'all') params.set('table_name', filters.table_name)
      if (filters.action !== 'all') params.set('action', filters.action)
      if (filters.changed_by) params.set('changed_by', filters.changed_by)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)

      const res = await fetch(`/api/change-logs?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.data)
        setPagination(data.pagination)
      }
    } catch {
      setLogs([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSearch = () => {
    setPage(1)
    fetchLogs()
  }

  const handleReset = () => {
    setFilters({
      table_name: 'all',
      action: 'all',
      changed_by: '',
      from: '',
      to: '',
    })
    setPage(1)
  }

  const toggleRow = (logId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">추가</span>
      case 'UPDATE':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">수정</span>
      case 'DELETE':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">삭제</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">{action}</span>
    }
  }

  const getTableLabel = (tableName: string) => {
    const found = TABLE_OPTIONS.find((t) => t.value === tableName)
    return found ? found.label : tableName
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderDiff = (log: ChangeLog) => {
    const oldValues = log.old_values || {}
    const newValues = log.new_values || {}
    const allKeys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]))

    return (
      <div className="p-4 bg-muted/50 rounded-lg mt-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">이전 값</p>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
              {JSON.stringify(oldValues, null, 2) || '없음'}
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">변경 값</p>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
              {JSON.stringify(newValues, null, 2) || '없음'}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6" />
        <h1 className="text-2xl font-bold">변경 이력</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>테이블</Label>
              <Select
                value={filters.table_name}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, table_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>액션</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>변경자</Label>
              <Input
                placeholder="변경자 검색"
                value={filters.changed_by}
                onChange={(e) => setFilters((prev) => ({ ...prev, changed_by: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="invisible">버튼</Label>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1">
                  <Search className="h-4 w-4 mr-1" />
                  검색
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">변경 이력이 없습니다.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">번호</TableHead>
                    <TableHead>테이블</TableHead>
                    <TableHead className="w-20">액션</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead>변경자</TableHead>
                    <TableHead>변경일시</TableHead>
                    <TableHead className="w-20">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, index) => (
                    <>
                      <TableRow key={log.log_id}>
                        <TableCell className="text-muted-foreground">
                          {pagination ? (pagination.page - 1) * pagination.limit + index + 1 : index + 1}
                        </TableCell>
                        <TableCell>{getTableLabel(log.table_name)}</TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          {log.dept_info ? (
                            <span>
                              {log.dept_info.univ_name} - {log.dept_info.dept_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">ID: {log.record_id}</span>
                          )}
                        </TableCell>
                        <TableCell>{log.changed_by}</TableCell>
                        <TableCell>{formatDate(log.changed_at)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => toggleRow(log.log_id)}>
                            {expandedRows.has(log.log_id) ? '접기' : '보기'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(log.log_id) && (
                        <TableRow key={`${log.log_id}-detail`}>
                          <TableCell colSpan={7}>{renderDiff(log)}</TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!pagination.hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    이전
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasNext}
                  >
                    다음
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'

interface Year {
  year_id: number
  is_active: boolean
}

interface ImportResult {
  success: boolean
  summary: {
    기본정보: { updated: number; inserted: number; deleted?: number }
    특수공식: { updated: number }
    영어등급표: { updated: number; inserted: number }
    한국사등급표: { updated: number; inserted: number }
    실기배점: { updated: number; inserted: number; deleted: number }
  }
  errors: { sheet: string; row: number; field: string; message: string }[]
  dryRun: boolean
  message: string
}

export default function ExcelPage() {
  const [years, setYears] = useState<Year[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function fetchYears() {
      try {
        const res = await fetch('/api/years')
        const data = await res.json()
        setYears(data.years || [])
        const active = data.years?.find((y: Year) => y.is_active)
        if (active) setSelectedYear(String(active.year_id))
      } catch {
        setError('연도 목록을 불러오는데 실패했습니다.')
      }
    }
    fetchYears()
  }, [])

  const handleExport = async () => {
    if (!selectedYear) return
    setExporting(true)
    setError('')
    
    try {
      const res = await fetch(`/api/export/excel?year=${selectedYear}`)
      if (!res.ok) throw new Error('다운로드 실패')
      
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedYear}학년도_정시데이터.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 중 오류 발생')
    } finally {
      setExporting(false)
    }
  }

  const handleUpload = async (dryRun: boolean) => {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !selectedYear) return
    
    setUploading(true)
    setError('')
    setResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('year', selectedYear)
      formData.append('dryRun', String(dryRun))
      
      const user = localStorage.getItem('user')
      if (user) {
        const { username } = JSON.parse(user)
        formData.append('changedBy', username)
      }
      
      const res = await fetch('/api/import/excel', {
        method: 'POST',
        body: formData,
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || '업로드 실패')
      }
      
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류 발생')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">엑셀 관리</h1>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="학년도 선택" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year.year_id} value={String(year.year_id)}>
                {year.year_id}학년도 {year.is_active && '(활성)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export">내보내기</TabsTrigger>
          <TabsTrigger value="import">가져오기</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                데이터 내보내기
              </CardTitle>
              <CardDescription>
                선택한 학년도의 모든 데이터를 엑셀 파일로 다운로드합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">포함되는 시트:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>기본정보_과목비율 - 학과별 기본 설정</li>
                  <li>특수공식 - 특수 계산 공식</li>
                  <li>영어등급표 - 영어 등급별 환산점수</li>
                  <li>한국사등급표 - 한국사 등급별 환산점수</li>
                  <li>실기배점 - 종목별 실기 배점표</li>
                </ul>
              </div>
              <Button onClick={handleExport} disabled={!selectedYear || exporting}>
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    다운로드 중...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    엑셀 다운로드
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                데이터 가져오기
              </CardTitle>
              <CardDescription>
                엑셀 파일을 업로드하여 데이터를 업데이트합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  id="excel-file"
                  onChange={() => setResult(null)}
                />
                <label
                  htmlFor="excel-file"
                  className="cursor-pointer text-primary hover:underline"
                >
                  파일 선택
                </label>
                <span className="text-muted-foreground"> 또는 드래그 앤 드롭</span>
                {fileInputRef.current?.files?.[0] && (
                  <p className="mt-2 text-sm font-medium">
                    선택된 파일: {fileInputRef.current.files[0].name}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleUpload(true)}
                  disabled={!fileInputRef.current?.files?.[0] || uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  검증만 (미리보기)
                </Button>
                <Button
                  onClick={() => handleUpload(false)}
                  disabled={!fileInputRef.current?.files?.[0] || uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  실제 저장
                </Button>
              </div>

              {result && (
                <Alert variant={result.success ? 'default' : 'destructive'}>
                  {result.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    <p className="font-medium mb-2">
                      {result.dryRun ? '[검증 결과]' : '[저장 완료]'} {result.message}
                    </p>
                    <div className="text-sm space-y-1">
                      <p>기본정보: 수정 {result.summary.기본정보.updated}건, 추가 {result.summary.기본정보.inserted}건</p>
                      <p>영어등급표: 수정 {result.summary.영어등급표.updated}건</p>
                      <p>한국사등급표: 수정 {result.summary.한국사등급표.updated}건</p>
                      <p>실기배점: 삭제 {result.summary.실기배점.deleted}건, 추가 {result.summary.실기배점.inserted}건</p>
                    </div>
                    {result.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive">
                        <p className="font-medium">오류 {result.errors.length}건:</p>
                        {result.errors.slice(0, 5).map((err, i) => (
                          <p key={i} className="text-xs">
                            [{err.sheet}] {err.row}행 {err.field}: {err.message}
                          </p>
                        ))}
                        {result.errors.length > 5 && (
                          <p className="text-xs">... 외 {result.errors.length - 5}건</p>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

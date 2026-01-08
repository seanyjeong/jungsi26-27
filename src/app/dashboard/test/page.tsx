'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calculator, CheckCircle } from 'lucide-react'

interface Department {
  dept_id: number
  univ_name: string
  dept_name: string
}

interface SuneungResult {
  success: boolean
  result?: {
    totalScore: number
    breakdown: {
      korean?: number
      math?: number
      english?: number
      inquiry1?: number
      inquiry2?: number
      history?: number
      bonus?: number
    }
  }
  error?: string
}

interface PracticalResult {
  success: boolean
  result?: {
    totalScore: number
    breakdown: Record<string, number>
  }
  error?: string
}

export default function TestPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState('')

  const [suneungDeptId, setSuneungDeptId] = useState('')
  const [suneungScores, setSuneungScores] = useState({
    koreanStd: '',
    koreanPct: '',
    mathStd: '',
    mathPct: '',
    mathType: '미적분',
    englishGrade: '',
    inquiry1Std: '',
    inquiry1Pct: '',
    inquiry1Subject: '',
    inquiry2Std: '',
    inquiry2Pct: '',
    inquiry2Subject: '',
    historyGrade: '',
  })
  const [suneungResult, setSuneungResult] = useState<SuneungResult | null>(null)
  const [suneungCalculating, setSuneungCalculating] = useState(false)

  const [practicalDeptId, setPracticalDeptId] = useState('')
  const [practicalGender, setPracticalGender] = useState('남')
  const [practicalRecords, setPracticalRecords] = useState({
    '100m': '',
    '제자리멀리뛰기': '',
    '메디신볼던지기': '',
  })
  const [practicalResult, setPracticalResult] = useState<PracticalResult | null>(null)
  const [practicalCalculating, setPracticalCalculating] = useState(false)

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await fetch('/api/departments?year=2026')
        const data = await res.json()
        setDepartments(data.departments || [])
      } catch {
        setError('학과 목록을 불러오는데 실패했습니다.')
      }
    }
    fetchDepartments()
  }, [])

  const handleSuneungCalculate = async () => {
    if (!suneungDeptId) {
      setError('학과를 선택해주세요.')
      return
    }

    setSuneungCalculating(true)
    setError('')
    setSuneungResult(null)

    try {
      const res = await fetch('/api/calculate/suneung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: Number(suneungDeptId),
          scores: {
            korean: {
              std: Number(suneungScores.koreanStd) || 0,
              pct: Number(suneungScores.koreanPct) || 0,
            },
            math: {
              std: Number(suneungScores.mathStd) || 0,
              pct: Number(suneungScores.mathPct) || 0,
              type: suneungScores.mathType,
            },
            english: {
              grade: Number(suneungScores.englishGrade) || 0,
            },
            inquiry1: {
              std: Number(suneungScores.inquiry1Std) || 0,
              pct: Number(suneungScores.inquiry1Pct) || 0,
              subject: suneungScores.inquiry1Subject,
            },
            inquiry2: {
              std: Number(suneungScores.inquiry2Std) || 0,
              pct: Number(suneungScores.inquiry2Pct) || 0,
              subject: suneungScores.inquiry2Subject,
            },
            history: {
              grade: Number(suneungScores.historyGrade) || 0,
            },
          },
        }),
      })

      const data = await res.json()
      setSuneungResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산 중 오류 발생')
    } finally {
      setSuneungCalculating(false)
    }
  }

  const handlePracticalCalculate = async () => {
    if (!practicalDeptId) {
      setError('학과를 선택해주세요.')
      return
    }

    setPracticalCalculating(true)
    setError('')
    setPracticalResult(null)

    try {
      const records: Record<string, number> = {}
      Object.entries(practicalRecords).forEach(([key, value]) => {
        if (value) {
          records[key] = Number(value)
        }
      })

      const res = await fetch('/api/calculate/practical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: Number(practicalDeptId),
          gender: practicalGender,
          records,
        }),
      })

      const data = await res.json()
      setPracticalResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산 중 오류 발생')
    } finally {
      setPracticalCalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">점수 계산 테스트</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="suneung">
        <TabsList>
          <TabsTrigger value="suneung">수능 점수 계산</TabsTrigger>
          <TabsTrigger value="practical">실기 점수 계산</TabsTrigger>
        </TabsList>

        <TabsContent value="suneung" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                수능 점수 계산
              </CardTitle>
              <CardDescription>
                학과별 수능 환산점수를 계산합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>학과 선택</Label>
                <Select value={suneungDeptId} onValueChange={setSuneungDeptId}>
                  <SelectTrigger>
                    <SelectValue placeholder="학과를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.dept_id} value={String(dept.dept_id)}>
                        {dept.univ_name} - {dept.dept_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2 p-4 border rounded-lg">
                  <Label className="font-semibold">국어</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">표준점수</Label>
                      <Input
                        type="number"
                        value={suneungScores.koreanStd}
                        onChange={(e) => setSuneungScores({ ...suneungScores, koreanStd: e.target.value })}
                        placeholder="131"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">백분위</Label>
                      <Input
                        type="number"
                        value={suneungScores.koreanPct}
                        onChange={(e) => setSuneungScores({ ...suneungScores, koreanPct: e.target.value })}
                        placeholder="95"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <Label className="font-semibold">수학</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">표준점수</Label>
                      <Input
                        type="number"
                        value={suneungScores.mathStd}
                        onChange={(e) => setSuneungScores({ ...suneungScores, mathStd: e.target.value })}
                        placeholder="140"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">백분위</Label>
                      <Input
                        type="number"
                        value={suneungScores.mathPct}
                        onChange={(e) => setSuneungScores({ ...suneungScores, mathPct: e.target.value })}
                        placeholder="98"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">유형</Label>
                    <Select
                      value={suneungScores.mathType}
                      onValueChange={(value) => setSuneungScores({ ...suneungScores, mathType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="확률과통계">확률과통계</SelectItem>
                        <SelectItem value="미적분">미적분</SelectItem>
                        <SelectItem value="기하">기하</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <Label className="font-semibold">영어</Label>
                  <div>
                    <Label className="text-xs text-muted-foreground">등급</Label>
                    <Select
                      value={suneungScores.englishGrade}
                      onValueChange={(value) => setSuneungScores({ ...suneungScores, englishGrade: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="등급 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => (
                          <SelectItem key={grade} value={String(grade)}>
                            {grade}등급
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <Label className="font-semibold">탐구1</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">표준점수</Label>
                      <Input
                        type="number"
                        value={suneungScores.inquiry1Std}
                        onChange={(e) => setSuneungScores({ ...suneungScores, inquiry1Std: e.target.value })}
                        placeholder="68"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">백분위</Label>
                      <Input
                        type="number"
                        value={suneungScores.inquiry1Pct}
                        onChange={(e) => setSuneungScores({ ...suneungScores, inquiry1Pct: e.target.value })}
                        placeholder="96"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">과목명</Label>
                    <Input
                      value={suneungScores.inquiry1Subject}
                      onChange={(e) => setSuneungScores({ ...suneungScores, inquiry1Subject: e.target.value })}
                      placeholder="생명과학1"
                    />
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <Label className="font-semibold">탐구2</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">표준점수</Label>
                      <Input
                        type="number"
                        value={suneungScores.inquiry2Std}
                        onChange={(e) => setSuneungScores({ ...suneungScores, inquiry2Std: e.target.value })}
                        placeholder="65"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">백분위</Label>
                      <Input
                        type="number"
                        value={suneungScores.inquiry2Pct}
                        onChange={(e) => setSuneungScores({ ...suneungScores, inquiry2Pct: e.target.value })}
                        placeholder="92"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">과목명</Label>
                    <Input
                      value={suneungScores.inquiry2Subject}
                      onChange={(e) => setSuneungScores({ ...suneungScores, inquiry2Subject: e.target.value })}
                      placeholder="지구과학1"
                    />
                  </div>
                </div>

                <div className="space-y-2 p-4 border rounded-lg">
                  <Label className="font-semibold">한국사</Label>
                  <div>
                    <Label className="text-xs text-muted-foreground">등급</Label>
                    <Select
                      value={suneungScores.historyGrade}
                      onValueChange={(value) => setSuneungScores({ ...suneungScores, historyGrade: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="등급 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => (
                          <SelectItem key={grade} value={String(grade)}>
                            {grade}등급
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button onClick={handleSuneungCalculate} disabled={suneungCalculating}>
                {suneungCalculating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    계산 중...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    계산하기
                  </>
                )}
              </Button>

              {suneungResult && (
                <Alert variant={suneungResult.success ? 'default' : 'destructive'}>
                  {suneungResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : null}
                  <AlertDescription>
                    {suneungResult.success && suneungResult.result ? (
                      <div className="space-y-3">
                        <p className="font-semibold text-lg">
                          총점: {suneungResult.result.totalScore.toFixed(2)}점
                        </p>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">과목별 점수:</p>
                          {suneungResult.result.breakdown.korean !== undefined && (
                            <p>국어: {suneungResult.result.breakdown.korean.toFixed(2)}점</p>
                          )}
                          {suneungResult.result.breakdown.math !== undefined && (
                            <p>수학: {suneungResult.result.breakdown.math.toFixed(2)}점</p>
                          )}
                          {suneungResult.result.breakdown.english !== undefined && (
                            <p>영어: {suneungResult.result.breakdown.english.toFixed(2)}점</p>
                          )}
                          {suneungResult.result.breakdown.inquiry1 !== undefined && (
                            <p>탐구1: {suneungResult.result.breakdown.inquiry1.toFixed(2)}점</p>
                          )}
                          {suneungResult.result.breakdown.inquiry2 !== undefined && (
                            <p>탐구2: {suneungResult.result.breakdown.inquiry2.toFixed(2)}점</p>
                          )}
                          {suneungResult.result.breakdown.history !== undefined && (
                            <p>한국사: {suneungResult.result.breakdown.history.toFixed(2)}점</p>
                          )}
                          {suneungResult.result.breakdown.bonus !== undefined && suneungResult.result.breakdown.bonus > 0 && (
                            <p className="text-blue-600 font-medium">가산점: +{suneungResult.result.breakdown.bonus.toFixed(2)}점</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p>{suneungResult.error || '계산 중 오류가 발생했습니다.'}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="practical" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                실기 점수 계산
              </CardTitle>
              <CardDescription>
                학과별 실기 환산점수를 계산합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>학과 선택</Label>
                  <Select value={practicalDeptId} onValueChange={setPracticalDeptId}>
                    <SelectTrigger>
                      <SelectValue placeholder="학과를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.dept_id} value={String(dept.dept_id)}>
                          {dept.univ_name} - {dept.dept_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>성별</Label>
                  <Select value={practicalGender} onValueChange={setPracticalGender}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="남">남</SelectItem>
                      <SelectItem value="여">여</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="font-semibold">실기 종목</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Label>100m (초)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={practicalRecords['100m']}
                      onChange={(e) => setPracticalRecords({ ...practicalRecords, '100m': e.target.value })}
                      placeholder="11.50"
                    />
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg">
                    <Label>제자리멀리뛰기 (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={practicalRecords['제자리멀리뛰기']}
                      onChange={(e) => setPracticalRecords({ ...practicalRecords, '제자리멀리뛰기': e.target.value })}
                      placeholder="2.85"
                    />
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg">
                    <Label>메디신볼던지기 (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={practicalRecords['메디신볼던지기']}
                      onChange={(e) => setPracticalRecords({ ...practicalRecords, '메디신볼던지기': e.target.value })}
                      placeholder="12.50"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handlePracticalCalculate} disabled={practicalCalculating}>
                {practicalCalculating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    계산 중...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    계산하기
                  </>
                )}
              </Button>

              {practicalResult && (
                <Alert variant={practicalResult.success ? 'default' : 'destructive'}>
                  {practicalResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : null}
                  <AlertDescription>
                    {practicalResult.success && practicalResult.result ? (
                      <div className="space-y-3">
                        <p className="font-semibold text-lg">
                          총점: {practicalResult.result.totalScore.toFixed(2)}점
                        </p>
                        <div className="text-sm space-y-1">
                          <p className="font-medium">종목별 점수:</p>
                          {Object.entries(practicalResult.result.breakdown).map(([key, value]) => (
                            <p key={key}>{key}: {value.toFixed(2)}점</p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p>{practicalResult.error || '계산 중 오류가 발생했습니다.'}</p>
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

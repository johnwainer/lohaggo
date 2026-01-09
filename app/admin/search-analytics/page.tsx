
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Search, TrendingUp, Users, Activity } from 'lucide-react'

interface SearchAnalytics {
  summary: {
    totalSearches: number
    uniqueUsers: number
    averageSearchesPerUser: string
    period: string
  }
  topSearches: Array<{ query: string; count: number }>
  searchesByDay: Array<{ date: string; count: number }>
  topUserSearches: Array<{
    userId: string
    userName: string
    userEmail: string
    searchCount: number
  }>
  recentSearches: Array<{
    id: string
    query: string
    userName: string
    userEmail: string
    createdAt: string
  }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D']

export default function SearchAnalyticsPage() {
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/search-analytics?days=${period}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">
          No analytics data available
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Search Analytics</h1>
          <p className="text-muted-foreground">Monitor and analyze user search behavior</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalSearches.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">in {analytics.summary.period}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.uniqueUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">active searchers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per User</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.averageSearchesPerUser}</div>
            <p className="text-xs text-muted-foreground">searches per user</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Search</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{analytics.topSearches[0]?.query || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">{analytics.topSearches[0]?.count || 0} times</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Search Trends</TabsTrigger>
          <TabsTrigger value="top-searches">Top Searches</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="recent">Recent Searches</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Volume Over Time</CardTitle>
              <CardDescription>Daily search activity for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={analytics.searchesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" name="Searches" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-searches" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 20 Search Terms</CardTitle>
                <CardDescription>Most searched terms by frequency</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.topSearches}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="query" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Search Distribution</CardTitle>
                <CardDescription>Top 8 searches by percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={analytics.topSearches.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ query, percent }) => `${query}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.topSearches.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Active Users</CardTitle>
              <CardDescription>Users with the highest search activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.topUserSearches} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="userName" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="searchCount" fill="#82ca9d" name="Searches" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left font-medium">User</th>
                        <th className="p-2 text-left font-medium">Email</th>
                        <th className="p-2 text-right font-medium">Searches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topUserSearches.map((user) => (
                        <tr key={user.userId} className="border-b">
                          <td className="p-2">{user.userName}</td>
                          <td className="p-2 text-muted-foreground">{user.userEmail}</td>
                          <td className="p-2 text-right font-medium">{user.searchCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Search Activity</CardTitle>
              <CardDescription>Latest 50 searches across all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Query</th>
                      <th className="p-2 text-left font-medium">User</th>
                      <th className="p-2 text-left font-medium">Email</th>
                      <th className="p-2 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentSearches.map((search) => (
                      <tr key={search.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{search.query}</td>
                        <td className="p-2">{search.userName}</td>
                        <td className="p-2 text-muted-foreground">{search.userEmail}</td>
                        <td className="p-2 text-right text-sm text-muted-foreground">
                          {new Date(search.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

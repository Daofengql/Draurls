export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">仪表盘</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-gray-500 text-sm">总链接数</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="card">
          <h3 className="text-gray-500 text-sm">总点击数</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="card">
          <h3 className="text-gray-500 text-sm">今日点击</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
      </div>
    </div>
  )
}

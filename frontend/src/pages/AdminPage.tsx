export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">用户管理</h3>
          <p className="text-gray-500">管理用户和用户组</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-4">站点配置</h3>
          <p className="text-gray-500">配置站点信息和选项</p>
        </div>
      </div>
    </div>
  )
}

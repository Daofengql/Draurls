import { useEffect, useState } from 'react'
import { templatesService } from '@/services/admin'
import type { RedirectTemplate } from '@/types'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import { formatDateTime } from '@/utils/format'

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<RedirectTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // 创建/编辑
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RedirectTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    is_default: false,
  })

  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<RedirectTemplate | null>(null)

  // 预览
  const [previewTemplate, setPreviewTemplate] = useState<RedirectTemplate | null>(null)

  const loadTemplates = () => {
    setLoading(true)
    templatesService
      .list()
      .then((data) => setTemplates(data || []))
      .catch((err) => {
        console.error(err)
        toast.error('加载跳转模板失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormData({ name: '', description: '', content: '', is_default: false })
    setShowModal(true)
  }

  const handleEdit = (template: RedirectTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.Name,
      description: template.Description || '',
      content: template.Content,
      is_default: template.IsDefault,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        await templatesService.update(editingTemplate.ID, formData)
        toast.success('模板更新成功')
      } else {
        await templatesService.create(formData)
        toast.success('模板创建成功')
      }
      setShowModal(false)
      loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await templatesService.setDefault(id)
      toast.success('默认模板已设置')
      loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await templatesService.delete(deleteConfirm.ID)
      toast.success('模板已删除')
      setDeleteConfirm(null)
      loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold">跳转模板</h2>
        <button onClick={handleCreate} className="btn btn-primary w-full sm:w-auto">
          创建模板
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">暂无跳转模板</p>
            <button
              onClick={handleCreate}
              className="btn btn-primary"
            >
              创建第一个模板
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template.ID}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">{template.Name}</h3>
                      {template.IsDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          默认
                        </span>
                      )}
                    </div>
                    {template.Description && (
                      <p className="text-sm text-gray-600 mb-3">{template.Description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      创建于 {formatDateTime(template.CreatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:ml-4 flex-shrink-0">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      预览
                    </button>
                    {!template.IsDefault && (
                      <button
                        onClick={() => handleSetDefault(template.ID)}
                        className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-green-600 hover:text-green-800 text-xs sm:text-sm px-2 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(template)}
                      className="text-red-600 hover:text-red-800 text-xs sm:text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? '编辑模板' : '创建模板'}
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            {!editingTemplate && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">设为默认模板</span>
              </label>
            )}
            <div className="flex gap-3 sm:ml-auto">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim() || !formData.content.trim()}
                className="btn btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {editingTemplate ? '保存' : '创建'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模板名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full text-sm"
              placeholder="例如：简单跳转、品牌页面"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full text-sm"
              placeholder="模板用途说明"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模板内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="input w-full font-mono text-xs sm:text-sm"
              rows={12}
              placeholder="输入HTML模板内容，可使用 {{.URL}} 变量表示目标链接"
            />
            <p className="mt-2 text-xs sm:text-sm text-gray-500">
              可用变量: <code className="bg-gray-100 px-1 rounded">{'{{.URL}}'}</code> - 目标链接
            </p>
          </div>
        </div>
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title="模板预览"
        size="lg"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => setPreviewTemplate(null)}
              className="btn btn-primary"
            >
              关闭
            </button>
          </div>
        }
      >
        {previewTemplate && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              预览模板: <strong>{previewTemplate.Name}</strong>
            </p>
            <div className="border border-gray-200 rounded-md bg-gray-50 p-4">
              <iframe
                srcDoc={previewTemplate.Content.replace(/\{\{\.URL\}\}/g, 'https://example.com/target')}
                className="w-full h-80 border-0 rounded bg-white"
                title="模板预览"
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="mt-4 text-xs text-gray-500">
              预览中 &ldquo;{'{{.URL}}'}&rdquo; 变量被替换为示例链接
            </p>
          </div>
        )}
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除模板"
        message={`确定要删除模板 "${deleteConfirm?.Name}" 吗？删除后使用该模板的跳转将使用默认模板。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

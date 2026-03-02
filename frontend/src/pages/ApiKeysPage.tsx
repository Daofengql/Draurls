import { useEffect, useState } from 'react'
import { apiKeysService } from '@/services/apikeys'
import type { APIKey } from '@/types'
import { CopyInput } from '@/components/CopyButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import { toast } from '@/components/Toast'
import Modal from '@/components/Modal'

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)

  const loadApiKeys = () => {
    setLoading(true)
    apiKeysService
      .list()
      .then((data) => {
        console.log('API Keys received:', data)
        setApiKeys(data || [])
      })
      .catch((err) => {
        console.error(err)
        toast.error('加载API密钥失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadApiKeys()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreating(true)
    try {
      const res = await apiKeysService.create({ name: newKeyName })
      setNewKey(res.key)
      setNewKeyName('')
      setShowCreateModal(false)
      toast.success('API密钥创建成功')
    } catch (err: any) {
      toast.error(err.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await apiKeysService.delete(deleteConfirm.id)
      toast.success('API密钥已删除')
      setDeleteConfirm(null)
      loadApiKeys()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      disabled: 'bg-gray-100 text-gray-800',
      expired: 'bg-red-100 text-red-800',
    }
    const labels: Record<string, string> = {
      active: '启用',
      disabled: '禁用',
      expired: '过期',
    }
    const style = styles[status] || 'bg-gray-100 text-gray-800'
    const label = labels[status] || '未知'
    return (
      <span className={'px-2 py-1 rounded text-xs ' + style}>
        {label}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">API密钥</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDocModal(true)}
            className="btn btn-secondary"
          >
            接入文档
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            创建密钥
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-gray-500 text-center py-8">加载中...</p>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-gray-500 mb-4">暂无API密钥</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              创建第一个API密钥
            </button>
          </div>
        ) : (
          <>
            {/* 移动端卡片布局 */}
            <div className="sm:hidden space-y-4">
              {apiKeys.map((keyItem) => (
                <div key={keyItem.ID} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{keyItem.Name}</h3>
                    {getStatusBadge(keyItem.Status)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">密钥</p>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {keyItem.Key ? `${keyItem.Key.slice(0, 8)}...` : 'N/A'}
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">最后使用</p>
                      <p className="text-gray-600">
                        {keyItem.LastUsedAt
                          ? new Date(keyItem.LastUsedAt).toLocaleString('zh-CN')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">创建时间</p>
                      <p className="text-gray-600">
                        {new Date(keyItem.CreatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={() => setDeleteConfirm({ id: keyItem.ID, name: keyItem.Name })}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 桌面端表格布局 */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">名称</th>
                    <th className="text-left py-3 px-4">密钥</th>
                    <th className="text-left py-3 px-4">状态</th>
                    <th className="text-left py-3 px-4">最后使用</th>
                    <th className="text-left py-3 px-4">创建时间</th>
                    <th className="text-right py-3 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((keyItem) => (
                    <tr key={keyItem.ID} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{keyItem.Name}</td>
                      <td className="py-3 px-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {keyItem.Key ? `${keyItem.Key.slice(0, 8)}...` : 'N/A'}
                        </code>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(keyItem.Status)}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {keyItem.LastUsedAt
                          ? new Date(keyItem.LastUsedAt).toLocaleString('zh-CN')
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(keyItem.CreatedAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setDeleteConfirm({ id: keyItem.ID, name: keyItem.Name })}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 创建密钥弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建API密钥"
        size="medium"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              form="create-key-form"
              type="submit"
              disabled={creating || !newKeyName.trim()}
              className="btn btn-primary disabled:bg-gray-300"
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </div>
        }
      >
        <form id="create-key-form" onSubmit={handleCreate}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密钥名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="例如：生产环境、测试环境"
              className="input w-full text-sm"
              autoFocus
            />
            <p className="mt-2 text-sm text-gray-500">
              创建后将显示完��的密钥，请妥善保存。密钥只会显示一次。
            </p>
          </div>
        </form>
      </Modal>

      {/* 新密钥展示 */}
      {newKey && (
        <Modal
          isOpen={!!newKey}
          onClose={() => {
            setNewKey(null)
            loadApiKeys()
          }}
          title="API密钥创建成功"
          footer={
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setNewKey(null)
                  loadApiKeys()
                }}
                className="btn btn-primary"
              >
                我已保存
              </button>
            </div>
          }
        >
          <div>
            <p className="mb-4 text-gray-600">
              请立即复制并保存您的API密钥。出于安全考虑，它只会显示这一次。
            </p>
            <CopyInput value={newKey} />
            <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
              警告：请勿将API密钥泄露给他人，或提交到公开的代码仓库中。
            </p>
          </div>
        </Modal>
      )}

      {/* API接入文档 */}
      <ApiDocModal isOpen={showDocModal} onClose={() => setShowDocModal(false)} />

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="删除API密钥"
        message={`确定要删除API密钥 "${deleteConfirm?.name}" 吗？此操作不可撤销。`}
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

// API文档组件 - 分离出来避免模板字符串嵌套问题
function ApiDocModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="API接入文档"
      size="large"
      footer={
        <div className="flex justify-end">
          <button onClick={onClose} className="btn btn-primary">
            关闭
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto text-sm">
        {/* 基本信息 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">1</span>
            基本信息
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p><strong>API端点：</strong><code className="bg-gray-200 px-2 py-1 rounded">POST /api/v1/shorten</code></p>
            <p><strong>Content-Type：</strong><code className="bg-gray-200 px-2 py-1 rounded">application/json</code></p>
            <p><strong>签名算法：</strong>HMAC-SHA256</p>
          </div>
        </section>

        {/* 请求头 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">2</span>
            请求头
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left">参数名</th>
                  <th className="border px-3 py-2 text-left">类型</th>
                  <th className="border px-3 py-2 text-left">必填</th>
                  <th className="border px-3 py-2 text-left">说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-3 py-2"><code className="text-red-600">X-API-Key</code></td>
                  <td className="border px-3 py-2">string</td>
                  <td className="border px-3 py-2">是</td>
                  <td className="border px-3 py-2">你的API密钥（Key）</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2"><code className="text-red-600">X-Signature</code></td>
                  <td className="border px-3 py-2">string</td>
                  <td className="border px-3 py-2">是</td>
                  <td className="border px-3 py-2">请求签名（HMAC-SHA256）</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2"><code className="text-red-600">X-Timestamp</code></td>
                  <td className="border px-3 py-2">int64</td>
                  <td className="border px-3 py-2">是</td>
                  <td className="border px-3 py-2">当前Unix时间戳（秒），5分钟内有效</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2"><code className="text-red-600">X-Nonce</code></td>
                  <td className="border px-3 py-2">string</td>
                  <td className="border px-3 py-2">是</td>
                  <td className="border px-3 py-2">随机字符串（防重放攻击）</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 请求体 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">3</span>
            请求体示例
          </h3>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
            {'{\n  "url": "https://www.example.com",\n  "code": "custom123",  // 可选，自定义短码\n  "title": "示例标题",    // 可选\n  "expires_at": "2025-12-31T23:59:59Z"  // 可选，过期时间\n}'}
          </pre>
        </section>

        {/* 签名计算 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">4</span>
            签名计算
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="mb-3"><strong>签名字符串拼接规则：</strong></p>
            <code className="bg-white px-3 py-2 rounded block mb-3">
              signatureString = timestamp + nonce + requestBody + requestPath + requestMethod
            </code>
            <p className="mb-3"><strong>计算签名：</strong></p>
            <code className="bg-white px-3 py-2 rounded block">
              signature = HMAC-SHA256(apiSecret, signatureString).toLowerCase()
            </code>
            <p className="text-xs text-gray-600 mt-3">
              注意：requestBody 是JSON字符串，不包含空格和换行
            </p>
          </div>
        </section>

        {/* 代码示例 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">5</span>
            代码示例
          </h3>

          <div className="space-y-4">
            {/* cURL */}
            <div>
              <h4 className="font-medium mb-2">cURL</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {'#!/bin/bash\n\nAPI_KEY="your_api_key_here"\nAPI_SECRET="your_api_secret_here"\nTIMESTAMP=$(date +%s)\nNONCE=$(uuidgen | tr -d \'-\')\nREQUEST_BODY=\'{"url":"https://www.example.com"}\'\nREQUEST_PATH="/api/v1/shorten"\nMETHOD="POST"\n\n# 构建签名字符串\nSIGN_STRING="$TIMESTAMP$NONCE$REQUEST_BODY$REQUEST_PATH$METHOD"\n\n# 计算签名\nSIGNATURE=$(echo -n "$SIGN_STRING" | openssl dgst -sha256 -hmac "$API_SECRET" -hex | awk \'{print $2}\')\n\n# 发送请求\ncurl -X POST "http://localhost:8080/api/v1/shorten" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: $API_KEY" \\\n  -H "X-Signature: $SIGNATURE" \\\n  -H "X-Timestamp: $TIMESTAMP" \\\n  -H "X-Nonce: $NONCE" \\\n  -d "$REQUEST_BODY"'}
              </pre>
            </div>

            {/* JavaScript */}
            <div>
              <h4 className="font-medium mb-2">JavaScript (Node.js)</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {"const crypto = require('crypto');\n\nconst API_KEY = 'your_api_key_here';\nconst API_SECRET = 'your_api_secret_here';\nconst API_URL = 'http://localhost:8080/api/v1/shorten';\n\nfunction createShortLink(url) {\n  const timestamp = Math.floor(Date.now() / 1000);\n  const nonce = crypto.randomUUID();\n  const requestBody = JSON.stringify({ url });\n  const requestPath = '/api/v1/shorten';\n  const method = 'POST';\n\n  // 构建签名字符串\n  const signString = timestamp + nonce + requestBody + requestPath + method;\n\n  // 计算签名\n  const signature = crypto\n    .createHmac('sha256', API_SECRET)\n    .update(signString)\n    .digest('hex');\n\n  // 发送请求\n  return fetch(API_URL, {\n    method: 'POST',\n    headers: {\n      'Content-Type': 'application/json',\n      'X-API-Key': API_KEY,\n      'X-Signature': signature,\n      'X-Timestamp': timestamp.toString(),\n      'X-Nonce': nonce,\n    },\n    body: requestBody,\n  }).then(res => res.json());\n}\n\n// 使用示例\ncreateShortLink('https://www.example.com')\n  .then(data => console.log(data))\n  .catch(err => console.error(err));"}
              </pre>
            </div>

            {/* Python */}
            <div>
              <h4 className="font-medium mb-2">Python</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {"import hmac\nimport hashlib\nimport time\nimport uuid\nimport json\nimport requests\n\nAPI_KEY = 'your_api_key_here'\nAPI_SECRET = 'your_api_secret_here'\nAPI_URL = 'http://localhost:8080/api/v1/shorten'\n\ndef create_short_link(url):\n    timestamp = str(int(time.time()))\n    nonce_val = str(uuid.uuid4())\n    request_body = json.dumps({'url': url})\n    request_path = '/api/v1/shorten'\n    method = 'POST'\n\n    # 构建签名字符串\n    sign_string = timestamp + nonce_val + request_body + request_path + method\n\n    # 计算签名\n    signature = hmac.new(\n        API_SECRET.encode(),\n        sign_string.encode(),\n        hashlib.sha256\n    ).hexdigest()\n\n    # 发送请求\n    response = requests.post(\n        API_URL,\n        headers={\n            'Content-Type': 'application/json',\n            'X-API-Key': API_KEY,\n            'X-Signature': signature,\n            'X-Timestamp': timestamp,\n            'X-Nonce': nonce_val,\n        },\n        data=request_body\n    )\n    return response.json()\n\n# 使用示例\nresult = create_short_link('https://www.example.com')\nprint(result)"}
              </pre>
            </div>

            {/* PHP */}
            <div>
              <h4 className="font-medium mb-2">PHP</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {"<?php\nclass ShortLinkAPI {\n    private $apiKey;\n    private $apiSecret;\n    private $apiUrl = 'http://localhost:8080/api/v1/shorten';\n\n    public function __construct($apiKey, $apiSecret) {\n        $this->apiKey = $apiKey;\n        $this->apiSecret = $apiSecret;\n    }\n\n    public function createShortLink($url) {\n        $timestamp = (string)time();\n        $nonce = bin2hex(random_bytes(16));\n        $requestBody = json_encode(['url' => $url]);\n        $requestPath = '/api/v1/shorten';\n        $method = 'POST';\n\n        // 构建签名字符串\n        $signString = $timestamp . $nonce . $requestBody . $requestPath . $method;\n\n        // 计算签名\n        $signature = hash_hmac('sha256', $signString, $this->apiSecret);\n\n        // 发送请求\n        $ch = curl_init($this->apiUrl);\n        curl_setopt_array($ch, [\n            CURLOPT_RETURNTRANSFER => true,\n            CURLOPT_POST => true,\n            CURLOPT_HTTPHEADER => [\n                'Content-Type: application/json',\n                'X-API-Key: ' . $this->apiKey,\n                'X-Signature: ' . $signature,\n                'X-Timestamp: ' . $timestamp,\n                'X-Nonce: ' . $nonce,\n            ],\n            CURLOPT_POSTFIELDS => $requestBody,\n        ]);\n\n        $response = curl_exec($ch);\n        curl_close($ch);\n\n        return json_decode($response, true);\n    }\n}\n\n$api = new ShortLinkAPI('your_api_key', 'your_api_secret');\n$result = $api->createShortLink('https://www.example.com');\nprint_r($result);\n?>"}
              </pre>
            </div>

            {/* Go */}
            <div>
              <h4 className="font-medium mb-2">Go</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                {"package main\n\nimport (\n    \"bytes\"\n    \"crypto/hmac\"\n    \"crypto/rand\"\n    \"crypto/sha256\"\n    \"encoding/hex\"\n    \"encoding/json\"\n    \"fmt\"\n    \"io\"\n    \"net/http\"\n    \"strconv\"\n    \"time\"\n)\n\ntype ShortLinkClient struct {\n    APIKey    string\n    APISecret string\n    BaseURL   string\n}\n\ntype CreateLinkRequest struct {\n    URL string `json:\"url\"`\n}\n\nfunc (c *ShortLinkClient) CreateShortLink(url string) (map[string]interface{}, error) {\n    timestamp := strconv.FormatInt(time.Now().Unix(), 10)\n    nonce := generateNonce()\n\n    reqBody, _ := json.Marshal(CreateLinkRequest{URL: url})\n    requestBody := string(reqBody)\n    requestPath := \"/api/v1/shorten\"\n    method := \"POST\"\n\n    // 构建签名字符串\n    signString := timestamp + nonce + requestBody + requestPath + method\n\n    // 计算签名\n    h := hmac.New(sha256.New, []byte(c.APISecret))\n    h.Write([]byte(signString))\n    signature := hex.EncodeToString(h.Sum(nil))\n\n    // 发送请求\n    req, _ := http.NewRequest(\"POST\", c.BaseURL, bytes.NewReader(reqBody))\n    req.Header.Set(\"Content-Type\", \"application/json\")\n    req.Header.Set(\"X-API-Key\", c.APIKey)\n    req.Header.Set(\"X-Signature\", signature)\n    req.Header.Set(\"X-Timestamp\", timestamp)\n    req.Header.Set(\"X-Nonce\", nonce)\n\n    client := &http.Client{}\n    resp, err := client.Do(req)\n    if err != nil {\n        return nil, err\n    }\n    defer resp.Body.Close()\n\n    body, _ := io.ReadAll(resp.Body)\n    var result map[string]interface{}\n    json.Unmarshal(body, &result)\n    return result, nil\n}\n\nfunc generateNonce() string {\n    b := make([]byte, 16)\n    rand.Read(b)\n    return hex.EncodeToString(b)\n}\n\nfunc main() {\n    client := ShortLinkClient{\n        APIKey:    \"your_api_key\",\n        APISecret: \"your_api_secret\",\n        BaseURL:   \"http://localhost:8080/api/v1/shorten\",\n    }\n\n    result, err := client.CreateShortLink(\"https://www.example.com\")\n    if err != nil {\n        fmt.Println(\"Error:\", err)\n        return\n    }\n    fmt.Println(result)\n}"}
              </pre>
            </div>
          </div>
        </section>

        {/* 返回结果 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">6</span>
            返回结果
          </h3>
          <div className="space-y-3">
            <div>
              <p className="font-medium mb-2">成功响应</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                {'{\n  "code": 0,\n  "message": "success",\n  "data": {\n    "id": 1,\n    "code": "aBc123",\n    "short_url": "http://localhost:8080/aBc123",\n    "original_url": "https://www.example.com"\n  }\n}'}
              </pre>
            </div>
            <div>
              <p className="font-medium mb-2">失败响应</p>
              <pre className="bg-gray-900 text-red-400 p-4 rounded-lg overflow-x-auto">
                {'{\n  "code": 401,\n  "message": "signature verification failed"\n}'}
              </pre>
            </div>
          </div>
        </section>

        {/* 注意事项 */}
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm">!</span>
            注意事项
          </h3>
          <ul className="text-gray-700 space-y-2 list-disc list-inside bg-yellow-50 p-4 rounded-lg">
            <li>API密钥和密钥Secret具有同等重要性，请妥善保管</li>
            <li>时间戳误差不能超过5分钟，否则会被拒绝</li>
            <li>Nonce建议使用UUID，确保每次请求唯一</li>
            <li>签名结果需要转换为小写十六进制字符串</li>
            <li>请求体必须是严格的JSON格式，不含多余空格</li>
            <li>建议在生产环境中使用HTTPS协议</li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}

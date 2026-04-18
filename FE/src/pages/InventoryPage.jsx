/* eslint-disable */
import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Space,
  Popconfirm,
  message,
  Typography,
  Card,
  Switch,
  Tooltip,
  Badge,
  Divider,
  Row,
  Col,
  Statistic,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  AppstoreOutlined,
  InboxOutlined,
  DollarOutlined,
  WarningOutlined,
  MinusOutlined,
} from '@ant-design/icons'
import { inventoryApi } from '../services/api'

const { Title, Text } = Typography

const CATEGORY_OPTIONS = [
  { value: 'mon_kho', label: 'Món khô' },
  { value: 'do_nuoc', label: 'Món nước' },
  { value: 'do_uong', label: 'Đồ uống' },
  { value: 'trang_mieng', label: 'Tráng miệng' },
]

const CATEGORY_COLORS = {
  mon_kho: 'volcano',
  do_nuoc: 'blue',
  do_uong: 'cyan',
  trang_mieng: 'magenta',
}

const CATEGORY_LABELS = {
  mon_kho: 'Món khô',
  do_nuoc: 'Món nước',
  do_uong: 'Đồ uống',
  trang_mieng: 'Tráng miệng',
}

function InventoryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filteredInfo, setFilteredInfo] = useState({})
  const [sortedInfo, setSortedInfo] = useState({})

  // Modal thêm/sửa
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // Watch form values to detect changes
  const formValues = Form.useWatch([], form)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (!editingItem) {
      setHasChanges(true) // Always allow in Add mode
      return
    }
    
    // Compare current form values with editingItem
    const isChanged = 
      formValues?.name !== editingItem.name ||
      formValues?.category !== editingItem.category ||
      formValues?.price !== editingItem.price ||
      formValues?.quantity !== editingItem.quantity ||
      formValues?.available !== editingItem.available ||
      formValues?.description !== (editingItem.description || '') ||
      formValues?.imageUrl !== (editingItem.imageUrl || '')
    
    setHasChanges(isChanged)
  }, [formValues, editingItem])

  // Modal điều chỉnh số lượng
  const [quantityModalOpen, setQuantityModalOpen] = useState(false)
  const [quantityItem, setQuantityItem] = useState(null)
  const [quantityDelta, setQuantityDelta] = useState(0)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await inventoryApi.getAll()
      setItems(res.data)
    } catch (err) {
      message.error('Không thể tải danh sách kho hàng')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    setSearchText('')
    setFilterCategory('all')
    setFilteredInfo({})
    setSortedInfo({})
    fetchItems()
  }

  const handleChange = (pagination, filters, sorter) => {
    setFilteredInfo(filters)
    setSortedInfo(sorter)
  }

  useEffect(() => {
    fetchItems()
  }, [])

  // --- Thống kê ---
  const totalItems = items.length
  const totalAvailable = items.filter((i) => i.available).length
  const lowStockItems = items.filter((i) => i.quantity !== null && i.quantity <= 10).length
  const totalValue = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0)

  // --- Lọc & Tìm kiếm ---
  const filteredItems = items.filter((item) => {
    const matchSearch =
      !searchText ||
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchText.toLowerCase())
    const matchCategory = filterCategory === 'all' || item.category === filterCategory
    return matchSearch && matchCategory
  })

  // --- Mở modal thêm ---
  const handleOpenAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ available: true, quantity: 0 })
    setModalOpen(true)
  }

  // --- Mở modal sửa ---
  const handleOpenEdit = (record) => {
    setEditingItem(record)
    form.setFieldsValue({
      name: record.name,
      category: record.category,
      description: record.description,
      price: record.price,
      quantity: record.quantity,
      available: record.available,
      imageUrl: record.imageUrl,
    })
    setModalOpen(true)
  }

  // --- Submit thêm/sửa ---
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (editingItem) {
        await inventoryApi.update(editingItem.id, values)
        message.success(`Đã cập nhật "${values.name}"`)
      } else {
        // API nhận mảng
        await inventoryApi.create([values])
        message.success(`Đã thêm "${values.name}" vào kho`)
      }

      setModalOpen(false)
      form.resetFields()
      setEditingItem(null)
      fetchItems()
    } catch (err) {
      if (err.errorFields) return // validation error
      message.error('Thao tác thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Xóa ---
  const handleDelete = async (id, name) => {
    try {
      await inventoryApi.delete(id)
      message.success(`Đã xóa "${name}"`)
      fetchItems()
    } catch {
      message.error('Xóa thất bại')
    }
  }

  // --- Mở modal điều chỉnh số lượng ---
  const handleOpenQuantity = (record) => {
    setQuantityItem(record)
    setQuantityDelta(0)
    setQuantityModalOpen(true)
  }

  // --- Submit điều chỉnh số lượng ---
  const handleQuantitySubmit = async () => {
    if (quantityDelta === 0) {
      message.warning('Số lượng điều chỉnh phải khác 0')
      return
    }
    try {
      await inventoryApi.updateQuantity(quantityItem.id, quantityDelta)
      message.success(
        `Đã ${quantityDelta > 0 ? 'nhập thêm' : 'trừ'} ${Math.abs(quantityDelta)} phần "${quantityItem.name}"`
      )
      setQuantityModalOpen(false)
      fetchItems()
    } catch {
      message.error('Điều chỉnh số lượng thất bại')
    }
  }

  // --- Cột bảng ---
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
      sortOrder: sortedInfo.columnKey === 'id' && sortedInfo.order,
    },
    {
      title: 'Tên món',
      dataIndex: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      sortOrder: sortedInfo.columnKey === 'name' && sortedInfo.order,
      render: (name, record) => (
        <Space>
          <Text strong>{name}</Text>
          {record.quantity !== null && record.quantity <= 10 && (
            <Tooltip title="Sắp hết hàng!">
              <WarningOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Danh mục',
      dataIndex: 'category',
      width: 130,
      filters: CATEGORY_OPTIONS.map((c) => ({ text: c.label, value: c.value })),
      onFilter: (value, record) => record.category === value,
      filteredValue: filteredInfo.category || null,
      render: (cat) => (
        <Tag color={CATEGORY_COLORS[cat] || 'default'}>
          {CATEGORY_LABELS[cat] || cat}
        </Tag>
      ),
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      width: 120,
      align: 'right',
      sorter: (a, b) => (a.price || 0) - (b.price || 0),
      sortOrder: sortedInfo.columnKey === 'price' && sortedInfo.order,
      render: (price) => (
        <Text style={{ color: '#000000ff' }}>
          {(price || 0).toLocaleString('vi-VN')} đ
        </Text>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      width: 110,
      align: 'center',
      sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0),
      sortOrder: sortedInfo.columnKey === 'quantity' && sortedInfo.order,
      render: (qty) => {
        let color = '#4c8131ff'
        if (qty <= 0) color = '#ff4d4f'
        else if (qty <= 10) color = '#faad14'
        return (
          <Badge
            count={qty}
            showZero
            overflowCount={9999}
            style={{
              backgroundColor: color,
              fontSize: 13,
              padding: '0 10px',
            }}
          />
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'available',
      width: 110,
      align: 'center',
      filters: [
        { text: 'Đang bán', value: true },
        { text: 'Ngưng bán', value: false },
      ],
      onFilter: (value, record) => record.available === value,
      filteredValue: filteredInfo.available || null,
      render: (available) =>
        available ? (
          <Tag color="success">Đang bán</Tag>
        ) : (
          <Tag color="error">Ngưng bán</Tag>
        ),
    },
    {
      title: 'Thao tác',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Điều chỉnh số lượng">
            <Button
              size="small"
              icon={<InboxOutlined />}
              onClick={() => handleOpenQuantity(record)}
            >
              Nhập/Xuất
            </Button>
          </Tooltip>
          <Tooltip title="Sửa thông tin">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={`Xóa "${record.name}"?`}
            description="Hành động này không thể hoàn tác!"
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      {/* --- Thống kê tổng quan --- */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable style={{ borderRadius: 2 }}>
            <Statistic
              title="Tổng món"
              value={totalItems}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable style={{ borderRadius: 2 }}>
            <Statistic
              title="Đang bán"
              value={totalAvailable}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable style={{ borderRadius: 2 }}>
            <Statistic
              title="Sắp hết"
              value={lowStockItems}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable style={{ borderRadius: 2 }}>
            <Statistic
              title="Tổng giá trị kho"
              value={totalValue}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
              formatter={(val) => `${Number(val).toLocaleString('vi-VN')} đ`}
            />
          </Card>
        </Col>
      </Row>

      {/* --- Bảng chính --- */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            <InboxOutlined style={{ marginRight: 8 }} />
            Danh sách các món
          </Title>
          <Space wrap>
            <Input
              placeholder="Tìm kiếm món..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
            <Select
              value={filterCategory}
              onChange={setFilterCategory}
              style={{ width: 150 }}
              options={[
                { value: 'all', label: 'Tất cả danh mục' },
                ...CATEGORY_OPTIONS,
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              Làm mới
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
              Thêm món
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          onChange={handleChange}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} món` }}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có món ăn nào trong kho"
              />
            ),
          }}
        />
      </Card>

      {/* --- Modal Thêm / Sửa --- */}
      <Modal
        title={editingItem ? `Sửa: ${editingItem.name}` : 'Thêm món mới'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
          setEditingItem(null)
        }}
        okText={editingItem ? 'Cập nhật' : 'Thêm'}
        okButtonProps={{ disabled: editingItem && !hasChanges }}
        cancelText="Hủy"
        width={550}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên món"
            rules={[{ required: true, message: 'Vui lòng nhập tên món!' }]}
          >
            <Input placeholder="VD: Phở bò tái" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Danh mục"
                rules={[{ required: true, message: 'Vui lòng chọn danh mục!' }]}
              >
                <Select placeholder="Chọn danh mục" options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Giá (VNĐ)"
                rules={[{ required: true, message: 'Vui lòng nhập giá!' }]}
              >
                <InputNumber
                  min={0}
                  step={1000}
                  style={{ width: '100%' }}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val.replace(/,/g, '')}
                  placeholder="VD: 45000"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="Số lượng ban đầu"
                rules={[{ required: true, message: 'Vui lòng nhập số lượng!' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="VD: 50" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="available" label="Trạng thái" valuePropName="checked">
                <Switch checkedChildren="Đang bán" unCheckedChildren="Ngưng bán" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về món ăn..." />
          </Form.Item>

          <Form.Item name="imageUrl" label="URL Hình ảnh">
            <Input placeholder="https://example.com/image.jpg" />
          </Form.Item>
        </Form>
      </Modal>

      {/* --- Modal Điều chỉnh Số lượng --- */}
      <Modal
        title={
          <Space>
            <InboxOutlined />
            <span>Nhập / Xuất kho: {quantityItem?.name}</span>
          </Space>
        }
        open={quantityModalOpen}
        onOk={handleQuantitySubmit}
        onCancel={() => setQuantityModalOpen(false)}
        okText="Xác nhận"
        cancelText="Hủy"
        width={420}
      >
        {quantityItem && (
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 16,
                padding: '12px 16px',
                background: '#fafafa',
                borderRadius: 2,
              }}
            >
              <Text>Số lượng hiện tại:</Text>
              <Text strong style={{ fontSize: 16 }}>
                {quantityItem.quantity}
              </Text>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ display: 'block', marginBottom: 8 }}>
                Số lượng điều chỉnh{' '}
                <Text type="secondary">(số dương = nhập thêm, số âm = xuất kho)</Text>:
              </Text>
              <InputNumber
                value={quantityDelta}
                onChange={(val) => setQuantityDelta(val || 0)}
                style={{ width: '100%' }}
                placeholder="VD: 10 hoặc -5"
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: quantityDelta >= 0 ? '#f6ffed' : '#fff2f0',
                borderRadius: 2,
                border: `1px solid ${quantityDelta >= 0 ? '#b7eb8f' : '#ffccc7'}`,
              }}
            >
              <Text>Số lượng sau điều chỉnh:</Text>
              <Text
                strong
                type={quantityItem.quantity + quantityDelta < 0 ? 'danger' : 'success'}
                style={{ fontSize: 16 }}
              >
                {quantityItem.quantity + quantityDelta}
              </Text>
            </div>

            {quantityItem.quantity + quantityDelta < 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="danger">
                  <WarningOutlined /> Số lượng sau điều chỉnh không thể âm!
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default InventoryPage

/* eslint-disable */
import { useEffect, useState, useMemo } from 'react'
import {
  Button,
  Modal,
  Form,
  Select,
  Tag,
  Space,
  Popconfirm,
  message,
  Typography,
  Card,
  List,
  Divider,
  Radio,
  Spin,
  Row,
  Col,
  Empty,
  Badge,
  Tooltip,
  Steps
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  MinusOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TableOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons'
import { orderApi, inventoryApi, tableApi } from '../services/api'

const { Title, Text } = Typography

import CreateOrderModal from '../components/CreateOrderModal'
import InvoiceModal from '../components/InvoiceModal'

const STATUS_CONFIG = {
  PENDING: { color: 'processing', label: 'Đang phục vụ', icon: <ClockCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} /> },
  AWAITING_PAYMENT: { color: 'warning', label: 'Chờ thanh toán', icon: <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} /> },
  COMPLETED: { color: 'success', label: 'Đã thanh toán', icon: <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} /> },
  CANCELLED: { color: 'error', label: 'Đã hủy', icon: <CloseCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} /> },
}

const ZONE_LABELS = {
  Indoor: 'Trong nhà',
  Outdoor: 'Ngoài trời',
  Private: 'Phòng VIP',
  Terrace: 'Ban công',
}

const ZONE_COLORS = {
  Indoor: '#1890ff',
  Outdoor: '#52c41a',
  Private: '#722ed1',
  Terrace: '#fa8c16',
}

const CATEGORY_LABELS = {
  Couple: 'Đôi (2 người)',
  Standard: 'Tiêu chuẩn',
  Family: 'Gia đình',
  VIP: 'VIP',
}

function OrderPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  // States cho Modal Tạo Đơn
  const [modalOpen, setModalOpen] = useState(false)

  // States cho Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [currentInvoiceOrder, setCurrentInvoiceOrder] = useState(null)

  // States cho danh sách bàn (tất cả bàn - dùng cho floor plan)
  const [allTables, setAllTables] = useState([])
  const [allTablesLoading, setAllTablesLoading] = useState(false)

  // States cho Modal Xem Chi Tiết
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderDetails, setOrderDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const fetchOrders = async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await orderApi.getAll()
      setOrders(res.data)
    } catch (err) {
      if (!quiet) message.error('Không thể tải danh sách đơn hàng')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  const fetchAllTables = async () => {
    setAllTablesLoading(true)
    try {
      const res = await tableApi.getAll()
      setAllTables(res.data)
    } catch (err) {
      message.error('Không thể tải danh sách bàn')
    } finally {
      setAllTablesLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    fetchAllTables()
    
    // Auto polling for SePAY webhook updates
    const interval = setInterval(() => {
        fetchOrders(true)
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const handleCreateOrderSuccess = () => {
    setModalOpen(false)
    fetchOrders()
    fetchAllTables()
  }

  // handleCreate is now inside CreateOrderModal

  const handleUpdateStatus = async (id, status) => {
    try {
      await orderApi.update(id, { status })

      if (status === 'COMPLETED' || status === 'CANCELLED') {
        const order = orders.find(o => o.id === id)
        if (order && order.tableId) {
          try {
            const matchedTable = allTables.find(t => t.tableName === order.tableId)
            if (matchedTable) {
              await tableApi.updateStatus(matchedTable.id, true)
            }
          } catch (e) {
            console.warn('Không thể trả bàn:', e)
          }
        }
      }

      message.success('Cập nhật trạng thái thành công')
      fetchOrders()
      fetchAllTables()
    } catch {
      message.error('Cập nhật thất bại')
    }
  }

  const handleDelete = async (order) => {
    try {
      await orderApi.delete(order.id)
      
      // Tự động trả bàn khi xóa đơn
      if (order.tableId) {
        const matchedTable = allTables.find(t => t.tableName === order.tableId)
        if (matchedTable) {
          try {
            await tableApi.updateStatus(matchedTable.id, true)
          } catch (e) {
            console.warn('Không thể trả bàn khi xóa đơn:', e)
          }
        }
      }

      message.success('Xóa đơn hàng và giải phóng bàn thành công')
      fetchOrders()
      fetchAllTables()
    } catch {
      message.error('Xóa thất bại')
    }
  }

  const handleViewDetails = async (order) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await orderApi.getById(order.id);
      setOrderDetails(res.data);
    } catch (err) {
      message.error('Không thể tải chi tiết đơn hàng');
    } finally {
      setDetailsLoading(false);
    }
  }

  const calculateFinalPrice = () => {
    if (!orderDetails || !orderDetails.items) return 0;
    return orderDetails.items.reduce((total, item) => {
      return total + (item.quantity * (item.unitPrice || 0));
    }, 0);
  }

  // --- Nhóm bàn theo zone cho floor plan ---
  const tablesByZone = useMemo(() => {
    const grouped = {}
    allTables.forEach(t => {
      if (!grouped[t.zone]) grouped[t.zone] = []
      grouped[t.zone].push(t)
    })
    return grouped
  }, [allTables])

  // --- RENDER TABLE CELL (dùng chung cho floor plan và modal mini map) ---
  const renderTableCell = (table, isClickable = false, isSelected = false) => {
    const isAvailable = table.available
    const bgColor = isSelected ? '#1890ff'
      : isAvailable ? (ZONE_COLORS[table.zone] || '#1890ff')
        : '#d9d9d9'

    return (
      <Tooltip
        key={table.id}
        title={
          <div>
            <div><strong>{table.tableName}</strong></div>
            <div>{table.capacity} chỗ — {CATEGORY_LABELS[table.category] || table.category}</div>
            <div>{table.description}</div>
            <div>{isAvailable ? '🟢 Còn trống' : '🔴 Đang sử dụng'}</div>
          </div>
        }
      >
        <div
          style={{
            width: 64,
            height: 52,
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 4,
            border: isSelected ? '2px solid #1890ff' : '1px solid #e8e8e8',
            borderRadius: 2,
            backgroundColor: isAvailable ? (isSelected ? '#e6f7ff' : '#fff') : '#f5f5f5',
            opacity: isAvailable ? 1 : 0.4,
            cursor: isClickable && isAvailable ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            boxShadow: isSelected ? '0 0 0 2px rgba(24,144,255,0.2)' : 'none',
          }}
        >
          <TableOutlined style={{ fontSize: 16, color: isAvailable ? bgColor : '#bfbfbf', marginBottom: 2 }} />
          <Text style={{ fontSize: 10, color: isAvailable ? '#333' : '#bfbfbf', lineHeight: 1 }}>{table.tableName}</Text>
          <Text style={{ fontSize: 9, color: isAvailable ? '#888' : '#bfbfbf', lineHeight: 1 }}>{table.capacity}p</Text>
        </div>
      </Tooltip>
    )
  }

  // --- RENDER FLOOR PLAN (phía trên Kanban board) ---
  const renderFloorPlan = () => {
    if (allTablesLoading) return <Spin />
    if (allTables.length === 0) return null

    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <EnvironmentOutlined style={{ fontSize: 20, marginRight: 8, color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0, marginRight: 16 }}>Danh sách bàn</Title>
            <Space>
              <Tag color="green" style={{ borderRadius: 2 }}>{allTables.filter(t => t.available).length} trống</Tag>
              <Tag color="red" style={{ borderRadius: 2 }}>{allTables.filter(t => !t.available).length} đang dùng</Tag>
            </Space>
          </div>
          {/* <Button size="small" icon={<ReloadOutlined />} onClick={fetchAllTables}>Cập nhật</Button> */}
        </div>
        <Card
          size="small"
          style={{ borderRadius: 2 }}
        >
          <Row gutter={[16, 16]}>
            {Object.entries(tablesByZone).map(([zone, zoneTables]) => (
              <Col key={zone} xs={24} sm={12} md={6}>
                <div style={{
                  border: `1px solid ${ZONE_COLORS[zone] || '#d9d9d9'}`,
                  borderRadius: 2,
                  padding: 8,
                  minHeight: 120,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 8,
                    padding: '4px 8px',
                    background: `${ZONE_COLORS[zone]}10`,
                    borderRadius: 2,
                  }}>
                    <EnvironmentOutlined style={{ color: ZONE_COLORS[zone], marginRight: 6 }} />
                    <Text strong style={{ color: ZONE_COLORS[zone], fontSize: 13 }}>
                      {ZONE_LABELS[zone] || zone}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {zoneTables.map(table => renderTableCell(table, false, false))}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      </div>
    )
  }

  // --- RENDER ORDER CARD (KANBAN ITEM) ---
  const renderOrderCard = (order) => {
    const totalPrice = (order.items || []).reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);

    return (
      <Card
        key={order.id}
        size="small"
        style={{ marginBottom: 12, borderRadius: 2, borderLeft: `4px solid ${STATUS_CONFIG[order.status]?.color || '#d9d9d9'}` }}
        bodyStyle={{ padding: 12 }}
        hoverable
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text strong style={{ fontSize: 16 }}><TableOutlined /> {order.tableId}</Text>
          <Text type="secondary">#{order.id}</Text>
        </div>

        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
          <UserOutlined style={{ marginRight: 6, fontSize: 12, color: '#8c8c8c' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{order.userName || 'Ẩn danh'}</Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space>
            {(order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT') && (
              <Button
                size="small"
                type="primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => {
                  setCurrentInvoiceOrder(order.id);
                  setInvoiceModalOpen(true);
                }}
              >
                {order.status === 'PENDING' ? 'Xuất hóa đơn' : 'Thanh toán'}
              </Button>
            )}
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined style={{ color: '#1677ff' }} />}
              onClick={() => handleViewDetails(order)}
            />
            {order.status === 'PENDING' && (
              <>
                <Popconfirm title="Xác nhận hoàn tất?" onConfirm={() => handleUpdateStatus(order.id, 'COMPLETED')}>
                  <Button size="small" type="primary" icon={<CheckOutlined />} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} />
                </Popconfirm>
                <Popconfirm title="Xác nhận hủy đơn?" onConfirm={() => handleUpdateStatus(order.id, 'CANCELLED')}>
                  <Button size="small" danger icon={<CloseOutlined />} />
                </Popconfirm>
              </>
            )}
            {order.status !== 'PENDING' && (
              <Popconfirm title="Xóa đơn hàng?" onConfirm={() => handleDelete(order)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        </div>
      </Card>
    )
  }

  // --- RENDER KANBAN COLUMN ---
  const renderColumn = (statusKey, title) => {
    const columnOrders = orders.filter(o => o.status === statusKey);
    const config = STATUS_CONFIG[statusKey];

    return (
      <Col xs={24} md={8}>
        <div style={{ background: '#f5f5f5', borderRadius: 2, padding: 12, minHeight: '40vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {config.icon}
              <Title level={5} style={{ margin: 0 }}>{title}</Title>
            </div>
            <Badge count={columnOrders.length} color={config.color} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {columnOrders.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Trống" />
            ) : (
              columnOrders.map(order => renderOrderCard(order))
            )}
          </div>
        </div>
      </Col>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchOrders(); fetchAllTables(); }} loading={loading}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Tạo đơn
          </Button>
        </Space>
      </div>

      {/* --- SƠ ĐỒ NHÀ HÀNG --- */}
      {renderFloorPlan()}

      {/* --- KANBAN BOARD --- */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <TableOutlined style={{ fontSize: 20, marginRight: 8, color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0 }}>Quản lý đơn đặt món</Title>
      </div>
      <Spin spinning={loading}>
        <Row gutter={16}>
          {renderColumn('PENDING', 'ĐANG PHỤC VỤ')}
          {renderColumn('AWAITING_PAYMENT', 'CHỜ THANH TOÁN')}
          {renderColumn('COMPLETED', 'ĐÃ THANH TOÁN')}
          {renderColumn('CANCELLED', 'ĐÃ HỦY')}
        </Row>
      </Spin>

      {/* --- MODAL XEM CHI TIẾT --- */}
      <Modal
        title={
          <Space>
            <span>Chi tiết đơn hàng #{selectedOrder?.id}</span>
            {selectedOrder && <Tag color={STATUS_CONFIG[selectedOrder.status]?.color}>{selectedOrder.status}</Tag>}
          </Space>
        }
        open={detailsModalOpen}
        onCancel={() => {
          setDetailsModalOpen(false);
          setOrderDetails(null);
        }}
        footer={[
          (selectedOrder?.status === 'PENDING' || selectedOrder?.status === 'AWAITING_PAYMENT') && (
            <Button 
              key="payment" 
              type="primary" 
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => {
                setCurrentInvoiceOrder(selectedOrder.id);
                setInvoiceModalOpen(true);
                setDetailsModalOpen(false);
                setOrderDetails(null);
              }}
            >
              {selectedOrder?.status === 'PENDING' ? 'Xuất hóa đơn' : 'Thanh toán'}
            </Button>
          ),
          <Button key="close" onClick={() => {
            setDetailsModalOpen(false);
            setOrderDetails(null);
          }}>
            Đóng
          </Button>
        ]}
        width={600}
      >
        {selectedOrder && (
          <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div><strong>Bàn phục vụ:</strong> <Tag color="geekblue" style={{ fontSize: 14 }}>{selectedOrder.tableId}</Tag></div>
              <div><strong>Người đặt:</strong> <Tag color="orange" style={{ fontSize: 14 }}>{selectedOrder.userName || 'Ẩn danh'}</Tag></div>
            </div>
            <Divider orientation="left">Danh sách món ăn</Divider>
            <Spin spinning={detailsLoading}>
              <List
                size="small"
                bordered
                dataSource={orderDetails?.items || []}
                renderItem={item => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <Text>{item.itemName} <Text type="secondary">x {item.quantity}</Text></Text>
                      <Text strong>{(item.quantity * (item.unitPrice || 0)).toLocaleString('vi-VN')} đ</Text>
                    </div>
                  </List.Item>
                )}
              />
            </Spin>
            <Divider dashed />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffbe6', padding: '12px 16px', borderRadius: 2, border: '1px solid #ffe58f' }}>
              <Title level={4} style={{ margin: 0 }}>Tổng cộng (Chưa bao gồm VAT):</Title>
              <Title level={3} type="danger" style={{ margin: 0 }}>
                {calculateFinalPrice().toLocaleString('vi-VN')} đ
              </Title>
            </div>
          </div>
        )}
      </Modal>

      {/* --- MODAL TẠO ĐƠN (REUSABLE) --- */}
      <CreateOrderModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSuccess={handleCreateOrderSuccess}
      />

      {/* --- INVOICE MODAL --- */}
      <InvoiceModal
        open={invoiceModalOpen}
        orderId={currentInvoiceOrder}
        onClose={() => {
            setInvoiceModalOpen(false)
            setCurrentInvoiceOrder(null)
            fetchOrders() // refresh data when closing
        }}
      />
    </div>
  )
}

export default OrderPage





import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Empty,
  Divider,
  message,
  Descriptions,
  Modal,
  List
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  ShoppingCartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TableOutlined
} from '@ant-design/icons';
import { orderApi } from '../services/api';
import InvoiceModal from '../components/InvoiceModal';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  PENDING: { color: 'orange', label: 'Đang chờ', icon: <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} /> },
  AWAITING_PAYMENT: { color: 'gold', label: 'Chờ thanh toán', icon: <ClockCircleOutlined style={{ marginRight: 8, color: '#d48806' }} /> },
  COMPLETED: { color: 'green', label: 'Đã thanh toán', icon: <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} /> },
  CANCELLED: { color: 'red', label: 'Đã hủy', icon: <CloseCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} /> },
};

const MyOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // States for Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [currentInvoiceOrder, setCurrentInvoiceOrder] = useState(null);

  const fetchOrders = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await orderApi.getByUser(user?.userName);
      setOrders(res.data);
    } catch {
      if (!quiet) message.error('Không thể tải danh sách đơn hàng');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto polling for SePAY webhook updates
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [user?.userName]);

  const handleViewDetails = async (order) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await orderApi.getById(order.id);
      setSelectedOrder(res.data);
    } catch {
      message.error('Không thể tải chi tiết đơn hàng');
    } finally {
      setDetailsLoading(false);
    }
  };

  const calculateTotal = (order) => {
    if (!order.items) return 0;
    return order.items.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0);
  };

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id) => <Text strong>#{id}</Text>,
    },
    {
      title: 'Bàn',
      dataIndex: 'tableId',
      key: 'tableId',
      render: (tableId) => (
        <Tag icon={<TableOutlined />} color="blue">{tableId}</Tag>
      ),
    },
    {
      title: 'Người đặt',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => date ? new Date(date).toLocaleString('vi-VN') : '-',
    },
    {
      title: 'Số món',
      key: 'itemCount',
      render: (_, record) => record.items?.length || 0,
    },
    {
      title: 'Tổng tiền',
      key: 'total',
      align: 'right',
      render: (_, record) => (
        <Text strong type="danger">
          {calculateTotal(record).toLocaleString('vi-VN')} đ
        </Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = STATUS_CONFIG[status] || { color: 'default', label: status };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          {(record.status === 'PENDING' || record.status === 'AWAITING_PAYMENT') && (
            <Button
              type="primary"
              ghost
              size="small"
              onClick={() => {
                setCurrentInvoiceOrder(record.id);
                setInvoiceModalOpen(true);
              }}
            >
              Thanh toán
            </Button>
          )}
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            Xem
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ShoppingCartOutlined style={{ fontSize: 24, marginRight: 12, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>Đơn hàng của tôi</Title>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders} loading={loading}>
            Làm mới
          </Button>
        </div>

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} đơn` }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Bạn chưa có đơn hàng nào"
                />
              ),
            }}
          />
        </Spin>
      </Card>

      <Modal
        title={
          <Space>
            <span>Chi tiết đơn hàng #{selectedOrder?.id}</span>
            {selectedOrder && (
              <Tag color={STATUS_CONFIG[selectedOrder.status]?.color}>
                {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
              </Tag>
            )}
          </Space>
        }
        open={detailsModalOpen}
        onCancel={() => setDetailsModalOpen(false)}
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
              }}
            >
              Thanh toán
            </Button>
          ),
          <Button key="close" onClick={() => setDetailsModalOpen(false)}>
            Đóng
          </Button>
        ]}
        width={600}
      >
        {selectedOrder && (
          <div style={{ padding: '10px 0' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Mã đơn">{selectedOrder.id}</Descriptions.Item>
              <Descriptions.Item label="Bàn">
                <Tag icon={<TableOutlined />} color="blue">{selectedOrder.tableId}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người đặt">{selectedOrder.userName}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_CONFIG[selectedOrder.status]?.color}>
                  {STATUS_CONFIG[selectedOrder.status]?.label}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Danh sách món ăn</Divider>
            <Spin spinning={detailsLoading}>
              <List
                size="small"
                bordered
                dataSource={selectedOrder.items || []}
                renderItem={(item) => (
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#fffbe6',
                padding: '12px 16px',
                borderRadius: 2,
                border: '1px solid #ffe58f',
              }}
            >
              <Text strong style={{ fontSize: 16 }}>Tổng cộng (Chưa bao gồm VAT):</Text>
              <Text strong type="danger" style={{ fontSize: 20 }}>
                {calculateTotal(selectedOrder).toLocaleString('vi-VN')} đ
              </Text>
            </div>
            {selectedOrder.status === 'COMPLETED' && selectedOrder.finalPrice && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f6ffed',
                  padding: '12px 16px',
                  borderRadius: 2,
                  border: '1px solid #b7eb8f',
                  marginTop: 12
                }}
              >
                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>Đã thanh toán:</Text>
                <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                  {selectedOrder.finalPrice.toLocaleString('vi-VN')} đ
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      <InvoiceModal
        open={invoiceModalOpen}
        orderId={currentInvoiceOrder}
        onClose={() => {
          setInvoiceModalOpen(false);
          setCurrentInvoiceOrder(null);
          fetchOrders();
        }}
      />
    </div>
  );
};

export default MyOrdersPage;
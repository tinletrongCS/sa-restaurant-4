/* eslint-disable */
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Button,
  Modal,
  Form,
  Select,
  Tag,
  Space,
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
  Tooltip,
  Steps,
  Input
} from 'antd'
import {
  PlusOutlined,
  MinusOutlined,
  CheckCircleOutlined,
  TableOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import { orderApi, inventoryApi, tableApi, userApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

const { Title, Text } = Typography

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

const CreateOrderModal = ({ open, onCancel, onSuccess }) => {
  const { user } = useAuth()
  const [form] = Form.useForm()
  
  // Shared States from OrderPage
  const [menu, setMenu] = useState([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [cart, setCart] = useState({})
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [allTables, setAllTables] = useState([])
  const [allTablesLoading, setAllTablesLoading] = useState(false)
  const [filterZone, setFilterZone] = useState('all')
  const [filterTableCategory, setFilterTableCategory] = useState('all')
  const [filterCapacity, setFilterCapacity] = useState('all')
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState('forward')
  const prevStepRef = useRef(0)

  useEffect(() => {
    if (currentStep > prevStepRef.current) {
      setDirection('forward')
    } else if (currentStep < prevStepRef.current) {
      setDirection('backward')
    }
    prevStepRef.current = currentStep
  }, [currentStep])
  
  const [submitting, setSubmitting] = useState(false)
  
  // Validation state for Admin
  const [isValidatingUser, setIsValidatingUser] = useState(false)
  const [isUserValid, setIsUserValid] = useState(true)

  const fetchMenu = async () => {
    setMenuLoading(true)
    try {
      const res = await inventoryApi.getMenu()
      setMenu(res.data)
    } catch (err) {
      message.error('Không thể tải Menu')
    } finally {
      setMenuLoading(false)
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
    if (open) {
      fetchMenu()
      fetchAllTables()
      setSelectedCategory('all')
      setFilterZone('all')
      setFilterTableCategory('all')
      setFilterCapacity('all')
      setSelectedTableId(null)
      setCurrentStep(0)
      setCart({})
      
      // Auto-fill username if NOT admin
      if (user && user.permission !== 'admin') {
        form.setFieldsValue({ userName: user.userName })
      } else {
        form.setFieldsValue({ userName: '' })
      }
    }
  }, [open, user])

  const handleAddToCart = (itemName) => {
    setCart((prev) => ({
      ...prev,
      [itemName]: (prev[itemName] || 0) + 1,
    }))
  }

  const handleRemoveFromCart = (itemName) => {
    setCart((prev) => {
      const newCart = { ...prev }
      if (newCart[itemName] > 1) {
        newCart[itemName] -= 1
      } else {
        delete newCart[itemName]
      }
      return newCart
    })
  }

  const calculateTotal = () => {
    let total = 0;
    Object.keys(cart).forEach(itemName => {
      const menuItem = menu.find(item => item.name === itemName);
      if (menuItem) {
        total += menuItem.price * cart[itemName];
      }
    });
    return total;
  }

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitting(true)
    try {
      const values = await form.validateFields()

      if (!selectedTableId) {
        message.warning('Vui lòng chọn bàn!')
        setSubmitting(false)
        return
      }

      const parsedItems = Object.keys(cart).map((itemName) => {
        const menuItem = menu.find(item => item.name === itemName);
        return {
          inventoryItemId: menuItem ? menuItem.id : null,
          itemName: itemName,
          quantity: cart[itemName],
          unitPrice: menuItem ? menuItem.price : 0
        }
      })

      if (parsedItems.length === 0) {
        message.warning('Vui lòng chọn ít nhất 1 món ăn!')
        setSubmitting(false)
        return
      }

      const selectedTable = allTables.find(t => t.id === selectedTableId)

      const payload = {
        tableId: selectedTable ? selectedTable.tableName : String(selectedTableId),
        userName: values.userName,
        items: parsedItems,
        totalPrice: calculateTotal(),
      }

      await orderApi.create(payload)
      await tableApi.updateStatus(selectedTableId, false)

      message.success({
        content: (
          <>
            Tạo đơn hàng thành công
          </>
        ),
        className: 'custom-message',})
      onSuccess()
    } catch (err) {
      console.error(err)
      message.error({
        content: (
          <>
            Tạo đơn hàng thất bại
          </>
        ),
        className: 'custom-message',})
    } finally {
      setSubmitting(false)
    }
  }

  const validateUsername = async (username) => {
    if (!username) {
      if (user.permission === 'admin') setIsUserValid(false);
      return;
    }
    if (user.permission !== 'admin') return;
    
    setIsValidatingUser(true)
    try {
      await userApi.getByUsername(username)
      setIsUserValid(true)
      message.success({
        content: (
          <>
            Nhấn <span style={{ fontWeight: 600 }}>Xác nhận & Đặt món</span> để tạo đơn đặt món
          </>
        ),
        className: 'custom-message',})
    } catch (err) {
      setIsUserValid(false)
      message.error({
        content: (
          <>
            Người dùng <span style={{ fontWeight: 600 }}>{username}</span> không tồn tại!
          </>
        ),
        className: 'custom-message',})
      form.setFields([
        {
          name: 'userName',
          errors: ['Tên người dùng không tồn tại'],
        },
      ]);
    } finally {
      setIsValidatingUser(false)
    }
  }

  const filteredMenu = selectedCategory === 'all'
    ? menu
    : menu.filter(item => item.category === selectedCategory);

  const filteredTablesForModal = useMemo(() => {
    return allTables.filter(t => {
      if (filterZone !== 'all' && t.zone !== filterZone) return false
      if (filterTableCategory !== 'all' && t.category !== filterTableCategory) return false
      if (filterCapacity !== 'all' && t.capacity < Number(filterCapacity)) return false
      return true
    })
  }, [allTables, filterZone, filterTableCategory, filterCapacity])

  const uniqueZones = useMemo(() => [...new Set(allTables.map(t => t.zone))], [allTables])
  const uniqueCategories = useMemo(() => [...new Set(allTables.map(t => t.category))], [allTables])
  const uniqueCapacities = useMemo(() => [...new Set(allTables.map(t => t.capacity))].sort((a, b) => a - b), [allTables])

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
          onClick={() => {
            if (isClickable && isAvailable) {
              setSelectedTableId(table.id)
              form.setFieldsValue({ tableId: table.id })
            }
          }}
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

  const renderMiniMapInModal = () => {
    const grouped = {}
    filteredTablesForModal.forEach(t => {
      if (!grouped[t.zone]) grouped[t.zone] = []
      grouped[t.zone].push(t)
    })

    if (filteredTablesForModal.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tìm thấy bàn phù hợp" />
    }

    return (
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 2, padding: 12, background: '#fafafa' }}>
        {Object.entries(grouped).map(([zone, zoneTables]) => (
          <div key={zone} style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 6,
              padding: '2px 8px',
              background: `${ZONE_COLORS[zone]}10`,
              borderRadius: 2,
            }}>
              <EnvironmentOutlined style={{ color: ZONE_COLORS[zone], marginRight: 6, fontSize: 12 }} />
              <Text strong style={{ color: ZONE_COLORS[zone], fontSize: 12 }}>
                {ZONE_LABELS[zone] || zone}
              </Text>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {zoneTables.map(table => renderTableCell(table, true, selectedTableId === table.id))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Modal
      title={
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0, marginBottom: 16 }}>Đặt món</Title>
          <Steps
            current={currentStep}
            size="small"
            items={[
              { title: 'Chọn bàn', icon: <TableOutlined /> },
              { title: 'Chọn món', icon: <AppstoreOutlined /> },
              { title: 'Hoàn tất', icon: <CheckCircleOutlined /> },
            ]}
          />
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={800}
      footer={[
        currentStep > 0 && (
          <Button key="back" onClick={() => setCurrentStep(currentStep - 1)}>
            Quay lại
          </Button>
        ),
        currentStep < 2 ? (
          <Button
            key="next"
            type="primary"
            onClick={() => {
              if (currentStep === 0 && !selectedTableId) {
                message.warning('Vui lòng chọn bàn!')
                return
              }
              if (currentStep === 1 && Object.keys(cart).length === 0) {
                message.warning('Vui lòng chọn ít nhất 1 món!')
                return
              }
              setCurrentStep(currentStep + 1)
            }}
          >
            Tiếp tục
          </Button>
        ) : (
          <Button
            key="submit"
            type="primary"
            onClick={handleCreate}
            loading={submitting}
            disabled={submitting || isValidatingUser || !isUserValid}
            style={
              !isUserValid
                ? {
                    backgroundColor: '#d9d9d9',
                    borderColor: '#d9d9d9',
                    color: '#8c8c8c',
                    cursor: 'not-allowed',
                  }
                : {
                    backgroundColor: '#52c41a',
                    borderColor: '#52c41a',
                  }
            }
          >
            Xác nhận & Đặt món
          </Button>
        ),
      ]}
    >
      <div style={{ minHeight: 400, marginTop: 24 }}>
        <Form form={form} layout="vertical">
          <div key={currentStep} className={direction === 'forward' ? "step-content-wrapper" : "step-content-wrapper-back"}>
            {/* STEP 1: CHỌN BÀN */}
            {currentStep === 0 && (
              <>
                <Divider orientation="left" style={{ marginTop: 0 }}>
                  <Space><EnvironmentOutlined /> Khu vực & Loại bàn</Space>
                </Divider>

                <Row gutter={12} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Khu vực</Text>
                    <Select
                      value={filterZone}
                      onChange={(v) => { setFilterZone(v); setSelectedTableId(null); }}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'all', label: 'Tất cả khu vực' },
                        ...uniqueZones.map(z => ({ value: z, label: ZONE_LABELS[z] || z }))
                      ]}
                    />
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Loại bàn</Text>
                    <Select
                      value={filterTableCategory}
                      onChange={(v) => { setFilterTableCategory(v); setSelectedTableId(null); }}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'all', label: 'Tất cả loại' },
                        ...uniqueCategories.map(c => ({ value: c, label: CATEGORY_LABELS[c] || c }))
                      ]}
                    />
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Số chỗ tối thiểu</Text>
                    <Select
                      value={filterCapacity}
                      onChange={(v) => { setFilterCapacity(v); setSelectedTableId(null); }}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'all', label: 'Tất cả' },
                        ...uniqueCapacities.map(c => ({ value: String(c), label: `${c}+ chỗ` }))
                      ]}
                    />
                  </Col>
                </Row>

                <div style={{ marginBottom: 16 }}>
                  <Text strong>Sơ đồ chọn bàn (Click vào bàn trống):</Text>
                  <div style={{ marginTop: 12, maxHeight: 250, overflowY: 'auto' }}>
                    {renderMiniMapInModal()}
                  </div>
                </div>

                {selectedTableId && (() => {
                  const t = allTables.find(x => x.id === selectedTableId)
                  return t ? (
                    <div style={{ padding: '12px 16px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size="large">
                        <Space><TableOutlined style={{ color: '#1890ff' }} /><Text strong>{t.tableName}</Text></Space>
                        <Tag color="blue">{ZONE_LABELS[t.zone] || t.zone}</Tag>
                        <Tag><TeamOutlined /> {t.capacity} chỗ</Tag>
                      </Space>
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                    </div>
                  ) : null
                })()}

                <Form.Item name="tableId" hidden rules={[{ required: true, message: 'Vui lòng chọn bàn!' }]}>
                  <Input />
                </Form.Item>
              </>
            )}

            {/* STEP 2: CHỌN MÓN */}
            {currentStep === 1 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <Radio.Group
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="all">Tất cả</Radio.Button>
                    <Radio.Button value="mon_kho">Món khô</Radio.Button>
                    <Radio.Button value="do_nuoc">Món nước</Radio.Button>
                    <Radio.Button value="do_uong">Đồ uống</Radio.Button>
                    <Radio.Button value="trang_mieng">Tráng miệng</Radio.Button>
                  </Radio.Group>
                </div>

                <div style={{ height: 350, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 2, padding: 8 }}>
                  <List
                    itemLayout="horizontal"
                    dataSource={filteredMenu}
                    loading={menuLoading}
                    renderItem={(item) => {
                      const qty = cart[item.name] || 0;
                      const isOutOfStock = (item.quantity || 0) <= qty;
                      return (
                        <List.Item
                          style={{
                            border: qty > 0 ? '1px solid #1890ff' : '1px solid transparent',
                            borderRadius: 2,
                            backgroundColor: qty > 0 ? '#e6f7ff' : 'transparent',
                            opacity: (item.quantity <= 0 && qty === 0) ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            padding: '8px 12px'
                          }}
                          actions={[
                            <Space key="actions">
                              <Button
                                size="small"
                                shape="circle"
                                icon={<MinusOutlined />}
                                disabled={qty === 0}
                                onClick={() => handleRemoveFromCart(item.name)}
                              />
                              <Text strong style={{ width: 24, textAlign: 'center', display: 'inline-block' }}>{qty}</Text>
                              <Button
                                size="small"
                                type="primary"
                                shape="circle"
                                icon={<PlusOutlined />}
                                disabled={isOutOfStock}
                                onClick={() => handleAddToCart(item.name)}
                              />
                            </Space>
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <div style={{ display: 'flex', paddingRight: 20 }}>
                                <div style={{ flex: 1, paddingRight: 16 }}>
                                  <span>{item.name}</span>
                                </div>
                                <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                                  <Text type="success" strong>{item.price.toLocaleString('vi-VN')} đ</Text>
                                </div>
                              </div>
                            }
                            description={
                              <div style={{ display: 'flex', paddingRight: 20, marginTop: 4 }}>
                                <div style={{ flex: 1, paddingRight: 16 }}>
                                  <Text type="secondary" style={{ fontSize: 12, display: 'block', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.4 }}>
                                    {item.description}
                                  </Text>
                                </div>
                                <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                                  <Tag color={((item.quantity || 0) - qty) <= 5 ? 'volcano' : 'green'} style={{ fontSize: 11, margin: 0, width: 70, textAlign: 'center' }}>
                                    Còn {(item.quantity || 0) - qty}
                                  </Tag>
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )
                    }}
                  />
                </div>

                <Divider orientation="left">Các món bạn đã chọn</Divider>
                <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                  {Object.keys(cart).length === 0 ? (
                    <Text type="secondary">Chưa có món nào được chọn...</Text>
                  ) : (
                    <>
                      <Space wrap style={{ marginBottom: 16 }}>
                        {Object.keys(cart).map((itemName) => (
                          <Tag key={itemName} color="cyan" style={{ padding: '4px 8px', fontSize: 14 }}>
                            {itemName} <Text strong type="danger">x {cart[itemName]}</Text>
                          </Tag>
                        ))}
                      </Space>
                      <Divider style={{ margin: '8px 0' }} dashed />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>Tạm tính:</Text>
                        <Title level={4} type="danger" style={{ margin: 0 }}>
                          {calculateTotal().toLocaleString('vi-VN')} đ
                         </Title>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            )}

            {/* STEP 3: XÁC NHẬN */}
            {currentStep === 2 && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                  <Title level={4} style={{ marginTop: 16 }}>Kiểm tra lại thông tin</Title>
                </div>

                <Row gutter={24}>
                  <Col span={10}>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <Card title="Thông tin người đặt" size="small" style={{ borderRadius: 2 }}>
                        <Form.Item 
                          name="userName" 
                          label="Tên người dùng" 
                          rules={[{ required: true, message: 'Vui lòng nhập username!' }]}
                          style={{ marginBottom: 0 }}
                        >
                            <Input 
                              prefix={<UserOutlined />} 
                              placeholder="Nhập username" 
                              disabled={user.permission !== 'admin'}
                              onChange={() => setIsUserValid(true)}
                              onBlur={(e) => validateUsername(e.target.value)}
                              suffix={isValidatingUser ? <Spin size="small" /> : null}
                            />
                        </Form.Item>
                        {user.permission !== 'admin' && (
                          <Text type="secondary" style={{ fontSize: 11 }}></Text>
                        )}
                      </Card>

                      <Card title="Thông tin bàn" size="small" style={{ borderRadius: 2 }}>
                        {(() => {
                          const t = allTables.find(x => x.id === selectedTableId)
                          return t ? (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">Tên bàn:</Text>
                                <Text strong>{t.tableName}</Text>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">Khu vực:</Text>
                                <Tag color="blue">{ZONE_LABELS[t.zone] || t.zone}</Tag>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary">Sức chứa:</Text>
                                <Text>{t.capacity} khách</Text>
                              </div>
                            </Space>
                          ) : null
                        })()}
                      </Card>
                    </Space>
                  </Col>
                  <Col span={14}>
                    <Card title="Danh sách món ăn" size="small" style={{ borderRadius: 2 }}>
                      <List
                        size="small"
                        dataSource={Object.keys(cart)}
                        renderItem={itemName => {
                          const item = menu.find(m => m.name === itemName)
                          return (
                            <List.Item style={{ padding: '8px 0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <Text>{itemName} <Text type="secondary">x {cart[itemName]}</Text></Text>
                                <Text strong>{(cart[itemName] * (item?.price || 0)).toLocaleString('vi-VN')} đ</Text>
                              </div>
                            </List.Item>
                          )
                        }}
                      />
                      <Divider style={{ margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 16 }}>Tổng cộng (Chưa bao gồm VAT):</Text>
                        <Text strong type="danger" style={{ fontSize: 20 }}>
                          {calculateTotal().toLocaleString('vi-VN')} đ
                        </Text>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            )}
          </div>
        </Form>
      </div>
    </Modal>
  )
}

export default CreateOrderModal

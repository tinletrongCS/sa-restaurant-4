import { useState } from 'react';
import { Layout, Menu, Typography, Button, Divider, message } from 'antd';
import {
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  SettingOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import UserTable from '../components/UserTable';
import OrderPage from './OrderPage';
import InventoryPage from './InventoryPage';
import ProfilePage from './ProfilePage';
import MyOrdersPage from './MyOrdersPage';
import TransactionPage from './TransactionPage';
import MenuView from '../components/MenuView';
import CreateOrderModal from '../components/CreateOrderModal';
import './DashboardPage.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [selectedKey, setSelectedKey] = useState('1');
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Define menu items based on user role
  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: 'Trang chủ',
    },
    
    // Only show 'My Orders' if user is NOT an admin
    ...(user?.permission !== 'admin' ? [{
      key: '6',
      icon: <FileTextOutlined />,
      label: 'Đơn đặt món',
    }] : []),
    
    // Only show 'Đơn Hàng' if user has 'admin' permission
    ...(user?.permission === 'admin' ? [{
      key: '3',
      icon: <ShoppingCartOutlined />,
      label: 'Đơn đặt món',
    }] : []),
    // Only show 'Kho hàng' if user has 'admin' permission
    ...(user?.permission === 'admin' ? [{
      key: '4',
      icon: <InboxOutlined />,
      label: 'Quản lý thực đơn',
    }] : []),
    // Only show 'User Management' if user has 'admin' permission
    ...(user?.permission === 'admin' ? [{
      key: '2',
      icon: <UserOutlined />,
      label: 'Quản lý người dùng',
    }] : []),
    {
      key: '5',
      icon: <SettingOutlined />,
      label: 'Tài khoản của tôi',
    },
    ...(user?.permission === 'admin' ? [{
      key: '7',
      icon: <FileTextOutlined />,
      label: 'Lịch sử giao dịch',
    }] : []),
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case '1':
        return (
          <div>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Title level={3}>Xin chào, {user?.userName}!</Title>
                {/* <Text type="secondary">Vai trò: {user?.permission}</Text> */}
              </div>
              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                onClick={() => setOrderModalOpen(true)}
                style={{ height: 42, borderRadius: 2, padding: '0 32px', fontSize: 16, fontWeight: 'bold', background: '#52c41a', color: '#ffffffff' }}
              >
                Đặt món ngay
              </Button>
            </div>

            {/* Show Menu for everyone in Overview, but it's the ONLY thing for regular users */}
            <Divider />
            <MenuView />

            <CreateOrderModal
              open={orderModalOpen}
              onCancel={() => setOrderModalOpen(false)}
              onSuccess={() => {
                setOrderModalOpen(false);
                message.success('Đơn hàng của bạn đã được tiếp nhận!');
              }}
            />
          </div>
        );
      case '2':
        return <UserTable />;
      case '3':
        return <OrderPage />;
      case '4':
        return <InventoryPage />;
      case '5':
        return <ProfilePage />;
      case '6':
        return <MyOrdersPage />;
      case '7':
        return <TransactionPage />;
      default:
        return <div>Vui lòng chọn một mục</div>;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="logo">
          <h2 style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}>Quản lý nhà hàng</h2>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={(e) => setSelectedKey(e.key)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="site-layout-sub-header-background" style={{ padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ marginRight: '16px' }}>
            <Text strong>{user?.userName} ({user?.permission})</Text>
          </div>
          <Button type="primary" danger icon={<LogoutOutlined />} onClick={logout}>
            Đăng Xuất
          </Button>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div className="site-layout-background" style={{ padding: 24, minHeight: 360, background: '#fff' }}>
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardPage;

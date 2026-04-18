import React, { useState, useEffect, useMemo } from 'react';
import { Table, Typography, Tag, Spin } from 'antd';
import { paymentApi } from '../services/api';

const { Title, Text } = Typography;

const TransactionPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const parseDate = (val) => {
        if (!val) return new Date();
        // If the backend returns a LocalDateTime as an array like [2026, 4, 18, 10, 30]
        if (Array.isArray(val)) {
            const [year, month, day, hour = 0, minute = 0, second = 0] = val;
            return new Date(year, month - 1, day, hour, minute, second);
        }
        // If it's a string like "2026-04-18 10:20:30", replace space with 'T' for safer parsing
        if (typeof val === 'string' && val.includes(' ') && !val.includes('T')) {
            return new Date(val.replace(' ', 'T'));
        }
        return new Date(val);
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await paymentApi.getTransactions();
            const sortedData = res.data.sort((a, b) => parseDate(b.transactionDate || b.receivedAt).getTime() - parseDate(a.transactionDate || a.receivedAt).getTime());
            setTransactions(sortedData);
        } catch (error) {
            console.error("Lỗi khi lấy giao dịch", error);
        } finally {
            setLoading(false);
        }
    };

    const groupedTransactions = useMemo(() => {
        const grouped = [];
        const todayStr = new Date().toLocaleDateString('vi-VN');

        transactions.forEach(tx => {
            const dateObj = parseDate(tx.transactionDate || tx.receivedAt);
            let dateStr = 'Không xác định';
            
            if (dateObj instanceof Date && !isNaN(dateObj)) {
                dateStr = dateObj.toLocaleDateString('vi-VN');
            }

            const label = dateStr === todayStr ? 'Hôm nay' : dateStr;

            let group = grouped.find(g => g.label === label);
            if (!group) {
                group = { label, data: [] };
                grouped.push(group);
            }
            group.data.push(tx);
        });

        return grouped;
    }, [transactions]);

    const columns = [
        {
            title: 'Mã GD SePAY',
            dataIndex: 'sepayTransactionId',
            key: 'sepayTransactionId',
            width: 120,
            render: (text) => <strong>{text}</strong>
        },
        {
            title: 'Đơn Hàng',
            dataIndex: 'orderId',
            key: 'orderId',
            width: 100,
            render: (text) => text ? <Tag color="blue">DH{text}</Tag> : <Text type="secondary">N/A</Text>
        },
        {
            title: 'Ngân hàng',
            dataIndex: 'gateway',
            key: 'gateway',
            width: 120,
        },
        {
            title: 'Tài khoản',
            dataIndex: 'accountNumber',
            key: 'accountNumber',
            width: 150,
        },
        {
            title: 'Số tiền VÀO',
            dataIndex: 'amountIn',
            key: 'amountIn',
            width: 130,
            align: 'right',
            render: (val) => val > 0 ? <span style={{color: 'green', fontWeight: 'bold'}}>+{val.toLocaleString()}</span> : '-'
        },
        {
            title: 'Nội dung CK',
            dataIndex: 'content',
            key: 'content',
            // No width here allows it to be the flexible column
        },
        {
            title: 'Thời gian NH',
            dataIndex: 'transactionDate',
            key: 'transactionDate',
            width: 180,
            align: 'center',
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>Lịch sử giao dịch (SePAY)</Title>
            
            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            ) : groupedTransactions.length === 0 ? (
                <Table columns={columns} dataSource={[]} bordered />
            ) : (
                groupedTransactions.map(group => (
                    <div key={group.label} style={{ marginBottom: 32 }}>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: 16,
                            paddingLeft: 4
                        }}>
                            <Title level={4} style={{ 
                                margin: 0, 
                                color: group.label === 'Hôm nay' ? '#1890ff' : '#595959',
                                fontWeight: 600,
                                fontSize: '1.25rem',
                                letterSpacing: '-0.02em'
                            }}>
                                {group.label}
                            </Title>
                            <div style={{ 
                                flex: 1, 
                                height: '1px', 
                                background: 'linear-gradient(to right, #f0f0f0, transparent)', 
                                marginLeft: 16 
                            }} />
                        </div>
                        <Table 
                            columns={columns} 
                            dataSource={group.data} 
                            rowKey="id" 
                            pagination={false}
                            bordered
                            style={{ 
                                borderRadius: '8px', 
                                overflow: 'hidden',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                            }}
                        />
                    </div>
                ))
            )}
        </div>
    );
};

export default TransactionPage;

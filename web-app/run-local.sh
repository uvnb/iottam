#!/bin/bash
echo "🚀 Đang khởi động CareBot System trên máy Local..."
cd /home/quan/web/iottam/web-app

# Cài đặt thư viện nếu chưa có (nhưng thường là có rồi)
echo "📦 Đang kiểm tra thư viện..."
npm install

# Chạy server development
echo "🌐 Đang mở Local Server..."
npm run dev

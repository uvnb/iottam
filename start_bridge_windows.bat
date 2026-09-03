@echo off
echo Đang cài đặt thư viện cần thiết (nếu chưa có)...
pip install aiohttp bleak
echo.
echo Đang khởi động WebSocket Bridge chạy ngầm...
start pythonw ble_web_server.py
echo.
echo ==================================================
echo [THÀNH CÔNG] Cầu nối BLE đã chạy ngầm trên máy!
echo Bạn có thể tắt cửa sổ này đi.
echo Bây giờ hãy lên trang Web và bấm nút:
echo "KẾT NỐI QUA BRIDGE (KHUYÊN DÙNG)"
echo ==================================================
pause

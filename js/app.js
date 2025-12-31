// 1. ตั้งค่า Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDRYTht-6h5QDqFTGO6sr44TfuvDfApAPc",
    authDomain: "box-return-system.firebaseapp.com",
    projectId: "box-return-system",
    storageBucket: "box-return-system.firebasestorage.app",
    messagingSenderId: "272291754420",
    appId: "1:272291754420:web:9ee1c794acbe190309c2e1",
    measurementId: "G-8PX3LBXM3L"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 2. จัดการเมื่อโหลดหน้าจอ
window.onload = async function() {
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();
    
    // ตรวจสอบ Login
    if (!userPhone && !path.includes('login.html') && !path.includes('register.html')) {
        window.location.replace('login.html');
        return;
    }
    
    if (userPhone) {
        await loadUserData(); 
        if (path.includes('history.html')) {
            fetchHistoryFromFirebase(userPhone); 
        }
    }
};

// 3. ฟังก์ชันยืมกล่อง
async function borrowBox() {
    const boxId = document.getElementById('boxInput').value;
    const shopName = document.getElementById('shopSelect').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !shopName) { 
        alert("กรุณากรอกหมายเลขกล่องและเลือกสถานที่ยืม"); 
        return; 
    }

    try {
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: shopName,
            userPhone: userPhone,
            type: 'borrow',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("ยืมกล่องสำเร็จ!");
        window.location.replace('history.html'); // ไปหน้าประวัติเพื่อดูผล
    } catch (e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

// 4. ฟังก์ชันคืนกล่อง
async function returnBoxWithQR(scannedShopId) {
    const boxId = document.getElementById('boxInputReturn').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId) { 
        alert("กรุณาระบุหมายเลขกล่องก่อนสแกน QR"); 
        location.reload();
        return; 
    }

    try {
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: scannedShopId, 
            userPhone: userPhone,
            type: 'return',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนสำเร็จที่: " + scannedShopId + "\nได้รับ 5 แต้ม!");
        window.location.replace('history.html');
    } catch (e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

// 5. ฟังก์ชันดึงประวัติ (สำคัญมาก!)
async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;

    try {
        const snapshot = await db.collection("transactions")
            .where("userPhone", "==", phone)
            .orderBy("timestamp", "desc")
            .get();

        let html = "";
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>ยังไม่มีประวัติการทำรายการ</p>";
            return;
        }

        snapshot.forEach(doc => {
            const item = doc.data();
            const color = item.type === 'borrow' ? '#4CAF50' : '#FF9800';
            const typeLabel = item.type === 'borrow' ? '📥 ยืมกล่อง' : '📤 คืนกล่อง';
            
            html += `
                <div style="border-left:5px solid ${color}; background:#fff; padding:15px; margin:10px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                    <div style="display:flex; justify-content:space-between;">
                        <b style="color:${color}">${typeLabel}</b>
                        <small style="color:#888">${item.date || ''}</small>
                    </div>
                    <p style="margin:5px 0; font-size:14px;">เลขกล่อง: ${item.boxId} | ร้าน: ${item.shopName || 'ไม่ระบุ'}</p>
                </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = "<p style='text-align:center; color:red;'>เกิดข้อผิดพลาดในการโหลดข้อมูล (อาจต้องสร้าง Index ใน Firebase)</p>";
    }
}

// 6. โหลดข้อมูลผู้ใช้
async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if(!userPhone) return;
    try {
        const userDoc = await db.collection("users").doc(userPhone).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
            setUI('username', data.name);
            setUI('points', data.points || 0);
            setUI('returnCountDisplay', data.returnCount || 0);
            setUI('userid', data.studentId);
        }
    } catch(e) { console.log(e); }
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }

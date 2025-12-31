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
    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');

    if (!userPhone && !isLoginPage && !isRegisterPage) {
        window.location.replace('login.html');
        return;
    }
    
    if (userPhone) {
        await loadUserData(); 
        if (path.includes('history.html')) fetchHistoryFromFirebase(userPhone); 
        if (path.includes('rewards.html')) loadLeaderboard();
    }
};

// 3. ฟังก์ชันยืมกล่อง (ใส่แค่เลขกล่อง + ชื่อร้าน) - เร็วมากเพราะไม่มีรูป
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
        window.location.replace('index.html');
    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}

// 4. ฟังก์ชันคืนกล่อง (สแกน QR + เลขกล่อง)
async function returnBoxWithQR(scannedShopId) {
    const boxId = document.getElementById('boxInputReturn').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId) { 
        alert("กรุณาระบุหมายเลขกล่องก่อนสแกน"); 
        return; 
    }

    try {
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: scannedShopId, // ชื่อร้านจาก QR
            userPhone: userPhone,
            type: 'return',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // อัปเดตคะแนน +5
        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนกล่องสำเร็จ! ได้รับ 5 แต้ม");
        window.location.replace('index.html');
    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}

// --- ฟังก์ชันอื่นๆ (ลงทะเบียน, ล็อกอิน, โหลดข้อมูล) ---
async function performRegister() {
    const name = document.getElementById('regName').value;
    const studentId = document.getElementById('regStudentId').value;
    const faculty = document.getElementById('regFaculty').value;
    const year = document.getElementById('regYear').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (studentId.length !== 10) { alert("รหัสนักศึกษาต้องมี 10 หลัก"); return; }
    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name, studentId, faculty, year, phone, password: pass, points: 0, returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem('userPhone', phone);
        window.location.replace('index.html');
    } catch (e) { alert(e.message); }
}

async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists && userDoc.data().password === pass) {
            localStorage.setItem('userPhone', phone);
            window.location.replace('index.html');
        } else { alert("ข้อมูลไม่ถูกต้อง"); }
    } catch (e) { alert(e.message); }
}

async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if(!userPhone) return;
    const userDoc = await db.collection("users").doc(userPhone).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
        setUI('username', data.name);
        setUI('userphone', data.phone);
        setUI('userid', data.studentId);
        setUI('userfaculty', data.faculty);
        setUI('useryear', data.year);
        setUI('points', data.points);
        setUI('returnCountDisplay', data.returnCount);
    }
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }

// --- ฟังก์ชันดึงประวัติจาก Firebase ---
async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;

    try {
        // ดึงข้อมูลจากคอลเลกชัน transactions ของเบอร์โทรนี้ เรียงจากล่าสุดขึ้นก่อน
        const snapshot = await db.collection("transactions")
            .where("userPhone", "==", phone)
            .orderBy("timestamp", "desc")
            .get();

        let html = "";
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align:center; margin-top:50px; color:#888;">
                    <span style="font-size:50px;">📭</span>
                    <p>ยังไม่มีประวัติการทำรายการ</p>
                </div>`;
            return;
        }

        snapshot.forEach(doc => {
            const item = doc.data();
            const isBorrow = item.type === 'borrow';
            const statusColor = isBorrow ? '#4CAF50' : '#FF9800'; // เขียว = ยืม, ส้ม = คืน
            const icon = isBorrow ? '📥 ยืมกล่อง' : '📤 คืนกล่อง';

            html += `
                <div class="history-item" style="border-left: 5px solid ${statusColor}; background:#fff; padding:15px; margin:10px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:${statusColor}; font-size:16px;">${icon}</strong>
                        <small style="color:#888;">${item.date || 'ไม่ระบุวันที่'}</small>
                    </div>
                    <div style="margin-top:8px; font-size:14px; color:#444;">
                        <p style="margin:2px 0;"><b>เลขกล่อง:</b> ${item.boxId}</p>
                        <p style="margin:2px 0;"><b>สถานที่:</b> ${item.shopName || 'ไม่ระบุ'}</p>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (e) {
        console.error("Error fetching history: ", e);
        // หากเกิด Error เรื่อง Index (สำหรับครั้งแรกที่รันOrderBy)
        container.innerHTML = `<p style="text-align:center; padding:20px; color:red;">
            กรุณารอสักครู่ ระบบกำลังจัดเตรียมฐานข้อมูล (Indexing)...
        </p>`;
    }
}


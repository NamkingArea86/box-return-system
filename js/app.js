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
async function returnBoxWithQR(scannedText) {
    const boxId = document.getElementById('boxInputReturn').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId) {
        alert("กรุณาระบุหมายเลขกล่องก่อนสแกน");
        location.reload();
        return;
    }

    // 1. ตรวจสอบว่า QR มีคำว่า BOX- นำหน้าหรือไม่ (เพื่อความปลอดภัย)
    if (!scannedText.startsWith("BOX-")) {
        alert("QR Code ไม่ถูกต้อง! กรุณาสแกน QR ของระบบเท่านั้น");
        location.reload();
        return;
    }

    // 2. ตัดคำว่า "BOX-" ออกเพื่อให้เหลือแค่ชื่อสถานที่สวยๆ ไปแสดงบนหน้าเว็บ
    // เช่น จาก "BOX-จุดคืนจาน..." จะเหลือแค่ "จุดคืนจาน..."
    const cleanLocation = scannedText.replace("BOX-", "");

    try {
        // 3. บันทึกข้อมูลลง Firebase (ใช้ชื่อที่ตัด BOX- ออกแล้ว)
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: cleanLocation, // บันทึกชื่อที่สะอาดแล้ว
            userPhone: userPhone,
            type: 'return',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. อัปเดตแต้มและจำนวนครั้งที่คืน
        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนสำเร็จที่: " + cleanLocation + "\nได้รับ 5 แต้ม!");
        window.location.replace('history.html'); // ไปหน้าประวัติเพื่อดูผล

    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}

// 5. ฟังก์ชันดึงประวัติ (สำคัญมาก!)
async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;

    try {
        console.log("เริ่มดึงข้อมูลสำหรับเบอร์:", phone);

        // ดึงข้อมูลโดย "ไม่ใช้" orderBy เพื่อเลี่ยงปัญหา Index ซ้ำซ้อนหรือพัง
        const snapshot = await db.collection("transactions")
            .where("userPhone", "==", phone)
            .get();

        let html = "";
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>ไม่พบข้อมูลประวัติในระบบ</p>";
            return;
        }

        // นำข้อมูลมาเรียงลำดับด้วย JavaScript แทน (แก้ปัญหา Index ไม่ทำงาน)
        const docs = [];
        snapshot.forEach(doc => docs.push(doc.data()));
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        docs.forEach(item => {
            const isBorrow = item.type === 'borrow';
            const color = isBorrow ? '#4CAF50' : '#FF9800';
            const location = item.shopName || item.shopId || "ไม่ระบุสถานที่";

            html += `
                <div class="history-item" style="border-left: 5px solid ${color}; background:#fff; padding:15px; margin:10px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:${color};">${isBorrow ? '📥 ยืมกล่อง' : '📤 คืนกล่อง'}</strong>
                        <small style="color:#888;">${item.date || ''}</small>
                    </div>
                    <div style="margin-top:8px; font-size:14px;">
                        เลขกล่อง: <b>${item.boxId || '-'}</b><br>
                        สถานที่: ${location}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html;
        console.log("โหลดข้อมูลสำเร็จ!");

    } catch (e) {
        console.error("Error:", e);
        container.innerHTML = "<p style='color:red;'>ข้อผิดพลาด: " + e.message + "</p>";
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
            
            // ฟังก์ชันช่วยใส่ข้อมูลลงหน้าจอ (กัน Error ถ้าหา ID ไม่เจอ)
            const setUI = (id, val) => { 
                const el = document.getElementById(id);
                if(el) el.innerText = val || "-"; 
            };

            // ใส่ข้อมูลลงตาม ID ที่ตั้งไว้ใน HTML
            setUI('username', data.name);
            setUI('userphone', data.phone);
            setUI('userid', data.studentId); // ต้องตรงกับที่เก็บตอนลงทะเบียน
            setUI('userfaculty', data.faculty);
            setUI('useryear', data.year);
            setUI('points', data.points || 0);
            setUI('returnCountDisplay', data.returnCount || 0);

        } else {
            console.log("ไม่พบข้อมูลผู้ใช้ในระบบ");
        }
    } catch (e) {
        console.error("Error loading user data:", e);
    }
}
function logout() { localStorage.clear(); window.location.replace('login.html'); }




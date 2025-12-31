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
const storage = firebase.storage();

// 2. ฟังก์ชันทำงานเมื่อโหลดหน้าจอ (ตรวจสอบสิทธิ์ และ แสดงข้อมูล)
window.onload = async function() {
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();

    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isAdminPage = path.includes('admin');

    // ตรวจสอบการ Login
    if (!userPhone && !isLoginPage && !isRegisterPage && !isAdminPage) {
        window.location.replace('login.html');
        return;
    }
    
    if (userPhone && (isLoginPage || isRegisterPage)) {
        window.location.replace('index.html');
        return;
    }

    // ถ้า Login แล้ว ให้ดึงข้อมูลมาแสดง
    if (userPhone) {
        await loadUserData(); // ดึงข้อมูลล่าสุดจาก Firebase
        
        // ถ้าอยู่ในหน้า history.html ให้แสดงรายการประวัติด้วย
        if (path.includes('history.html')) {
            renderHistoryUI();
        }
    }
};

// 3. ฟังก์ชันลงทะเบียน
async function performRegister() {
    const name = document.getElementById('regName').value;
    const faculty = document.getElementById('regFaculty').value;
    const year = document.getElementById('regYear').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (!name || !faculty || !year || !phone || !pass) { 
        alert("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง"); return; 
    }

    // ✅ ตรวจสอบรหัสผ่าน: ต้องมีอักษร+ตัวเลข และไม่เกิน 10 ตัว
    const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
    if (!passRegex.test(pass)) {
        alert("รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข และมีความยาวไม่เกิน 10 ตัวอักษร");
        return;
    }

    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name: name,
            faculty: faculty,
            year: year,
            phone: phone,
            password: pass,
            points: 0,
            returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('userPhone', phone);
        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) {
        alert("สมัครไม่สำเร็จ: " + error.message);
    }
}

// 4. ฟังก์ชันเข้าสู่ระบบ
async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;

    if (!phone || !pass) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }

    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.password === pass) {
                localStorage.setItem('userPhone', phone);
                window.location.replace('index.html');
            } else { alert("รหัสผ่านไม่ถูกต้อง"); }
        } else { alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ"); }
    } catch (error) { alert("เกิดข้อผิดพลาด: " + error.message); }
}

// 5. ดึงข้อมูลผู้ใช้จาก Firebase มาแสดงผล (ใช้ในหน้า Index และหน้าอื่นๆ)
async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) return;

    try {
        const userDoc = await db.collection("users").doc(userPhone).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            
            // แสดงผลใน HTML ตาม ID ต่างๆ
            if (document.getElementById('username')) document.getElementById('username').innerText = data.name;
            if (document.getElementById('userphone')) document.getElementById('userphone').innerText = data.phone;
            if (document.getElementById('userfaculty')) document.getElementById('userfaculty').innerText = data.faculty || '-';
            if (document.getElementById('useryear')) document.getElementById('useryear').innerText = data.year || '-';
            if (document.getElementById('points')) document.getElementById('points').innerText = data.points || 0;
            if (document.getElementById('pointsDisplay')) document.getElementById('pointsDisplay').innerText = data.points || 0;
            if (document.getElementById('returnCountDisplay')) document.getElementById('returnCountDisplay').innerText = data.returnCount || 0;

            // อัปเดตข้อมูลใน LocalStorage เพื่อใช้ในหน้า History แบบ Offline ชั่วคราว
            localStorage.setItem('userName', data.name);
            localStorage.setItem('userPoints', data.points || 0);
            localStorage.setItem('returnCount', data.returnCount || 0);
            localStorage.setItem('userFaculty', data.faculty || '-');
            localStorage.setItem('userYear', data.year || '-');
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// 6. ฟังก์ชันคืนกล่อง (+5 แต้ม และเพิ่มจำนวนครั้ง)
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) { alert("กรุณาระบุข้อมูลให้ครบ"); return; }

    try {
        const storageRef = storage.ref(`returns/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(imageFile);
        const imageUrl = await storageRef.getDownloadURL();

        const dateStr = new Date().toLocaleString('th-TH');

        // บันทึกลงตาราง Transactions (สำหรับหน้าประวัติ)
        const transData = {
            boxId: boxId,
            userPhone: userPhone,
            type: 'return',
            imageUrl: imageUrl,
            date: dateStr,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection("transactions").add(transData);

        // อัปเดตข้อมูลใน Firebase (+5 แต้ม, +1 ครั้ง)
        const userRef = db.collection("users").doc(userPhone);
        await userRef.update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        // บันทึกลง LocalStorage สำหรับหน้าประวัติ (เพื่อให้หน้า history แสดงผลทันที)
        let historyData = JSON.parse(localStorage.getItem('borrowHistory')) || [];
        historyData.push(transData);
        localStorage.setItem('borrowHistory', JSON.stringify(historyData));

        alert("คืนกล่องสำเร็จ! ได้รับ 5 แต้ม");
        window.location.replace('index.html');
    } catch (error) { alert("เกิดข้อผิดพลาดในการคืนกล่อง"); }
}

// 7. ฟังก์ชันแสดงประวัติในหน้า history.html
function renderHistoryUI() {
    const historyData = JSON.parse(localStorage.getItem('borrowHistory')) || [];
    const container = document.getElementById('historyBox');
    if (!container) return;

    if (historyData.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>ยังไม่มีข้อมูลการยืม-คืน</h3></div>`;
        return;
    }

    let html = '';
    historyData.slice().reverse().forEach(item => {
        let icon = item.type === 'borrow' ? '📥' : '📤';
        let text = item.type === 'borrow' ? 'ยืมกล่อง' : 'คืนกล่อง';
        let color = item.type === 'borrow' ? '#4CAF50' : '#FF9800';
        
        html += `
        <div class="history-item" style="border-left: 5px solid ${color};">
            <div style="display:flex; justify-content:space-between;">
                <strong>${icon} ${text}</strong>
                <small style="color:#888;">${item.date}</small>
            </div>
            <div style="margin-top:5px; font-size:14px;">หมายเลข: <b>${item.boxId}</b></div>
        </div>`;
    });
    container.innerHTML = html;
}

// 8. ฟังก์ชันออกจากระบบ
function logout() {
    localStorage.clear();
    window.location.replace('login.html');
}
